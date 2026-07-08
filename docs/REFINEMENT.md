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
