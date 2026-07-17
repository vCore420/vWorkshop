# Workshop Refinement

A maintenance pass, not a feature pass — "will this make the Workshop
easier to live in and easier to continue developing over the next several
years?" Two real, previously-unexplained bugs got properly root-caused
here (not patched around), the save system got a genuine versioning and
migration framework, and Settings gained a Danger Zone for long-term
upkeep.

## Player movement: root cause, not a workaround

Two symptoms were reported: movement occasionally locking up entirely for
a moment, and movement continuing slightly longer than a key or touch
control was actually held. Both traced to the same root cause.

**A `keyup` is only ever dispatched to whichever document currently has
focus.** If the window loses focus while a movement key is physically
held down — alt-tabbing, clicking a browser UI element, a notification
stealing focus, switching apps on a tablet — the Workshop's page never
sees that key come back up. `InputManager` had no idea any of this had
happened; the key just stayed "held" indefinitely, exactly as if the
person were still pressing it.

That single cause produces two very different-looking symptoms, depending
on which key gets stuck:

- **Movement continuing after release** — the stuck key alone, with
  nothing opposing it.
- **Movement refusing to respond** — a stuck "forward" silently cancels a
  genuinely-held "backward" (they net to zero), which looks exactly like
  input not registering at all.

Fixed with the standard remedy for this well-known class of bug:
`InputManager` now resets every held key, the joystick, and any
in-progress look-drag back to neutral the instant the window blurs or the
tab is hidden (`_resetAllInput`, triggered by `window`'s `blur` event and
`document`'s `visibilitychange`). Neither of those needs the matching
`keyup`/`touchend` to ever arrive.

**A second, related bug found during the same investigation:** `KeyW` and
`ArrowUp` both mean "forward" (same for the other three directions). Held
state used to be tracked per *action* — releasing either key while the
other was still held cleared "forward" entirely, since there was only one
boolean per action, not one per physical key. Fixed by tracking raw key
codes and deriving "is this action held" from whether *any* of its mapped
codes are still down — holding both W and the up arrow, then releasing
just one, now correctly leaves the action held.

**A related, if secondary, bug in delta-time handling**, found while
auditing "physics timing" as asked: the frame-rate cap added in the
performance pass (see docs/PERFORMANCE.md) was only ever handing systems
the single latest tick's delta, not the actual elapsed time since the last
*processed* tick. At a 30fps cap on a 60Hz display, that meant movement
(and everything else driven by `dt`) silently ran at roughly half the
intended speed the moment a cap was enabled — an under-counting bug, the
opposite of the over-counting one the existing clamp already guarded
against. Fixed by accumulating the real elapsed time across however many
ticks were skipped, not just using the most recent one.

Both fixes are in `src/utils/InputManager.js` and `src/core/Engine.js`;
neither needed any change to `CameraSystem` itself, which was never the
problem.

## The music library: a real architectural cause, not a suppressed symptom

Chrome's "Blocked attempt to create a WebMediaPlayer as there are too many
WebMediaPlayers already in existence" traced to `MusicSystem.resolveDuration`
— the function that lazily reads a song's duration the first time it's
shown in a list. Every song row calls this independently (see
`ui/domHelpers.js`), with no coordination between them, and each call used
to create a brand new `Audio()` element to read the file's metadata.
Opening a view with a few hundred songs meant a few hundred concurrent
`Audio()` probes, each holding a real native media-decoder resource —
exactly what that Chrome limit exists to prevent. The one *persistent*
playback element (the actual thing the Workshop's music is meant to play
through) was never the issue; it was always exactly one, as designed.

Fixed with a small, bounded pool of reusable probe elements
(`MAX_CONCURRENT_DURATION_PROBES = 3`) and a request queue: however many
songs need a duration resolved, at most three temporary `Audio` elements
exist at any moment, and each is properly released
(`removeAttribute("src")` + `.load()`, the standard way to free a media
element's underlying resource) and returned to the pool for the next
song rather than discarded. A small de-duplication set avoids queuing the
same song twice if a view gets rebuilt before its first request finishes.
Durations for a very large library now fill in progressively rather than
all resolving in one burst — a deliberate trade, and a far better one
than the alternative.

## Workshop save versioning and migration

The actual bug reported — the reading chair staying in its old position on
existing saves after the Workshop's own layout had moved it — traced back
to a deeper problem: **furniture position and rotation were being saved
and blindly restored on every load**, even though nothing in the Workshop
has ever let a player actually customise it. That treated a Workshop
*default* (something meant to improve freely as the Workshop itself is
updated) as if it were player-owned data (something that must never
change once saved). Once any save existed, a genuine Workshop layout
improvement — the reading corner's earlier redesign, this pass's door,
light switch, and chair changes — silently never reached it, because the
frozen old position from whenever that save was first made always won.

**Furniture placement no longer round-trips through the save file at
all.** `FurnitureSystem` no longer registers `persistence:save`/
`persistence:load` handlers for position or rotation — see its own
comment for the seam a future "move furniture in Build Mode" feature
should use instead (a small, explicit *overrides* map, written only for
pieces someone has actually repositioned, with every other piece
continuing to track the Workshop's current default). Builder-created
objects (`WorldObjectsStore`) were never affected by this at all — that's
a genuinely separate, always-player-owned system, and stayed untouched.

**A real, numbered save-version system now exists** (`src/systems/
SaveMigrations.js`): every save envelope carries a version number, and
`migrateEnvelope()` walks it forward through however many migrations are
needed to reach the current version, one step at a time — not a single
hard-coded "if old, do X" check, but a real registry future Workshop
updates can keep adding entries to. The v1→v2 entry is the furniture-fix
above, made concrete: it clears the old frozen positions out of an
existing save so they don't linger as dead data. A migrated save is
written back to storage immediately (not left to the next natural
autosave), so the corrected shape is what's actually sitting there from
that point on.

**Not every version needs a migration entry.** A version that only added
a brand-new store or field doesn't need one at all — a field simply
absent from an old save is handled the exact same way a first-ever launch
already is (`data?.field ?? default`), which is why `MusicLibraryStore`,
`SettingsStore`, `PlayerAppearanceStore`, and everything else already
degrade gracefully without a single migration ever being written for
them. A migration is only needed when a save's *existing* data would mean
something different, or actively wrong, under the new shape — exactly the
furniture case above.

## Settings: Danger Zone

A new tab, alongside Graphics/Performance/Display/Controls/Audio — the
long-term maintenance home the brief asked for, not a one-off addition.
Deliberately not a new system of its own (`src/main.js`'s
`dangerZoneActions` is a plain object of four functions, each calling
methods that already exist on the relevant store) — this is four buttons
wired to existing capabilities, not an ongoing responsibility that needs
its own file.

- **Clear Workshop Cache** — unregisters the service worker and clears
  the Cache Storage API, forcing a fresh download of the Workshop itself
  next load. Doesn't touch `localStorage` or IndexedDB at all; every
  project, setting, and outfit survives it untouched.
- **Reset Workshop Settings** — `SettingsStore.resetToDefaults()`
  (already existed, from the performance pass) back to Graphics/
  Performance/Display/Controls/Audio defaults.
- **Reset Player Data** — the live appearance and every saved outfit back
  to nothing, plus cleaning up whichever texture images were only ever
  referenced by what just got reset (the same reference-counting
  `cleanupTextureIfUnused` logic the Wardrobe's own texture removal
  already uses — see docs/PLAYER.md).
- **Factory Reset Workshop** — the nuclear option: clears
  `localStorage` entirely, deletes both IndexedDB databases (music folder
  handles, player textures), clears the cache the same way "Clear
  Workshop Cache" does, then reloads — a genuinely fresh first-launch
  state.

Every action confirms before doing anything (`window.confirm`, the same
mechanism outfit deletion already uses); Factory Reset specifically asks
twice, given how total and irreversible it is.

## Interior and lighting

- **Front doors**: replaced the placeholder single slab (which slid
  straight up into a housing — never a real hinge) with two real,
  outward-opening French door panels, each pivoted at its own hinge (the
  outer jamb) rather than its own centre — the same "a pivot the mesh
  hangs from, separate from its own centre" idea the player rig's joints
  already use. Divided-lite glazing over a solid lower panel, using the
  same glass material the windows already have, gives this a genuine
  French-door read rather than two plain slabs.
- **Light switch**: moved from the west wall to the south wall, to the
  left of the front doors as you walk in facing into the room — and,
  since the switch's plate happens to be thin along its own Z axis (matching
  a wall whose face runs along X), this incidentally fixes a small
  pre-existing mismatch where it sat on a wall its own shape didn't
  really suit.
- **Reading chair**: rotated 180° so it faces the bookshelf and music
  corner instead of away from them. A pure orientation change — a 180°
  rotation of a rectangle produces an identical bounding box, so its
  footprint, collision, and interaction reachability are completely
  unaffected.
- **Interaction radius**: the front doors, both windows, and the notebook
  were all tightened noticeably below the standard tiers established in
  the original World pass (doors 2.4m → 1.6m, windows 2.0m → 1.3m,
  notebook 2.0m → 1.1m) — none of them need triggering from as far away
  as a piece of furniture does. See the note added to docs/WORLD.md's own
  interaction-distance section, since this pass moved those three values
  below what that document originally described.
- **Ambient lighting**: raised the hemisphere/ambient light floor
  (`TimeOfDaySystem`'s `hemiIntensity`/`ambientIntensity` curve) so corners
  away from a direct light source read as dim, not near-black — most
  noticeably at night, where the previous floor left almost nothing to
  see by except right next to a lamp. Daytime maximums only moved a
  little; the point was fixing the dark corners and the night floor
  specifically, "a more naturally lit Workshop," not a brighter one
  overall. The sun's directional dominance and the practical lights'
  point-light falloff are both untouched, so a lamp — or a sunlit window —
  still reads as meaningfully brighter than its surroundings, not
  flattened into the new, higher floor.

## General audit: checked and found genuinely fine

- **`Engine.pause()`/`resume()`** exist but have no caller anywhere in the
  codebase — not a bug, just worth recording as unused, in case a future
  pause-menu feature is what finally calls it.
- **Tab-hidden autosave, `beforeunload`, and the periodic autosave timer**
  were all re-checked against the migration path above and don't need any
  change — they call `save()` directly, which always writes the *current*
  (already-migrated, already-correct) in-memory state, never a stale
  on-disk copy.

## Refinement Pass A (Version 2, Phase 23a)

"Walk through the Workshop as though you are preparing it for its first
public release." A second refinement pass, well after Version 2's major
systems existed — six real, separately-investigated issues, each with its
own root cause rather than a surface patch. See each system's own doc for
where it's normally covered; this section is the "what changed and why,
gathered in one place" account the brief specifically asked for.

**Factory Reset didn't fully reset — and neither did Backup Import,
though nobody had reported that one yet.** `PersistenceSystem.save()` is
wired to `beforeunload` for the ordinary "don't lose the last few seconds
of work on tab close" case. Both `factoryReset()` and `importBackup()`
call `window.location.reload()` themselves, which fires `beforeunload`
too — and that fired *after* `factoryReset()`'s own `localStorage.clear()`,
or *after* `importBackup()`'s freshly-written imported data, silently
re-serialising whatever every provider's still-in-memory (old, pre-reset
or pre-import) state happened to be, straight back into `localStorage`,
moments before the reload that was supposed to leave it clean. Not a
partial reset limited to Builder blocks and terrain specifically — every
provider, every time either action ran; those two were just the most
visually obvious ones to notice missing. A single `_suppressSave` guard,
set before either method does anything else, closes the race for both at
once. See `PersistenceSystem.js`'s own `save()` comment for the complete
account.

**The moon was tracing the wrong half of its own cycle.** The offset
between the sun's position and the moon's was being *added*
(`currentTime + phase * 24`) when it needed to be *subtracted* — a real
first-quarter moon culminates six hours *after* solar noon, not before.
Verified numerically against `solarPosition()` directly: at phase 0.25,
the old formula peaked at 6am, exactly where a *last*-quarter moon
belongs. A previous investigation (this doc's own "Interior and lighting"
section's sibling account, and `docs/ROADMAP.md`'s Phase 13 entry) had
concluded the formula was already correct — but it verified specifically
at phase 0 and phase 0.5 via `moonPhaseOverride`, the two degenerate
points where adding or subtracting a 0- or 12-hour offset lands on the
exact same result modulo 24. Every other phase was tracing the
mirror-image lunar cycle instead of the real one, which reads as "vaguely
wrong, sometimes tracks the sun too closely" rather than obviously
broken — exactly the report that reopened this. See
`TimeOfDaySystem.js`'s own moon-position comment for the full numeric
account.

**Crouching lowered the camera too far — because the constant governing
it was never actually what its own comment claimed.** `CROUCH_HEIGHT_
REDUCTION`'s comment said the crouch drop was "proportional to the
character;" the code subtracted a fixed 0.5m from *any* standing height,
never proportional to anything. A flat 0.5m off a typical ~1.65m standing
height is a much bigger relative drop than a genuinely proportional
reduction would be — which is what was pushing the camera low enough to
feel like it was sinking into the model. Replaced with
`CROUCH_HEIGHT_RATIO` (0.78), what the comment always said this should
have been, fixing the complaint for every body proportion the Wardrobe
can produce at once, not just retuning one fixed number for the
default-sized case. See `CameraSystem.js`.

**Ladders: a real usability bug, and an honest account of the intended
design.** The climbable zone was the ladder's own raw visual bounding
box — for the Construction Library's ladder piece, about 8cm deep, rail
to rail. Every other interaction zone in the Workshop is deliberately
more generous than the geometry it's attached to; ladders were the one
exception, requiring near-pixel-perfect positioning to register at all.
`LadderSystem` now pads the zone by a generous, fixed margin (22cm
horizontal, 12cm vertical) before using it for detection — the most
likely real explanation for "walked right up to it and it didn't do
anything." *Ladders were already functionally wired* — a previous phase
(see `ConstructionLibrary.js`'s own comment on the ladder piece) already
found and fixed the actual "ladders don't work at all" bug, where the
library piece never carried its own climbable behaviour. The intended
interaction, for the avoidance of any remaining doubt: walk into a
ladder's zone and climbing begins automatically — no key prompt, no
button press, the same way physically walking up to a real ladder and
starting to climb doesn't ask permission first. Hold forward to climb up,
back to climb down (facing the ladder to ascend reads more naturally than
a dedicated key, and needed no new input binding at all); release either
to stop and hang in place. Strafe drifts gently sideways without leaving
the ladder outright. This was a genuine bug in detection, not user error
or design ambiguity in the interaction itself.

**AI: the timeout was never the real problem.** Both the Connection Test
and real conversation calls already carry a 180-second timeout, generous
enough for a legitimate cold model load on modest hardware — a previous
phase had already established that number for the same reason this
phase's brief names again. Bumping it further wouldn't have helped: a
longer timeout only makes the *wait* more tolerable, it never makes the
wait shorter, and doesn't stop the same slow load from happening again
every time a model gets unloaded from inactivity. The actual fix is not
needing that cold load to happen in the middle of a conversation at all:
`AIConnectionManager` now warms whichever model the active resident
profile is configured to use — immediately when it becomes active, and
then on a recurring ping comfortably inside Ollama's own 5-minute default
unload window, so a model genuinely in use never gets the chance to cool
down between messages. `keepAliveEnabled`, on by default and persisted,
is a real, configurable toggle in Mission Control's own Connection
section, for anyone who'd rather Ollama managed its own memory, or is
running something memory-constrained enough that holding a model warm
between messages isn't welcome. See `AIConnectionManager.js`'s own class
comment.

**AI profile export/import — reviewed, found already complete.**
`ResidentProfileStore.exportProfile()`/`importProfile()` already capture
every meaningful field a profile has (identity, traits, behaviour
configuration and dials, memory configuration, embodiment, model,
provider, and the expression-set reference), deliberately excluding
anything that would make a shared profile less than fully portable to a
different Workshop installation (no connection details/API keys, no
personal conversation history — both live in entirely separate stores
that were never part of a profile to begin with) or that would make
importing someone else's file dangerous (always creates a new profile
with a fresh id; never overwrites anything by id). Confirmed rather than
rebuilt.

**The startup experience could look completely frozen for the entire
loading period.** The real cause: the entry screen's "Step inside" button
had *no click handler attached at all* until the entire async boot chain
(`engine.init()`, spawning every saved object, resolving player
textures, `engine.start()`) had already finished — a control that looked
interactive and silently did nothing if pressed too soon, for however
long boot happened to take. The button is now wired immediately, at the
top of `main.js`, before any of that async work begins, and responds
instantly either way: if boot's already done, it enters right away; if
not, it gives immediate visual feedback ("Preparing…", disabled, a status
line explaining what's happening) and enters automatically the moment
boot actually finishes, rather than requiring a second press. A gentle
breathing status line ("Preparing the Workshop…" → "Finishing touches…" →
"Ready when you are") is visible from the very first paint, not just
after a delay. Deliberately *not* attempted: starting the render loop
itself earlier so an atmospheric world preview shows behind the entry
screen while it loads. `engine.start()` is what actually begins
`renderer.setAnimationLoop()` — moving that earlier means rendering a
scene before every system that populates it has finished, a real risk of
visible pop-in or partially-initialised geometry that this pass couldn't
verify without being able to render and watch it happen. Left as a named,
future opportunity rather than a change shipped without being able to
see it work.

### Remaining issues worth revisiting

- **A true atmospheric loading background** (see the startup section
  above) — needs either a genuinely progressive `engine.init()` that can
  report partial completion, or a deliberately separate, lightweight
  "preview scene" rendered before the real one — either is a bigger
  architectural decision than this pass's own scope.
- **Ladder top/bottom transitions** — climbing is clamped to the padded
  zone's own vertical bounds, which now extends slightly past the visual
  ladder (12cm) for a smoother step-on/step-off feel at platform height.
  Whether that's generous enough at every ladder height and pitch a
  future Builder-designed ladder might use is worth re-checking once more
  than one ladder shape actually exists in the wild.
- **Crouch camera** — `CROUCH_HEIGHT_RATIO` (0.78) is a reasoned default,
  not something this pass could visually tune against a rendered frame.
  Worth a deliberate playtest pass once one's possible.

## Version 2 Sign-Off (Phase 23c)

The final engineering phase of Version 2 — "review the Workshop as
though you inherited it from another engineering team." A complete
codebase audit rather than a targeted bug hunt, closing out the
refinement series this section itself belongs to.

**Dead code, found by scripted cross-reference rather than by memory.**
Every exported name in `src/` was checked against every other file for
an actual reference — 437 exports checked, 24 flagged with zero
cross-file usage. Manually verifying each of the 24 mattered: most
were genuinely fine (constants and helpers used repeatedly *within*
their own file, exported for a future caller that hasn't needed them
yet — normal, healthy encapsulation, not a defect), and two —
`solveTwoBoneIK()` and `IDENTITY_PLAYER_SKELETON_MAP` — turned out to
be deliberate, explicitly-documented forward-looking infrastructure
("the architecture should be established even where complete
implementations are deferred"), which this audit left untouched on
purpose. Three were genuinely dead, each with the same tell as
`softBox()`/`Materials.ground()` before them: a docstring claiming an
integration that checking directly showed never existed.

- `PageRegistry.schemeOf()` — a sibling to the actively-used
  `isInternalUrl()`, with zero callers anywhere, including internally.
- `DiagnosticsService.HEALTH_LEVELS` — never read as a value anywhere,
  only mentioned in a comment, and redundant with `SEVERITY`'s own keys.
- `PlaceholderFactory.computeFootprint()` — a one-line
  `Box3.setFromObject()` wrapper whose own docstring claimed it was
  "used by collision + interaction radius helpers." Every real caller
  of that exact pattern (`WorldObjectsSystem.js`, `LadderSystem.js`)
  already calls `Box3.setFromObject()` directly; nothing ever called
  this wrapper.

All three removed. A fourth, `AlignmentTools.positionsBounds()`, had a
stale cross-reference (claiming `BuildModeSystem._measureSelection()`
already combined the two — checked directly, and it doesn't, it has
its own separate min/max computation over a different input shape) —
corrected rather than removed, since the function itself is reasonable,
on-topic infrastructure for that file's own domain even though nothing
calls it yet.

**Zero unused imports**, found by the same scripted method applied to
every `import { ... }` statement in the codebase — a clean result, not
a suspicious one; import hygiene is the kind of thing that's easy to
catch in the moment, unlike cross-file dead exports.

**Documentation staleness, found and fixed in two places.**
`assets/README.md` still claimed "no binary asset files... yet," while
four PWA icons (added in a later phase for install prompts and
favicons) had quietly made that untrue. `docs/RESIDENT.md`'s own "A
quiet habit" section pointed at "the README's own 'One contribution'
section" — writing that had actually moved to `docs/HISTORY.md` phases
ago, with nothing updating the cross-reference to follow it. Both
corrected. `docs/ARCHITECTURE.md`'s own docs index was checked against
the actual `docs/` folder directly (every file present, nothing listed
that doesn't exist) — accurate, confirmed rather than assumed.

**Naming — reviewed, deliberately left alone.** "App"/"application"
terminology is used consistently across roughly fifteen files, every
one following the identical `createXApp()` factory shape this project
established early and never deviated from. A rename to "Tool" or
"Station" would touch dozens of files and every doc that references
them, for a naming preference rather than a genuine clarity problem —
exactly the "churn without value" this phase's own brief warned
against. Left unchanged; consistency (which this codebase already has)
outranks a naming preference (which is subjective) here.

**Performance, reliability, and duplicate-logic** — reviewed rather
than rewritten. A handful of small, single-purpose `clamp*()` variants
across different files (`clamp01`, `clampUnit`, `clamp01to2`,
`clampToRadius`) look superficially similar to `MathUtils.clamp()` but
each does something genuinely distinct (a fallback for non-numeric
input, a different fixed range, vector-radius clamping rather than
scalar) — reasonable, self-contained specialisations, not harmful
duplication worth unwinding. No `console.log` debug remnants, no
`TODO`/`FIXME` markers, no stray `debugger` statements anywhere in
`src/` — a genuinely clean result from a direct search, not an
assumption. A spot-check of per-frame `update()` loops found no new
DOM-query-in-a-hot-path issues beyond what earlier phases (Visual
Identity, Sound & Presence) had already addressed.

