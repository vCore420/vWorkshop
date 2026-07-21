# Persistent World

"The player should feel like they are returning to an existing place
rather than loading a save file." The Workshop already remembered a
great deal before this phase — every store, every system, its own save
key. What was missing was the second half of that sentence: not just
*restoring* what was true when the player left, but giving every system
a chance to answer one question first — "what should I have been doing
while the player was away?"

## Shared Time Service

"Please avoid every system individually calculating elapsed time.
Instead, introduce a shared persistence service." `WorldTimeService.js`
is that service, and it computes the one number every continuity-aware
system actually needs exactly once, in exactly one place.

**Timing, precisely.** `PersistenceSystem.js` already wrote `savedAt`
into every save envelope, long before this phase — nothing new is
stored for this. Right after `_loadFromStorage()` finishes applying
every system's own saved state (every `persistence:load` handler has
already run, since `EventBus.emit()` is fully synchronous —
`Engine.init()` itself awaits every system's own `init()` before
`"engine:ready"` ever fires, so every listener is already registered by
the time any of this happens), `PersistenceSystem` emits
`"world:continuityReady"` with the raw timestamps. `WorldTimeService`
turns that into one clean, reusable `"world:continuity"` event:

```js
{ elapsedMs, elapsedSeconds, cappedElapsedSeconds, isFirstSession }
```

Every continuity-aware system listens for this exactly once per
session. A system that initializes later, or simply prefers to pull
instead of listen, can call `worldTimeService.getContinuity()` for the
same values directly.

**A deliberate cap, not true simulation.** `cappedElapsedSeconds` never
exceeds six hours (`MAX_CATCHUP_SECONDS`) — "simple continuity is
sufficient" means a Workshop reopened after a month shouldn't try to
simulate weeks of wandering; it picks something newly plausible, exactly
the same way it would after a shorter, ordinary gap. `elapsedSeconds`
(uncapped) is still exposed for anything that only cares whether the gap
was long at all, without needing the exact duration.

## World Continuity

"Systems should have the opportunity to continue naturally before the
player arrives... nothing should appear to have been waiting for the
player." Concretely, that means: a `"world:continuity"` listener, not a
UI action, not something the player triggers — it fires automatically,
once, before the player's own first frame in the world, and by design
produces no visible transition to watch. Bubble and Beings don't
*travel* to their new positions on load; they simply already are there,
because whatever journey led them there happened while nobody was
watching. Showing that journey would undercut the very thing this phase
is about — nothing should feel like it was staged for the player's
benefit.

## Bubble Continuity — restored, Version 4 Phase 7a

"Bubble should never teleport randomly. Its position should make sense
based upon elapsed time... arrive at a believable location when the
Workshop loads." `BeingController._applyResidentContinuity()` is the
current mechanism — deliberately not a real simulation of every
idle-location hop that would have happened, but a single, honest answer
instead: has enough time passed that Bubble would plausibly have moved on
from exactly where she was left? Below `MIN_REST_SECONDS` (90 seconds),
no; past it, a genuinely new named idle location (weighted the same way
an ordinary autonomous pick would be — see `docs/RESIDENT.md`'s own "A
quiet habit"), arrived at directly via `setDraggedPosition()`/
`setDraggedLookAt()`, no travel ease.

**A real, honest regression through the end of Version 4 Phase 7,
closed the same phase's own follow-up.** `ResidentController.js`'s
original version of this was deleted with nothing replacing it for one
phase — she resumed exactly where she was left regardless of how long
the gap was, since she went through the generic Being reposition below
like any other, which turned out to be a no-op for her specific movement
style (see "Being Continuity," below). Verified live: driven directly
below the 90-second threshold (a genuine no-op — identical position and
location id) and above it (a new named location, position snapped
exactly to that location's own coordinates, `ResidentMovement`'s own
internal state kept in sync with no desync artifact).

## Being Continuity

"This does not require advanced AI. Simple continuity is sufficient."
`BeingController._applyContinuity()` — a Being's wander/patrol target is
already just a point within its own home radius, not a named location to
choose between, so continuity is exactly one call to the same
`pickWanderTarget()` its ordinary wandering already uses. A
`movementStyle: "static"` Being never moves regardless of elapsed time,
matching exactly what it would have done if the player had stayed and
watched the whole time. `wanderTarget`/`patrolRoute` both reset to `null`
afterward, so the next ordinary wander/patrol pick starts fresh from the
new position rather than reaching back toward a now-irrelevant old
target.

**A `movementStyle: "residentTravel"` instance is routed to
`_applyResidentContinuity()` instead** (see "Bubble Continuity," above)
— through the end of Version 4 Phase 7, before that method existed, this
generic pass ran for a `residentTravel` Being too, and was a genuine
no-op for it: whatever position it set got overwritten before the first
rendered frame by `_updateResidentTravel()`'s own lazy `ResidentMovement`
construction, which seeded itself from the *persisted*
`residentState.currentPosition` with no awareness continuity had just
run. Harmless at the time (no crash, no visible jump) — Phase 7a's own
explicit routing is what actually closed the gap, not a change to this
generic pass itself.

## Environment Continuity

**Weather already had this, then Version 3 Phase 11 folded it into the
shared source.** `EnvironmentSystem._catchUpDynamic()` predates
`WorldTimeService` — it originally computed its own `Date.now() -
_enteredAt` on every load and stepped `TRANSITIONS` forward (capped at
`MAX_CATCHUP_STEPS`) however many times would plausibly have happened.
That answered "what should the weather have been doing while the player
was away?" correctly on its own terms, but it was a second, independently
invented "how long were we gone" calculation sitting right alongside
`WorldTimeService`'s already-canonical, already-capped one — the two
caps (`MAX_CATCHUP_STEPS` and `WorldTimeService`'s own
`MAX_CATCHUP_SECONDS`) existed for the same underlying reason without
ever actually sharing anything. Phase 11 moved the catch-up itself onto
a `"world:continuity"` listener, driven by `cappedElapsedSeconds` —
`MAX_CATCHUP_STEPS` remains as a real, meaningful *inner* bound now that
the outer one is shared, not removed. A genuinely first-ever session
(`isFirstSession`) also gets an explicit, deliberate "clear" opening
rather than relying on the constructor's own default to happen to read
that way.

**Time was the real gap.** `TimeOfDaySystem`'s default `"realtime"` mode
already needed nothing either — it computes directly from the actual
clock every frame, so there's nothing to catch up on, ever. `"simulated"`
mode (only ever entered via Settings' own "Set Time" action) is the one
that stored a fixed `currentTime` and would otherwise have resumed
exactly where it was left, frozen, no matter how long the actual gap
was. It now advances `currentTime` by `cappedElapsedSeconds *
speedMultiplier`, converted to game-hours and wrapped, the moment
`"world:continuity"` fires — consistent with what that same simulated
clock would have reached had the Workshop simply kept running the whole
time.

## Music

The Workshop's own playback persistence needed no changes at all —
resuming a paused track exactly where it was left, rather than
advancing it by however long the player was away, is already the
natural, expected behaviour (nobody wants their music to jump ahead
based on how long they stepped away). Verified independent of
`WorldTimeService`/`"world:continuity"` entirely; no conflict, nothing
to wire up.

## Import & Export (Workshop Workflow / Workshop Personality phases)

"Importing and exporting Workshop data should feel consistent
throughout the project." Six independent export/import pairs exist, all
sharing one shape rather than each growing ad hoc:

- **A whole-Workshop backup** — `PersistenceSystem.exportBackup()`/
  `importBackup()`. Everything: every project, object, outfit, setting,
  the music library's own preferences, all of it, as one JSON file. Now
  in Settings' own "Workshop Data" section (General tab) — moved from
  two buttons that used to sit permanently on the main HUD, since this
  is ordinary data management, not something that needs to be
  always-on-screen the way a mode toggle does.
- **A single AI profile** — `ResidentProfileStore.exportProfile()`/
  `importProfile()`, in AI Mission Control's own Profiles section. A
  named resident's entire configuration — identity, model/provider,
  behaviour tuning, traits, memory, embodiment settings, and (Version 3,
  Phase 8b) which Workshop Functions it's granted — as its own small,
  genuinely shareable file, independent of anything else in a given
  Workshop's save data.
- **A single Expression Set** (Workshop Personality phase) —
  `ExpressionSetStore.exportSet()`/`importSet()`, in AI Mission
  Control's own new Expressions section — a "pack" of hand-drawn pixel
  expressions, exportable and shareable the identical way a profile is.
- **A single Blueprint** (Version 3, Phase 7 — "Sharing the Workshop") —
  `BlueprintStore.exportBlueprint()`/`importBlueprint()`, in the Builder
  Phone's own Blueprints tab. See `docs/WORLDBUILDER.md`'s own "Sharing a
  Blueprint" section.
- **A single custom Calculator** (Version 3, Phase 7) —
  `ToolsStore.exportCustomCalculator()`/`importCustomCalculator()`, in
  the Tools panel's Calculator Builder. A calculator's formulas are
  plain data (`ToolFormula.js`'s hand-rolled tokenizer, no `eval()`), so
  nothing about importing one is any more sensitive than importing a
  profile.
- **A single Atmosphere Profile** (Version 3, Phase 7) —
  `AtmosphereProfileStore.exportProfile()`/`importProfile()`, in
  Settings' own Atmosphere Profiles section — including the three
  built-in profiles, not only custom ones, since `exportProfile()` reads
  through `getProfile()` rather than the custom-only `get()`.

**Every envelope carries a `type` field** (`"workshop-backup"` /
`"workshop-ai-profile"` / `"workshop-expression-pack"` /
`"workshop-blueprint"` / `"workshop-calculator"` /
`"workshop-atmosphere-profile"`) specifically so each importer can
recognise one of the *other five* exports and say so plainly — "that's
an AI profile export, not a Workshop backup" — rather than failing to
parse an otherwise well-formed JSON file with a generic error. **All six
validate before touching anything**: a missing/non-numeric version, an
unrecognised `type`, or (backup only) a `version` newer than
`CURRENT_SAVE_VERSION` (see `SaveMigrations.js`, which only ever
migrates *forward*) all refuse with a specific message rather than
silently importing a shape parts of this Workshop version might not
fully understand — a newer-than-current backup asks for explicit
confirmation instead of an outright refusal, since it may still import
perfectly well. **All six normalise on import** using the exact same
kind of defensive per-field defaulting `load()` already trusts for a
save restored from `localStorage` — a profile, expression pack,
blueprint, calculator, or atmosphere profile exported from an older
Workshop version, or shared by someone else's Workshop entirely, still
imports as something complete and sensible rather than one with fields
quietly `undefined` (an expression pack's own unknown expression ids,
from a hypothetical future ninth expression, are simply dropped rather
than kept as data this version has no use for; a Blueprint's own
malformed object entry falls back to `WorldObjectsStore.js`'s own
default offset/rotation/scale rather than crashing the Builder). **Every
import is always additive** — a fresh id, never overwriting anything
already there, the same "Duplicate," never "Replace" instinct
`ResidentProfileStore.duplicate()`/`ExpressionSetStore.duplicate()`
already follow. A backup import reloads the page on success, the
simplest way to guarantee every open panel reflects the newly imported
state consistently, rather than trusting each one to notice a
full-state swap happening underneath it live; the other five apply
immediately in place since each only ever adds one new item to its own
store.

**A unified Export button, independent of these six panels.** Every one
of these six kinds (plus Beings, whose own export/import predates this
phase) is also a Workshop Asset — `AssetService.exportAsset()` is the
one generic entry point that calls whichever kind's own `exportItem()`
and downloads the result, reachable from that asset's own Browser
detail page rather than only from its native panel. See
`docs/ASSETS.md`'s own "Export" section for the full mechanism, and
`docs/BROWSER.md` for how a detail page exposes it.

**One deliberate exception**: `WorkshopEventLog.exportLog()` (Workshop
Diagnostics phase) follows the identical `type`-tagged envelope shape
but is export-only — there's no `importLog()`, since a log recording
what happened in *this* Workshop session has no meaningful way to import
into another one. Unlike a profile or expression pack, nothing in an
event log is meant to be reused elsewhere; it's a record, not a
shareable creation.

## Workshop Projects — architecture only

"Please begin preparing for long-running Workshop activities... this
phase does not need to fully implement these future systems. Simply
prepare the architecture for them." `WorkshopProjectStore.js` is that
preparation: a project is `{id, name, kind, startedAt, durationSeconds}`,
and `progress()` is a pure function of `Date.now()` — a real timestamp
and a duration, not a per-frame timer that would freeze the moment the
Workshop itself isn't running. A project genuinely finishes on schedule
whether or not anyone had the Workshop open at that moment. Deliberately
not wired to any UI yet — no workbench action creates one, nothing
displays one — ready for a future Workbench/Construction/Automation
phase's own "start a project" action to call `create()` without this
file needing to change at all.

## Known simplifications (by design, for this phase)

- **A single-decision continuity model**, not a real simulation — see
  Bubble/Being continuity above. Deliberate, not a shortcut taken under
  pressure: modelling intermediate states nobody will ever see has no
  payoff.
- **Elapsed time is capped at six hours** for anything that reacts to
  `cappedElapsedSeconds` — a long weekend away produces the same
  "something plausible changed" result as a month away would.
- **Workshop Projects has no UI yet** — by the brief's own explicit
  instruction; this phase prepares the architecture, not the feature.

## Future extension points

- **Multiple Buildings** — every continuity handler here is written
  against the *stores*, not anything Workshop-singular; a second
  building's own Beings already participate in continuity the moment
  they exist, with no changes to this architecture.
- ~~**Additional Residents**~~ — **fully resolved, Version 4 Phase 7/7a.**
  Any number of resident-capable Beings genuinely get their own isolated
  `BeingResidentStateStore` bundle (verified live: two distinct instances
  held two distinct conversations with two distinct bundle objects), and
  each gets a genuinely believable load-time reposition too — "Bubble
  Continuity," above, applies to any `residentTravel` instance, not
  Bubble by name.
- **Automation, Workbench Projects, Construction** — `WorkshopProjectStore`
  is exactly the seam; a future phase adds the UI and the "what does
  100% actually produce" logic, not a new persistence architecture.
- **Plugin Systems** — a plugin's own system can listen for
  `"world:continuity"` the same way any core system does; nothing about
  the event is core-Workshop-specific.
- **Outdoor Expansion** — weather/time continuity already covers the
  whole world, indoors or out, since neither one is scoped to the
  Workshop's own room specifically.
