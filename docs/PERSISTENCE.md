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

## Bubble Continuity

"Bubble should never teleport randomly. Its position should make sense
based upon elapsed time... arrive at a believable location when the
Workshop loads." `ResidentController._applyContinuity()` is deliberately
not a real simulation of every idle-location hop that would have
happened — the player never saw any of them, so modelling each one has
no payoff. It's a single, honest answer instead: has enough time passed
that Bubble would plausibly have moved on from exactly where it was
left?

Below `MIN_REST_SECONDS` (90 seconds — the shortest Bubble would ever
actually rest somewhere, already a real constant `ResidentMovement.js`
uses for its own ordinary wandering), the answer is no — reopening the
Workshop moments after closing it shows Bubble exactly where it was, not
somewhere new, or "nothing should feel scripted" stops being true. Past
that threshold, `_applyContinuity()` picks one new idle location (never
the one it was already at) and arrives there directly, via the same
`setDraggedPosition()`/`setDraggedLookAt()` primitives dragging Bubble
already uses to reposition it instantly without an in-progress travel
ease fighting the new position.

## Being Continuity

"This does not require advanced AI. Simple continuity is sufficient."
`BeingController._applyContinuity()` is simpler still than Bubble's own
— a Being's wander/patrol target is already just a point within its own
home radius, not a named location to choose between, so continuity is
exactly one call to the same `pickWanderTarget()` its ordinary wandering
already uses. A `movementStyle: "static"` Being never moves regardless
of elapsed time, matching exactly what it would have done if the player
had stayed and watched the whole time. `wanderTarget`/`patrolRoute` both
reset to `null` afterward, so the next ordinary wander/patrol pick
starts fresh from the new position rather than reaching back toward a
now-irrelevant old target.

## Environment Continuity

**Weather already had this.** `EnvironmentSystem._catchUpDynamic()`
predates this phase — `_enteredAt` is a real, persisted timestamp, and
on load it steps `TRANSITIONS` forward (capped at `MAX_CATCHUP_STEPS`)
however many times would plausibly have happened in the elapsed real
time. Nothing needed to change here; it already answers "what should
the weather have been doing while the player was away?" correctly, and
doesn't need `WorldTimeService` at all, since "how long has the current
weather state been active" is a genuinely different question from "how
long since the last session," answered independently and correctly
already.

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
throughout the project." Three independent export/import pairs exist,
all sharing one shape rather than each growing ad hoc:

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
  behaviour tuning, traits, memory and embodiment settings — as its own
  small, genuinely shareable file, independent of anything else in a
  given Workshop's save data.
- **A single Expression Set** (Workshop Personality phase) —
  `ExpressionSetStore.exportSet()`/`importSet()`, in AI Mission
  Control's own new Expressions section — a "pack" of hand-drawn pixel
  expressions, exportable and shareable the identical way a profile is.

**Every envelope carries a `type` field** (`"workshop-backup"` /
`"workshop-ai-profile"` / `"workshop-expression-pack"`) specifically so
each importer can recognise the *other two* exports and say so plainly
— "that's an AI profile export, not a Workshop backup" — rather than
failing to parse an otherwise well-formed JSON file with a generic
error. **All three validate before touching anything**: a missing/
non-numeric version, an unrecognised `type`, or (backup only) a
`version` newer than `CURRENT_SAVE_VERSION` (see `SaveMigrations.js`,
which only ever migrates *forward*) all refuse with a specific message
rather than silently importing a shape parts of this Workshop version
might not fully understand — a newer-than-current backup asks for
explicit confirmation instead of an outright refusal, since it may
still import perfectly well. **All three normalise on import** using
the exact same functions `load()` already trusts for a save restored
from `localStorage` — a profile or expression pack exported from an
older Workshop version, or shared by someone else's Workshop entirely,
still imports as something complete and sensible rather than one with
fields quietly `undefined` (an expression pack's own unknown expression
ids, from a hypothetical future ninth expression, are simply dropped
rather than kept as data this version has no use for). **A profile or
expression-set import is always additive** — a fresh id, never
overwriting anything already there, the same "Duplicate," never
"Replace" instinct `ResidentProfileStore.duplicate()`/`ExpressionSetStore
.duplicate()` already follow. A backup import reloads the page on
success, the simplest way to guarantee
every open panel reflects the newly imported state consistently, rather
than trusting each one to notice a full-state swap happening underneath
it live.

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

- **Multiple Buildings / Additional Residents** — every continuity
  handler here is written against the *stores*, not anything
  Workshop-singular; a second building's own Beings, or a second
  resident, already participate in continuity the moment they exist,
  with no changes to this architecture.
- **Automation, Workbench Projects, Construction** — `WorkshopProjectStore`
  is exactly the seam; a future phase adds the UI and the "what does
  100% actually produce" logic, not a new persistence architecture.
- **Plugin Systems** — a plugin's own system can listen for
  `"world:continuity"` the same way any core system does; nothing about
  the event is core-Workshop-specific.
- **Outdoor Expansion** — weather/time continuity already covers the
  whole world, indoors or out, since neither one is scoped to the
  Workshop's own room specifically.
