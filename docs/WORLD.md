# The world

This phase took the workshop from "one sealed room" to "the first building
in a continuous, walkable world." It's really three connected pieces: a
bug fix that turned out to be architectural, a real exterior + outdoor
world, and a small permanent set of construction pieces that let that world
grow from inside itself.

## The doorway bug, and what it actually was

Reported as "a large dark grey object blocks the double doors from inside
the workshop." The real cause: `WorkshopRoom.js`'s north and south walls
were each built as a *single solid box spanning the entire wall* — the
door and window meshes were only ever decorative overlays layered in front
of it. There was never an actual opening. Once there was a real exterior to
walk into, that stopped being a cosmetic simplification and became a wall
directly blocking the doorway.

The fix (`buildWallWithOpenings` in `WorkshopRoom.js`) builds a wall as a
strip of box segments with a genuine gap left wherever a door or window
should be — a door reaches the floor (no sill); a window gets both a sill
below and a header above. It works for zero, one, or two openings in the
same wall by slicing left-to-right generically, with no per-wall special
casing.

## Real walls have two jobs now: visual and collision

Every wall segment carries **two materials** (`multiFaceBox` in
`PlaceholderFactory.js`) — one for the face pointing into the room, one for
the face pointing outward — because the same wall now has to look correct
from both sides. And every wall segment's local bounds
(`{u0,u1,v0,v1}`) become a **collision box** for `CameraSystem`, with one
rule: any segment whose bottom edge is at or above `COLLISION_HEIGHT_LIMIT`
(2.2m, matching `FurnitureSystem`'s own footprint-height convention) is
excluded. That's what makes a door's header or a window's header
non-solid — they're real geometry, but they're above head height, and the
2D, Y-agnostic collision system this engine already used for furniture
would otherwise treat them as floor-to-ceiling obstacles. The exact same
rule applies uniformly to every segment, not just doors/windows — it's
what makes a solid wall solid and an opening genuinely open, derived from
one piece of logic instead of two.

`CameraSystem` no longer clamps movement to a hard rectangle at all — see
`RoomLayoutSystem.getWallColliders()` and `CameraSystem._pushOutOfBox()`
(shared with furniture footprint collision, now just a bigger list of
boxes). That hard rectangle was the second thing that would have made
"walk outside" impossible even after the wall was fixed.

### Existing furniture didn't move

The wall's thickness grew (0.12m to 0.3m, for a believable exterior shell),
but every wall now **grows outward only** — its interior-facing surface
stays at exactly the position the thin phase-1/2/3 wall's did. Furniture
like the pinboard and tool storage was originally placed close against
that face; centring the thicker wall on the same line instead would have
pushed the new interior face into them. See the `WALL_GROWTH` comment in
`WorkshopRoom.js` for the exact offset math.

## A seamless world, not a second scene

"I do not want to teleport, transition, load, fade, or otherwise move
between separate scenes" — mechanically, that means there is no second
scene. `WorldEnvironmentSystem` (new) adds exactly two things to the same
`THREE.Scene` the workshop already lives in:

1. **An effectively-infinite ground plane.** One large flat, textured
   plane that silently re-centres on the camera (snapped to a grid, so the
   texture never visibly "swims") whenever the camera gets close to its
   edge — infinite-*feeling* without needing to actually be infinite. It
   sits a few centimetres below the interior floor's exact surface height,
   purely to avoid z-fighting where the floor slab meets it.
2. **Sky and fog**, driven by the exact same `timeofday:changed` event
   `LightingSystem` already listens to, and by `environment:changed` (see
   "The Environment System" below) for everything weather-driven on top of
   that. Before this phase, `TimeOfDaySystem` tinted the window panes
   directly to fake a sky that wasn't really there; that's gone now — the
   windows are real transparent glass (`Materials.glass`), and what you see
   through them is the same `scene.background`/fog/sun/moon/stars/clouds
   you'd see standing outside, updated in one place. Time of day and
   weather already applied scene-wide before there even was an outdoor
   world to see them in; they needed no changes at all to work outdoors —
   they always did.

Walking through the open door, looking back at the building, and walking
back in all just work as a consequence of the above — there's no trigger
volume, no "you have left the workshop" event, because nothing about
crossing that threshold is special beyond geometry.

## The Environment System

"Think beyond simply adding weather effects" — `WeatherSystem` (three
states, a manual pick from a small HUD panel) grew into
`EnvironmentSystem`: still the same core idea (a state, changed by
looking out a window, that everything else reacts to), now covering ten
weather states, three different ways that state gets decided, real wind,
and a sky that actually shows what's happening rather than only dimming
the room a little. See `docs/REFINEMENT.md` and `docs/WORLDBUILDER.md`
for the two passes immediately before this one — this is the third system
in a row to grow this way: get the core idea working simply first, then
widen it once it's proven itself, rather than over-building it up front.

### One state, five independent listeners

`EnvironmentSystem` computes weather and wind and emits one event,
`environment:changed` — exactly the same "compute state, emit an event,
let every consumer react independently" shape `timeofday:changed` already
established. Nothing in this system renders anything, lights anything, or
plays any sound itself:

- **`WorldEnvironmentSystem`** — the sky colour, fog density, cloud
  coverage/drift, and (from `timeofday:changed`) the sun/moon discs, moon
  phase, and star field.
- **`LightingSystem`** — indoor light dampening, plus a storm's occasional
  lightning flash (a brief boost to the hemisphere/ambient fill, layered
  on top of whatever time-of-day already set, not a change to the sun
  itself — a flash reads as the whole sky brightening for an instant, not
  a single light source moving).
- **`AudioSystem`** — the weather ambience layer (wind/rain/a heavier
  storm mix) and how quiet the nature ambience gets under heavy
  precipitation.
- **The Builder Phone / Build Mode** — nothing at all. Every wall, roof
  panel, or custom object anyone builds sits under the same sky, in the
  same fog, lit by the same sun, automatically — "Builder compatibility...
  without requiring special cases" is true because nothing here is aware
  a workshop, or any other building, exists in the first place. It lights
  and fogs the *scene*.

None of these five things know about each other. A future sixth listener
(seasonal foliage colour, say) would cost one new `engine.events.on(...)`
call, nothing more.

### Ten weather states, chosen with sensible transitions

`clear`, `partlyCloudy`, `overcast`, `drizzle`, `lightRain`, `heavyRain`,
`fog`, `mist`, `windy`, `storm` — each with its own light dampening, fog
density, cloud coverage, precipitation intensity, and ambience. `storm` is
deliberately rare and short-lived: `TRANSITIONS` (in `EnvironmentSystem.js`)
only ever leads into it from `heavyRain`, at low weight, and it always
decays straight back out to `heavyRain` rather than lingering or chaining
into anything else.

`TRANSITIONS` is a small weighted graph, not a uniform random pick — clear
skies drift toward partly cloudy far more often than straight to fog, the
way real weather actually develops. Each state, once entered, holds for a
randomised real-world duration (40–150 minutes; storm 8–18) before the
next transition is even considered, so a session doesn't see the sky
flicker through conditions — "the world should feel natural rather than
unpredictable" is implemented as a real, if simple, Markov process, not a
per-frame dice roll.

### Three modes

- **Manual** — `setWeather(id)` picks a state directly and it stays there.
  For building, screenshots, or personal preference, as the brief puts it.
  Remembered separately from whatever Live/Dynamic last left `current` at
  (`manualState`), so switching back to Manual restores your last choice
  rather than defaulting to Clear.
- **Live Weather** — real conditions from Open-Meteo
  (`src/utils/WeatherProvider.js`), chosen specifically because it needs
  no API key or account: a plain HTTPS GET with a latitude/longitude,
  callable directly from a static, backend-free project. Uses the
  browser's own geolocation (a real permission prompt — this is one of
  exactly two places in the entire project that reach outside the browser
  at all, the other being the fetch itself). Its current-conditions
  response reports a WMO weather-interpretation code, an international
  standard, not something Open-Meteo invented, which `WeatherProvider.js`
  maps onto this project's own ten states. "Windy" and the Fog/Mist split
  have no direct WMO equivalent (wind is its own separate variable; the
  WMO table doesn't really distinguish fog severity) — both are
  deliberate, documented reinterpretations of the raw data, not gaps.
  Refetches automatically every 20 minutes while active.
- **Workshop Dynamic** (the default) — the Markov process above, running
  on its own. "Conditions should persist between visits" is handled by
  persisting *when* the current state was entered, not just what it is:
  on load, `_catchUpDynamic()` replays elapsed real time forward through
  the transition graph (bounded to six steps, so a save that's months old
  doesn't try to simulate months of ticks) — the weather has genuinely
  moved on while you were away, rather than freezing or resetting.

**Live Weather's failure path is the same graceful fallback everywhere**:
geolocation denied, geolocation unsupported, offline, a slow or
unreachable API, a malformed response — every one of them rejects
`fetchLiveWeather()` with a plain, human-readable `Error`, and
`EnvironmentSystem` responds identically regardless of which: switch to
Workshop Dynamic, keep the reason in `liveError` for the Environment panel
to show, and keep going. Nothing about Live Weather failing is a dead end.

### The window is the Environment panel

Evolved, not replaced, per the brief: still opened by looking out a
window (`RoomLayoutSystem`'s own interactable), still the one place
weather is viewed and changed — `WindowOverlay.js` now shows mode tabs, the
current condition and wind, the weather grid (Manual), or a status/retry
control (Live Weather), rather than a flat row of three buttons with
inline styles.

### Sky: restrained on purpose

"Avoid making the sky visually overwhelming" ruled out anything
volumetric or particle-heavy. Sun and moon are soft glow sprites
(`THREE.Sprite`, always facing the camera for free), not lit 3D geometry;
stars are a single `THREE.Points` cloud (one draw call for all ~300 of
them); clouds are a small, fixed number (12) of soft sprite blobs drifting
with the wind. Every one of these is positioned *relative to the camera*,
not the world origin, each frame — both so they stay within the camera's
far clipping plane no matter which Render Distance setting is active (see
`SKY_RADIUS`'s own comment for the "Short" preset's 55m minimum, which is
what actually forced this design) and so they're always somewhere
overhead no matter how far from the origin something eventually gets
built. Moon phase comes from the real calendar date (a simplified ~29.53
day cycle from a fixed reference new moon) — one more small way "stepping
outside" looks quietly different day to day, independent of weather
entirely.

### Environmental audio

Two independent layers (see `AudioSystem.js`), both generative — the same
Web Audio synthesis (`AudioSynth.js`) the workshop's ambient music tracks
already use, no audio files:

- **Weather ambience** — filtered noise, unchanged in kind from the
  original three-state WeatherSystem, now with a distinct storm preset
  (louder, brighter filter) alongside wind and rain.
- **Nature ambience** — birds by day, crickets by night, entirely
  independent of the weather layer (both can be audible at once — a light
  rain with birdsong easing back in as it clears is exactly the kind of
  thing this split makes possible). Quieted, not silenced, under heavy
  precipitation, since birdsong over a downpour reads as a mistake rather
  than atmosphere. `createNatureAmbience()` schedules its own brief
  oscillator-based chirps/pulses via `setTimeout` and disposes each one as
  it finishes — the caller only ever starts it once and adjusts its
  day/night state and intensity.

### Atmosphere

Fog density is now weather-driven, not just time-of-day/render-distance
driven — "Fog"/"Mist" genuinely close the world in, layered on top of
(not instead of) whatever the Settings app's Render Distance already set.
Rain direction responds to wind: the window's rain-streak overlay (see
"honest" note below) drifts sideways as it scrolls, proportional to wind
speed and direction, not just falling straight down regardless of
conditions.

Rain itself is still represented the same honest way it always has been
for a room with placeholder-style windows rather than a fully simulated
exterior view: streaks scrolling (and now drifting) across the glass, not
actual falling raindrop particles anywhere in the 3D world. A future pass
giving the room a real falling-particle exterior view could upgrade this
without changing `environment:changed`'s shape at all.

## A simple exterior shell, aligned to the interior

The workshop's exterior — thicker two-sided walls, a flat roof with a
slight overhang and a fascia trim — reuses the same wall-segment geometry
that produces the interior, so the openings are guaranteed to line up
(there's only one doorway, one pair of windows, described once). The roof
is deliberately flat rather than pitched — lower risk of misalignment than
angled panels, and entirely believable for a utilitarian workshop
building — sized from the walls' actual outer faces, not their centreline
(a distinction that mattered enough to be worth getting exactly right; see
the `roofWidth`/`fasciaEdgeX` comments in `WorkshopRoom.js`).

Exterior collision is not a separate system — it's the same
`wallColliders` list mentioned above, since a wall's box spans its full
real thickness from interior to exterior face.

## The Construction Library: "the alphabet"

`src/worldbuilder/ConstructionLibrary.js` adds a second, permanent source
of placeable definitions alongside the person's own `ObjectLibraryStore` —
16 plain foundational pieces (Cube, Plane, Wall, Corner Wall, Floor,
Ceiling, Roof, Roof Corner, Pillar, Doorway, Door, Window, Stairs, Ramp,
Fence, Beam), matching the brief's own list exactly.

The important architectural point: **a construction piece is not a
different kind of thing** — it's a `WorkshopObjectDefinition`, the exact
same shape a Builder-designed object has, just hand-authored in code
instead of designed at runtime, and not editable or deletable.
`ObjectCompiler` doesn't know or care which store a definition came from.
The only real distinction is `WorldObjectsStore`'s new `definitionSource`
field (`"library"` or `"construction"`), which `WorldObjectsSystem` uses to
resolve a placed instance's `definitionId` against the right store — and
construction pieces use **string ids** (`"wall"`, `"door"`, ...)
specifically so they can never collide with `ObjectLibraryStore`'s
auto-incrementing numeric ids even if something forgets to check the
source.

Build Mode's library strip shows both sources side by side, in two labelled
rows — "Construction" and "Your objects" — never merged into one list,
per the brief's explicit instruction to keep them separate.

### The Door piece is genuinely functional

It carries the same `door` behaviour (see docs/WORLDBUILDER.md) any
custom object can — placing one and interacting with it swings it open,
with zero new code. That's the same reuse principle the whole behaviour
system was built on in the previous phase, now proven against
hand-authored data instead of only Builder-designed data.

### One small, deliberate schema extension: tilt

Roof panels needed to tilt. The Builder's own form only ever exposes
Y-axis rotation for a part (full 3-axis rotation editing wasn't worth the
form complexity for hand-authored objects) — so `ObjectCompiler.js` now
also reads `rotationX`/`rotationZ` if a part has them, purely as a data
escape hatch the Construction Library's Roof/Roof Corner/Ramp pieces use.
Nothing about the Builder's UI changed; a person designing their own
object still only ever sees a Y-rotation slider.

## Build Mode, indoors and outdoors alike

`BuildModeSystem`'s placement raycast targets the interior floor **and**
the outdoor ground plane (`WorldEnvironmentSystem.getGroundMesh()`) in the
same call — there's no branch anywhere that asks "am I inside or outside".
Nothing in Build Mode assumes a single room; `WorldObjectsStore` was
already room-scoped (`roomId`) from the previous phase specifically so a
second building later is a matter of a different id, not a schema change.

## Interaction distance

Every existing interactable — furniture, the door, the light switch, both
windows — was individually retuned, not set to one blanket value:
small objects (notebook, pinboard, the light switch, each window) to
~2.0m; medium furniture (tool storage, the sitting area) to ~2.2m; large
furniture (the workbench, the computer desk, shelving, and — after its
later redesign into a proper listening setup, see docs/MUSIC.md and
docs/ARCHITECTURE.md — the music cabinet) and the workshop door to ~2.4m.
Every value was re-verified against each piece's own collision footprint
to confirm it's still reachable from at least one approach angle (the
same check performed when these pieces were first placed — see
`docs/ARCHITECTURE.md`'s furniture section).

(The door, both windows, and the notebook were tightened further still in
a later refinement pass — see docs/REFINEMENT.md — since none of them
need triggering from as far away as a piece of furniture does; this
section's values are what this phase itself introduced, not necessarily
what's still current everywhere.)

## Known simplifications (by design, for this phase)

- **Interaction checks are proximity-only** — there's no line-of-sight or
  occlusion test. With interaction radii now up to 2.4m and real exterior
  walls existing, it's technically possible to stand just outside a wall
  and be within range of something on the other side of it. This isn't new
  (it existed at smaller radii too) but is more noticeable now. Occlusion
  checking is a reasonable, well-scoped future addition, not attempted
  here.
- **The roof has no gable/hip end caps** — it's a single flat slab, not a
  pitched shape, specifically to avoid that problem entirely.
- **The Construction Library's Corner Wall, Roof Corner, Doorway, and
  Window pieces are simplified approximations** (a two-box L-shape, a
  smaller rotated slab, a fixed opening size) rather than parametric or
  mitred joinery.
- **One ground plane, one sky.** Multiple buildings later would still
  share this exact system — nothing here assumes a single building, only
  a single *world* (which remains true).
- **Snow has no dedicated visual.** Open-Meteo can report real snow
  conditions; `WeatherProvider.js` maps them onto the closest rain-family
  state by intensity (see its own `WMO_CODE_MAP` comment) rather than
  inventing a snow visual this pass didn't ask for.
- **Clouds and stars are sprites, not volumetric or physically placed.**
  A `THREE.Points` field and a handful of `THREE.Sprite` blobs, chosen
  specifically to stay cheap and to avoid "visually overwhelming" — real
  cloud shapes, shadows cast by clouds, or constellation-accurate star
  positions were never the goal.
- **Lightning is a light-only flash.** `LightingSystem`'s storm flash
  brightens the hemisphere/ambient fill briefly; there's no visible bolt,
  no thunder-clap sound tied to it, no view-dependent flash timing.

## Future extension points

- **A real falling-particle rain/snow system** for the outdoor world,
  once it's worth the cost — the window's rain-streak overlay was always
  an honest stand-in for a room with placeholder-style glass rather than
  a fully simulated exterior (see "The Environment System" above); nothing
  about `environment:changed`'s shape would need to change to support it.
- **A visible lightning bolt and a thunder sound**, timed together (with
  a slight delay proportional to distance, for a nice touch) — the
  current flash-only implementation was judged enough for "subtle
  atmosphere rather than spectacle," but a full version is a natural
  next step from the same seam.
- **Seasonal variation** — foliage colour, day-length drift across a real
  year, particularly cold/hot spells — would be another independent
  listener on `timeofday:changed`/`environment:changed`, the same way
  every current consumer is, not a change to either emitter.
- **Snow's own visual and ambience**, once genuinely wanted — the
  `WeatherProvider.js` mapping already isolates exactly where this would
  plug in.
