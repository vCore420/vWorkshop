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

**Deepened substantially in Version 2's own Atmosphere phase** — a
richer, real-astronomy sky gradient, two cloud layers, cloud-cover-aware
star/moon visibility, morning mist, four-phase nature audio, and a real
indoor/outdoor audio split all layered onto exactly the architecture
described below, without changing it. See `docs/ATMOSPHERE.md` for that
full account; this section stays as the original Environment System
write-up.

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
  once per session, listening for the shared `"world:continuity"` event
  (`WorldTimeService.js`), `_catchUpDynamic()` replays that elapsed time
  forward through the transition graph (bounded to six steps on top of
  `WorldTimeService`'s own already-capped elapsed value, so a save that's
  months old doesn't try to simulate months of ticks) — the weather has
  genuinely moved on while you were away, rather than freezing or
  resetting. Version 3 Phase 11 moved this off a second,
  independently-computed `Date.now()` reading and onto the same shared
  elapsed-time source every other continuity-aware system already uses;
  it also gave a genuinely first-ever session an explicit, calm "clear"
  opening rather than an accident of whatever the constructor's own
  default happened to be.

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
them); clouds are a small, fixed number of soft sprite blobs drifting
with the wind (two layers as of the Atmosphere phase — see
`docs/ATMOSPHERE.md` — still a fixed, modest total, not a step toward
anything volumetric). Every one of these is positioned *relative to the
camera*, not the world origin, each frame — both so they stay within the
camera's far clipping plane no matter which Render Distance setting is
active (see `SKY_RADIUS`'s own comment for the "Short" preset's 55m
minimum, which is what actually forced this design) and so they're
always somewhere overhead no matter how far from the origin something
eventually gets built. Moon phase comes from the real calendar date (a
simplified ~29.53 day cycle from a fixed reference new moon) — one more
small way "stepping outside" looks quietly different day to day,
independent of weather entirely. The sky's own colour gradient, and how
cloud cover now dims stars and the moon together, are both part of the
Atmosphere phase's own deepening — see `docs/ATMOSPHERE.md`'s "Sky"
section for the full account rather than duplicating it here.

### Environmental audio

Two independent layers (see `AudioSystem.js`), both generative — the same
Web Audio synthesis (`AudioSynth.js`) the workshop's ambient music tracks
already use, no audio files:

- **Weather ambience** — filtered noise, unchanged in kind from the
  original three-state WeatherSystem, now with a distinct storm preset
  (louder, brighter filter) alongside wind and rain.
- **Nature ambience** — a four-phase dawn/day/dusk/night bird-and-insect
  bed as of the Atmosphere phase (originally a simpler day/night pair —
  see `docs/ATMOSPHERE.md`'s "Nature" section for the fuller account),
  entirely independent of the weather layer (both can be audible at once
  — a light rain with birdsong easing back in as it clears is exactly the
  kind of thing this split makes possible). Quieted, not silenced, under
  heavy precipitation, since birdsong over a downpour reads as a mistake
  rather than atmosphere. `createNatureAmbience()` schedules its own brief
  oscillator-based chirps/pulses via `setTimeout` and disposes each one as
  it finishes — the caller only ever starts it once and adjusts its
  current phase and intensity.

### Atmosphere

Fog density is now weather-driven, not just time-of-day/render-distance
driven — "Fog"/"Mist" genuinely close the world in, layered on top of
(not instead of) whatever the Settings app's Render Distance already set.
Rain direction responds to wind: the window's rain-streak overlay drifts
sideways as it scrolls, proportional to wind speed and direction, not
just falling straight down regardless of conditions.

**Rain genuinely falls now** ("Living Refinement" — see docs/ROADMAP.md).
The window's own streak overlay was always an honest representation for
what's actually happening on the glass itself, not a stand-in for rain
that should have been falling elsewhere — but "rain currently does not
visibly fall" was a real, fair gap: nothing in the 3D world itself showed
precipitation at all. `WorldEnvironmentSystem`'s own rain is a field of
short falling line segments (`THREE.LineSegments`, cheap — one draw call),
positioned relative to the camera the same way clouds and stars are, and
wrapped the same way once a particle falls far enough. It doesn't need to
know whether the camera is indoors or outdoors: a solid wall or the roof
correctly occludes it via ordinary depth testing, being real geometry
like anything else in the scene.

Each weather condition also now blends its own tint into the time-of-day
sky colour (`WEATHER_SKY_TINT` in `WorldEnvironmentSystem.js`) — "each
weather condition should have its own distinct visual identity" was fair
too: Overcast, Fog, and a light Drizzle used to differ mainly in a fog-
density number, reading as slightly-hazier versions of the same grey sky
rather than genuinely different weather. Fog now reads flat and grey
(fog scatters colour out of the air); Mist reads lighter and cooler, a
thinner haze than Fog rather than a weaker version of it; Storm reads
darkest and coldest of anything. Clear, Partly Cloudy, and Windy have no
tint at all — they're meant to read as ordinary, undramatic sky days.

### Astronomy: a real solar-position formula, not a fixed arc

"Correct sunrise direction based on the player's location... correct
sunset direction... moon movement matching the current date and time."
`src/utils/Astronomy.js` replaced the sun's old fixed,
direction-agnostic arc with a standard approximate solar-position
formula — the kind countless simple sun-calculators use, not
observatory-grade precision, but a genuine astronomical calculation
driven by real inputs (latitude, day of year, hour) rather than an
arbitrary phase sine. `solarPosition(hour, latitude, dayOfYear)` returns
an altitude/azimuth pair; `azimuthAltitudeToDirection()` is the single
place that becomes a world-space vector, using one fixed convention
(world -Z is north, +X is east) that everything astronomical in the
Workshop — the sun, the moon, and the Compass's own heading — shares,
rather than each computing its own.

**Geolocation** (`requestGeolocation()`) mirrors `WeatherProvider.js`'s
own shape deliberately: ask once, and on any failure — denied,
unsupported, offline — fall back to a fixed, reasonable default (45°N)
rather than a crash or a blank sky. A real location, when granted, means
the sun genuinely rises out of true east and sets in true west adjusted
for wherever the player actually is, rather than an idealised,
latitude-agnostic arc.

**The moon's position is derived from the exact same formula**, not
placed "roughly opposite" the sun the way it used to be — it uses an
"effective hour" offset from the sun's own by how far through its current
phase the moon is (`moonPhaseFraction() * 24`). A new moon (phase 0) sits
at essentially the same position as the sun — which is what "new moon"
astronomically *is*, the two rising and setting together — a full moon
(phase 0.5) is a 12-hour offset, opposite the sun exactly as it always
was, and everything in between falls proportionally around the same daily
arc. That relationship, not just a fixed opposite-the-sun placement
regardless of phase, is what "moon movement matching the current date and
time" means astronomically.

**Stars turn slowly with the hour** (`WorldEnvironmentSystem.js`'s own
`stars.rotation.y`) — a simplified rotation about the world's vertical
axis (not a properly latitude-tilted polar one), approximating the real
sky's own apparent motion from Earth's rotation, rather than a field
frozen in one arrangement regardless of what time it is. "Stars mapped to
the real night sky where practical" stopped short of a full constellation
catalogue — a genuinely different-scale undertaking, real star positions
for hundreds of named stars — in favour of this one, much simpler
astronomical property that was practical to get right.

**Occasional shooting stars** — one reusable streak (a two-point line,
the same cheap-geometry approach the rain particles already use),
triggered at a random, unhurried interval (roughly every 15-55 seconds)
and only on a genuinely dark, clear night (`starVisibility` and low cloud
coverage/precipitation both gate it). "These effects should remain
subtle. The goal is quiet realism rather than spectacle" — a brief,
occasional flourish, not a meteor shower simulation.

### Workshop Time: the Settings app's own slider, easing rather than jumping

"The player should be able to adjust the Workshop time directly from the
computer settings... avoid instantly teleporting the sun or moon. The
transition should feel calm and believable." `TimeOfDaySystem.setTime(hour)`
switches to simulated mode and sets a transition target; `update()` eases
`currentTime` toward it along whichever direction around the 24-hour
clock is shorter (so 23:00 → 01:00 moves forward two hours, not backward
twenty-two) at a fixed rate — a few real seconds even for the most
extreme, 12-hour jump. "Moving from morning to evening should smoothly
move the sun across the sky... night should naturally transition into
dawn" is implemented as literally advancing the clock forward (or back)
through every moment in between, not a cut — the sun and moon's own
positions are simply a function of `currentTime`, so easing that one
number is the entire mechanism. Arriving at the requested time pauses
there, rather than continuing to run afterward — it's "go look at this
specific moment," not "start a new clock running from here."

### Interior weather: an architectural fix, not a Workshop-specific one

"Rain should no longer fall inside enclosed buildings... future
Builder-created buildings should naturally support this system without
requiring special cases." What was actually happening: rain particles
spawn within a box centred on the camera (see "Atmosphere" above) — if
the camera is standing inside an enclosed room, a good number of them
end up inside that same enclosed space too, genuinely co-located with
the player, not behind a wall or roof from their perspective at all.
Depth testing (the original reasoning for why this seemed like it should
already work) only ever occludes geometry that actually sits *between*
the camera and a particle; it does nothing for a particle that was never
behind anything to begin with.

The fix is `InteriorSystem.js` — one generic function,
`registerVolume(box)`, the same "one small, generic thing multiple
independent callers use" shape `ReflectionSystem`/`LadderSystem` already
established. `RoomLayoutSystem` registers the Workshop's own interior
volume directly, built from `ROOM_DIMENSIONS` rather than the exterior
shell's own bounding box (which would also sweep in wall thickness and
the roof's overhang — this is deliberately just the room's actual
interior air). `InteriorBehaviour.js` is the identical capability for
Builder objects — attach it to any enclosed structure and it registers
its own volume the exact same way, unaware the Workshop's own room does
the same thing. `WorldEnvironmentSystem`'s rain checks
`InteriorSystem.isInside(cameraPosition)` and fades its own opacity to
zero while true, rather than trying to reason about which specific walls
or roof panels are "in the way" for any given raindrop.

### The Compass: one convention, two consumers

"A single key press should smoothly show or hide the compass... clean,
minimal, easy to read, non-intrusive." `CompassSystem.js` (toggled with
**M**) is a single translating strip of direction labels, not a circular
dial or a minimap — reads as "glance, orient, dismiss," matching "should
not remain permanently visible... behave similarly to the Build Mode
phone and third-person toggle." Its heading comes from the exact same
`directionToAzimuth()` function `Astronomy.js` uses for the sun and
moon, applied to the player's own facing direction (from
`CameraSystem.yaw`) — the compass and the sky were never two separate
things that needed to be kept in agreement by hand; there's only one
azimuth convention in the entire Workshop, and both just read from it.

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

**Version 3, Phase 14 ("Further Environmental Polish") — a handful of
small outdoor details, right against the walls themselves.** A bench
beside the front door and a wooden planter box (soil + radial foliage
clusters, reusing Shelving.js's own pot-plant technique rather than a
second way to build a plant) under each window — deliberately purely
decorative, no `FurnitureSystem` footprint/interaction of their own,
since this is "the workshop itself feels more lived-in from outside,"
not new interactable content, and distinct from populating the wider
surrounding world (still a non-goal — see below).

**Version 3, Phase 2 ("Living Spaces") — the fascia's own trim colour,
unified.** The door frame, baseboard, and framed-sketch frame all
deliberately share one dark wood tone (`"#3d2a1c"` — see the baseboard's
own comment on why). The fascia was quietly using a distinct, unexplained
near-duplicate (`"#2c2419"`) instead — close enough to read as a slip
rather than a second, deliberate trim colour, and nothing anywhere
explained a reason for the difference. Unified to the one tone the rest
of the room's woodwork already commits to.

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
- **Solar position is a standard approximate formula, not
  minute-precise.** Local clock time is treated as solar time directly
  (see `Astronomy.js`'s own comment) — a common simplification that
  ignores the equation of time and the small longitude-within-timezone
  offset, which can shift real sunrise/sunset by up to roughly half an
  hour. Believable, not almanac-accurate.
- **An interior volume is a fixed box, not tracked for movement** — see
  `InteriorBehaviour.js`'s own comment. Reasonable for something the size
  of a building; a Builder-created interior repositioned after being
  placed would leave its registered volume behind at the old location.
- **Star rotation is a simplified vertical-axis spin, not a properly
  latitude-tilted polar one** — see "Astronomy" above.

## Future extension points

- **A real falling-particle snow visual** — rain now genuinely falls (see
  "Atmosphere" above), but snow-mapped weather still borrows the same
  rain-family visuals by intensity (see `WeatherProvider.js`'s own
  comment) rather than having a distinct look of its own.
- **A visible lightning bolt and a thunder sound**, timed together (with
  a slight delay proportional to distance, for a nice touch) — the
  current flash-only implementation was judged enough for "subtle
  atmosphere rather than spectacle," but a full version is a natural
  next step from the same seam.
- **Seasonal variation, built on real foundations now** — the Atmosphere
  phase added `Astronomy.getSeason()` (a real day-of-year/hemisphere
  calculation, surfaced in `WorldAwareness.snapshot().season` and the
  Atmosphere tab) specifically so this bullet has something solid to
  stand on; actually *changing* anything because of the season — foliage
  colour, day-length drift across a real year, particularly cold/hot
  spells — is still future work, and would be another independent
  listener on `timeofday:changed`/`environment:changed`, the same way
  every current consumer is, not a change to either emitter. See
  `docs/ATMOSPHERE.md`'s own "Season Foundations" section.
- **Snow's own visual and ambience**, once genuinely wanted — the
  `WeatherProvider.js` mapping already isolates exactly where this would
  plug in.
- **A real constellation catalogue**, if the simplified vertical-axis
  star rotation ever needs to become genuinely accurate — real star
  positions (right ascension/declination) for a modest named set would
  slot into the same `_buildStars()` that currently scatters them
  randomly, without needing to change how the rotation itself is applied.
- **The equation of time and longitude-within-timezone offset**
  (`Astronomy.js`'s own known simplification) — real observatories
  correct for both; the Workshop treats local clock time as solar time
  directly, which is believable but not minute-precise.
## World Builder — evolving Build Mode into a true World Builder

"The original Workshop should no longer be treated as a special
location. Instead, it should become the first building within a much
larger player-created world." This section covers what changed; the rest
of this document (lighting, weather, time) already applied to the whole
world before this phase and needed no changes at all to keep doing so.

### Interior Recognition — the most important goal of this phase

"Whenever a player constructs an enclosed building, the Workshop should
naturally recognise it as an interior... players should never need to
manually mark a building as an interior." `BuildingDetectionSystem.js`
is that recognition, and it's deliberately geometric rather than tied to
which specific piece was used — "avoid creating hardcoded world content"
applies here as much as anywhere else. Any placed World Object whose own
real bounding box (`WorldObjectsSystem.getFootprints()` — the exact same
boxes collision already uses) is tall enough (≥1.6m) and reaches up from
near the ground (base ≤1.2m) counts as a wall-like enclosure piece,
whether it's the built-in "wall" construction piece, a custom-designed
object, or an imported model used as a wall.

**A coarse 2D flood-fill**, not full 3D voxel analysis: a grid over a
bounded area around the Workshop marks cells overlapping a wall-like
footprint as blocked, floods inward from the grid's own guaranteed-
outside edge, and whatever's never reached is enclosed. Connected
enclosed regions become bounding boxes, registered with
`InteriorSystem.registerVolume()` — the *exact* call
`RoomLayoutSystem.js` already makes for the Workshop's own room. Neither
one is a special case the other needs to know about; a player-built room
gets interior lighting, weather protection, and ambience through the
same systems, not a parallel set built just for them.

Debounced (700ms after the last placement/move settles) rather than run
on every single `instances:changed` event, and re-run automatically
whenever anything changes — a wall moved, added, or removed
re-evaluates every detected region from scratch.

**A window couldn't seal a boundary, by its own design — found while
building Version 3, Phase 5's default interior blueprints, since fixed.**
The Construction Library's `window` piece has posts either side (tall
enough and low enough to count as wall-like on their own) but its sill
is only 1m tall and its header doesn't start until 2m up — nothing of
the piece on its own ever spanned the full ≥1.6m/≤1.2m band the
flood-fill checks for at the window's own middle. That gap read exactly
like an un-doored doorway: the flood-fill poured straight through it,
and the *whole* connected region failed to register as enclosed, not
just the area near the window. Not a bug in the detection system itself
— an open, unglazed window opening genuinely isn't sealed — but a real
gap in what a player could build with the pieces on hand: there was no
way to have a window *and* a fully weather-protected interior. Fixed the
same way `doorway` was always sealable — by pairing, not by special-
casing: `windowPane`/`largeWindowPane` are new pieces that seal their
matching `window`/`largeWindow` exactly the way a real `door` seals a
`doorway`, sized to independently satisfy this same generic check on
their own rather than teaching `BuildingDetectionSystem` anything
piece-specific. See `docs/WORLDBUILDER.md`'s "Collision integration"
section for the geometry, and its "Default starter blueprints" section —
Sunlit Room now uses a real, sealed window.

**Real, acknowledged limitations**: a single horizontal slice, not a true
3D volume — a multi-storey building or one whose floor doesn't align
with the Workshop's own ground level isn't something this system reasons
about; a detected region's own height is the tallest nearby wall
piece's own height (or a flat default), not a roofline actually traced.
"Avoid overcomplicating" — this covers the ordinary case (four walls and
a doorway) well; see this file's own "Future extension points" for what a
fuller version would need.

### Builder Library — Structural/Openings/Nature/Paths/Lighting/Utilities/Workshop

"If something naturally exists within the Workshop world, it should also
exist as a Builder asset." The construction catalogue grew substantially
this phase — Foundation and Railing complete the Buildings list (Floors,
Walls, Corners, Roofs, Doors, Windows, Stairs already existed); Mailbox
completes Utilities (Fence, Gate, and Sign, which already doubled as a
signpost, existed already). **Nature, Paths, and Lighting were reserved
as real categories here** (`CONSTRUCTION_GROUPS` already named every
piece this phase intended — `tree`, `bush`, `flower`, `rock`, `log`,
`grassPatch`, `gardenBed`; `stonePath`, `gravelPath`, `dirtPath`,
`timberPath`, `concretePath`; `gardenLight`, `streetLight`, `lantern`,
`floodlight`, `campfire`) **but the real piece definitions themselves
weren't actually added yet** — a gap between this document's own claim
and the code that went unnoticed until the World Builder phase (Version
2, Phase 9) actually populated Nature and Paths for real; see this
document's own "World Builder (Version 2, Phase 9)" section further
below for the full, corrected account. Lighting (garden light, street
light, lantern, floodlight, campfire) remains reserved but still
unpopulated — a genuine future extension point, not claimed as done here
any longer.

With the catalogue now well past its original size, the library screen
groups pieces by category (`CONSTRUCTION_GROUPS`, a compact id → group
lookup kept separate from each piece's own definition) with section
headings, rather than one long undifferentiated grid.

### Blueprints

"Blueprints are reusable Builder creations... players should still be
able to modify them after placement." `BlueprintStore.js` saves a
cluster of World Objects and their relative positions to each other;
placing one creates that many genuinely independent `WorldObjectsStore`
instances at once, each immediately selectable and editable on its own —
never a single combined thing with special editing rules.

**Capture, honestly scoped**: rather than a full multi-object selection
interface, "Save as Blueprint" captures the currently selected object
plus everything else within 3m of it — select one wall of an
already-built shed and the rest comes with it. A real simplification, not
a hidden one; a proper multi-select tool is the natural next step (see
"Future extension points").

### Snapping and multi-axis rotation

"Snapping should remain optional. Players should always remain free to
build without restrictions if they prefer." Both grid snap (position) and
rotation snap default off, toggled per-placement from the ghost screen's
own checkboxes. Multi-axis rotation reuses the wheel rather than adding
new UI: plain wheel still turns yaw exactly as before, Shift+wheel tilts
pitch, Ctrl+wheel tilts roll — a player who never needs anything but yaw
sees no change at all. `WorldObjectsStore` gained optional
`rotationX`/`rotationZ` fields (defaulting to 0) to actually persist
this, not just preview it on the ghost.

### Known simplifications (by design, for this phase)

- **Interior detection is a single horizontal slice** — see "Interior
  Recognition" above.
- **Blueprint capture was radius-based, not true multi-select, as of
  this phase** — superseded in the Builder Evolution phase, which added
  a real multi-selection and an exact capture
  (`_captureSelectionAsBlueprintObjects()`) alongside the original
  radius mode; see `docs/WORLDBUILDER.md`.
- **"Surface snapping" wasn't added as a distinct third toggle** — the
  ghost already snaps to whatever surface it raycasts against; a
  dedicated edge/corner-alignment mode is future work, not implemented
  this phase.
- **Grid/interior-detection bounds are fixed to a generous area around
  the Workshop**, not the whole conceivable world — reasonable for "a
  village beside the Workshop," not yet for an unbounded map.

## World Builder (Version 2, Phase 9) — real terrain, real ground cover

"The Builder creates structures. The World Builder creates places... the
surrounding world should feel just as thoughtfully designed as the
Workshop itself." Distinct from the "World Builder" section above (an
earlier, Version 1 phase's own work, evolving Build Mode to recognise
player-built interiors) — this is the phase that gave the *ground
itself* something to shape, corrected the Nature/Paths documentation gap
noted above, and gave every existing outdoor system (wind, weather) a
first real thing to visibly affect.

### Terrain, a real bounded heightmap

**Superseded by the Workshop Reliability phase — see below.** This
section is kept as the original historical record of how terrain
editing first arrived; `src/systems/TerrainSystem.js`'s own top comment
is the accurate, current description of the architecture. The short
version: the "layered a few centimetres above a separate flat ground"
design described just below is gone — `TerrainSystem` is now the
Workshop's *only* ground, real and non-editable-skirt combined, at 200m
(not 48m) across. Everything else on this page about *how* sculpting
itself works (the five brush operations, bilinear height queries, vertex
colour painting) is unchanged.

`src/systems/TerrainSystem.js` — a genuine, editable 48m×48m patch of
ground, layered a few centimetres above `WorldEnvironmentSystem`'s own
flat, infinitely-recentring ground rather than replacing it. That
distinction matters: the existing ground solves "the world never
visibly ends" by discarding any specific location's own identity
(recentring around the camera); terrain needed the opposite property — a
fixed patch someone can return to and find exactly as they left it. "The
goal is not creating a huge world. The goal is creating a beautiful one"
is taken literally: a generous garden's worth of sculptable ground, not
an attempt to make the *entire* infinite ground editable.

Every vertex position is written directly from this file's own
`gridToWorldX/Z()` formula (the exact inverse of `worldToGridX/Z()`,
used for every query) rather than trusted to `THREE.PlaneGeometry`'s own
default layout — `PlaneGeometry` is used only for its already-correct
triangle index buffer and UV layout, real work worth reusing. That
symmetry is what makes "click here, the terrain changes here" reliable
rather than a rotation-direction assumption.

**Raise, Lower, Flatten, Smooth, Terrace** — five real brush operations,
each a genuine, tested algorithm (law-of-cosines-simple, not
approximated): Raise/Lower add a falloff-weighted height delta; Flatten
eases every point toward the brush centre's own current height; Smooth
eases each point toward its own immediate neighbours' average; Terrace
snaps to the nearest 0.5m step. Every brush uses linear falloff (full
strength at the centre, nothing at the edge) — soft-edged, not a
hard-walled cylinder of effect. Height queries
(`getHeightAt()`) are bilinearly interpolated, so walking across a slope
feels like a slope, not a staircase of flat triangles.

**Terrain painting** — plain vertex colours (`grass`, `dirt`, `rock`,
`sand`, `gravel`, `mud`, `path`), blended by ordinary linear
interpolation between the existing and new colour at paint time. No
*shader* work — the same "genuinely real, deliberately simple" standard
`AnimationPlayback.js`'s own Euler-lerp interpolation already holds
itself to. Version 3, Phase 10 ("Real Assets, Honestly Introduced")
added one shared, neutral fine-speckle texture (`ProceduralTexture.js`'s
own `terrainDetailTexture()`) under all seven materials at once —
`MeshStandardMaterial` multiplies `map` and vertex colour together
automatically, so this is still no shader work, just one `map` on an
already-existing material. Still genuinely **not** per-material splat
texturing — grass doesn't look like grass blades, sand doesn't look
like sand grains, every material gets the identical detail pattern
under its own flat colour — a real, bigger project deliberately left
for later, now that there's an actual example of the difference to
judge it against rather than nothing at all.

**Walking on it is real, not just visual.** `CameraSystem.
_computeGroundHeight()` now queries `TerrainSystem.getHeightAt()` as its
base height (falling back to the flat `0` it always used outside the
terrain patch or with no TerrainSystem registered — now a 200m patch
plus a much larger non-editable skirt, both the *same* mesh's own
territory; see the Workshop Reliability phase account below), before the
existing footprint loop still lets a player stand on top of something
placed on that terrain, unchanged.

### Roads & Paths — tiles, not curves

"Roads and paths should naturally follow curves where appropriate." A
deliberate, honest scope choice: rather than a spline/curve-generation
system, a path is laid the same way a wall is built — small alphabet
tiles (`stonePath`/`gravelPath`/`dirtPath`/`timberPath`/`concretePath`,
1m squares, half a Floor tile's own size for tighter winding), placed one
at a time, or a `"path"` terrain-paint colour striped across the ground
directly. Both are genuinely real, working ways to make a path; neither
pretends to generate a smooth spline a player didn't actually lay out
themselves.

### Landscape Assets — real Nature pieces, at last

"Landscape assets should become Workshop Assets just like every other
object." `ConstructionLibrary.js`'s own `CONSTRUCTION_GROUPS` mapping
had already reserved the exact ids this phase needed (`tree`, `bush`,
`flower`, `rock`, `log`, `grassPatch`, `gardenBed`) and every colour
constant (`FOLIAGE_COLOR`, `BARK_COLOR`, `STONE_COLOR`, `SOIL_COLOR`, and
so on) — see "Builder Library" above for the corrected account of that
gap. This phase filled it in for real: seven genuine multi-part
definitions, built from the identical primitive-part vocabulary every
other Construction piece already uses.

**A tree gently moves in the wind, for real.** `ObjectCompiler.js`
gained a `swaysInWind` per-part flag; `WorldObjectsSystem.js` collects
every tagged part once per spawn (never a per-frame search) and applies
a small sinusoidal rotation on top of each part's own authored rest
rotation, reading `EnvironmentSystem.windSpeed`/`windDirectionRad`
directly — the identical, already-computed wind values
`WorldEnvironmentSystem.js`'s own clouds already drift by. "Begin
preparing the World Builder for future Atmosphere systems... wind
influencing vegetation" is genuinely real today, not only a prepared
hook — amplitude scales with wind speed, so a still day is visibly still
and a storm visibly tosses the branches.

**Workshop Reliability phase — this wind-sway was invisible until now.**
An older, simpler placeholder set of the same twelve Nature/Paths ids
(no wind-sway, plainer geometry, 2m path tiles instead of this phase's
own 1m) had never actually been removed from `CONSTRUCTION_PIECES` when
this richer set was added — both existed in the same array under the
identical ids, and `getConstructionPiece()`'s `.find()` always resolved
to whichever came *first*, which was the older set. Every Tree, Bush,
Flower, Rock, Log, Grass Patch, Garden Bed, and every Path tile placed
from the Construction Library had silently been the plainer, non-
swaying originals this whole time — genuine, real dead code sitting
right next to the code that actually ran. Removed during the
architectural review pass of the Reliability phase; the wind-sway
described above was always correctly implemented, just never reachable.

### Asset System Integration — Construction pieces join for real

Construction Library pieces (every wall, door, and — new this phase —
every Nature/Paths piece) are now merged into the `"objects"`
`AssetService` kind alongside player-designed `ObjectLibraryStore` items
— real search, favouriting, and a genuine `asset://object/<id>` detail
page for a Tree or a Stone Path, using each piece's own real
`getConstructionGroup()` category (already the exact categorisation the
Builder Phone's own library screen groups by) rather than the single
flat `"Construction"` label every piece happened to share internally.

### Terrain Editing UI

A fifth tab (`BuilderPhoneUI.js`) alongside Construction Library/Saved
Objects/Imported Models/Blueprints — choosing a shape tool or a paint
material immediately arms it; sculpting itself happens by clicking and
dragging directly in the 3D world, the identical interaction gesture
placing and moving objects already use, not a separate mode with its own
different feel. A full stroke (from pointerdown to pointerup) is one
undo entry, snapshotting the whole heightmap and colour map before and
after (101×101 as of the Workshop Reliability phase, up from the
original 49×49 — still small enough, at roughly 20,000 numbers each,
that a whole-array snapshot per stroke stays simpler and safer than
tracking exactly which vertices a stroke touched).

**Workshop Workflow phase — a live brush preview.** Before this phase,
there was no way to see where a brush would actually land, or how large
an area it covered, before committing to a drag. `BuildModeSystem.js`
now raycasts the terrain on every pointer move while a terrain tool is
armed (not only while actively dragging) and positions a simple ring —
`_buildTerrainBrushPreview()` — at the hit point, scaled to the current
brush radius and tinted to the active paint material (or plain white for
a sculpt tool). One ring, built once and reused, not rebuilt per frame —
the same "build once, mutate" instinct every other frequently-updated
visual in this project already follows.

### Known simplifications (by design, for this phase)

- **No Building Plots** — the brief's own "define suitable areas for
  future buildings" concept was judged a real, separate feature (its own
  data store, its own visual marker) rather than something to squeeze in
  alongside terrain, painting, and real Nature assets; a genuine future
  extension, not silently dropped.
- **No dedicated Water Features tool** — a pond today is whatever a
  future Nature-library "pond" piece or a painted low terrain basin
  looks like; a real, animated water surface (even a simple one) is
  future work.
- **Lighting fixtures remain reserved, still unpopulated** — see
  "Builder Library" above; `gardenLight`/`streetLight`/`lantern`/
  `floodlight`/`campfire` stay ids without real pieces behind them yet.
- **One bounded terrain patch, not a whole editable world** — 200m
  square (grown from the original 48m in the Workshop Reliability phase
  — see below), fixed size and position, centred on the Workshop, plus a
  much larger flat, non-editable skirt beyond it. Consistent with "the
  goal is not creating a huge world" — a very large, generous, but still
  ultimately bounded world, not literally infinite terrain.
- **No terrain-aware collision beyond height** — a very steep raised
  cliff doesn't stop horizontal movement the way a wall does; only the
  vertical foot-height calculation changed.
- **Imported structures don't yet get automatic terrain integration**
  (footprint-shaped terrain flattening on import, say) — still placed
  exactly as before, on whatever height the terrain already has there.

### Terrain: one system, one ground (Workshop Reliability phase)

"There should no longer be two separate ground layers. The Workshop
should have one terrain system that both renders the world and supports
editing... the goal is to retire the proof-of-concept implementation and
replace it with the Workshop's permanent terrain architecture." Exactly
that: `WorldEnvironmentSystem.js`'s own separate flat, infinitely-
recentring ground — the thing the "Terrain, a real bounded heightmap"
section above spent a whole paragraph explaining terrain *couldn't*
simply replace, back when the patch was only 48m — is gone entirely.
`TerrainSystem.js` is now the Workshop's one and only ground:

- **The editable patch grew from 48m to 200m** (100m half-width) —
  comfortably covering the default render distance and most render
  distance settings, not a patch smaller than even the shortest one.
  Resolution eased from 1m to 2m per grid cell to keep the vertex count
  (2,401 → 10,201) reasonable for a mesh whose positions and normals get
  rewritten every dirty frame during active sculpting; the Builder's own
  minimum brush size grew from 1m to 2m to match.
- **A large (2km), coarse, non-editable "skirt"** fills everything
  outside that patch — a `THREE.Shape` with a same-sized rectangular
  hole cut out, so the editable patch and the skirt meet with no overlap
  and nothing to z-fight over, both owned by the identical
  `TerrainSystem` class. See that file's own top comment for why this
  still counts as "one terrain system," not a second one in disguise.
- **The height offset between the old patch and the old flat ground is
  gone** — there's only one outdoor mesh now, nothing left to be offset
  from for that reason. A small, different, and still legitimate offset
  from the *interior floor* remains (so the indoor floor still visibly
  wins the depth test at the doorway threshold).
- **Object placement now raycasts the real terrain.**
  `BuildModeSystem._gatherSurfaces()` used to raycast
  `WorldEnvironmentSystem`'s own flat ground for outdoor placement —
  meaning a ghost placed over a sculpted hill silently ignored it and
  landed on flat ground regardless. It now raycasts
  `TerrainSystem.mesh` directly, the same real surface
  `CameraSystem.getHeightAt()`-driven movement already walks on —
  "player movement, collision, and object placement all reference the
  same terrain surface" by construction, not by three independent
  systems happening to agree.
- **Existing terrain sculpting survives the migration.** A save from
  before this phase (the old 49×49 grid) is bilinearly resampled onto
  the new 101×101 grid at the exact real-world positions it always
  occupied, the first time it loads — see `TerrainSystem
  .js`'s own `_migrateFromOldTerrain()`. Anything outside the old 48m
  patch was never edited, so it simply stays the new grid's own default.

### Future extension points

- **Building Plots** — a small, real data store (position, size,
  rotation, name) and a translucent ground marker, integrating with the
  Builder the same way a Blueprint's own placement preview already does.
- **A real water surface** — even a simple animated, semi-transparent
  plane would satisfy "ponds, streams" honestly, without attempting
  large-scale simulation the brief itself explicitly didn't ask for.
- **Lighting fixtures**, completing the reserved category with the same
  `lightSource` behaviour the original ceiling light already uses.
- **Terrain-aware collision** for steep slopes, not just height.
- **Manual terrain-brush falloff curves** (smoothstep instead of linear)
  for an even softer edge, if the current linear falloff ever reads as
  too mechanical in practice.
- **A genuinely unbounded world** — the 200m patch plus 2km skirt (see
  above) is enormous relative to anything the Workshop needs today, but
  is still, honestly, not infinite; a determined enough walk in one
  direction would eventually reach the skirt's own outer edge.

## Craftsmanship (Version 2, Phase 17) — the Workshop Interior

"The Workshop is more than the objects inside it... by the end of this
phase, the Workshop should feel like a real building that has existed
for years and continues to be cared for every day." Following the
Workbench and Desk phases' own template, scaled up from one piece of
furniture to the room shell itself: no new systems, no repositioned
walls or fixtures — every improvement is how convincingly the same
building is built.

**Baseboards, on all four walls.** The single largest gap this phase
found: walls simply met the floor at a bare edge everywhere, with
nothing marking the transition. `buildBaseboard()` reuses
`buildWallWithOpenings()`'s own opening-slicing directly — the south
wall's version is given the exact same door opening the wall itself
was built with, so the trim skips the doorway automatically rather than
needing a second, hand-tuned gap that could drift out of sync with the
real one. Windows never needed slicing around at all: their sill sits
at 0.9m, well above baseboard height, so a solid strip is honestly
sufficient there.

**A protruding interior sill under each window.** The window frame's
own sill segment sits flush with the wall, the same thickness as the
jambs either side of it — real sills almost always protrude a little
further into the room than that, the one surface of a window you could
plausibly set something on. A separate, slightly wider, slightly deeper
ledge, sitting just below the glass.

**Real hardware on the front doors.** Three small hinge plates per
panel, on the actual hinge edge — the same "this should read as what
it is" standard the Desk phase's monitor hinge and the Workbench's vice
crank already set. Purely cosmetic: the panel's actual rotation still
happens around its own pivot group, entirely unaffected by hinges
attached to the mesh itself.

**Lighting fixtures, twice over.** A small ceiling canopy plate where
each pendant's cord meets the ceiling — the cord used to simply emerge
from the ceiling plane with nothing marking where it actually mounts.
And a genuinely new pair of fixtures: wall sconces flanking the front
doors, the Workshop's first wall-mounted light. Built exactly like the
existing ceiling sockets — geometry in `WorkshopRoom.js`, a plain array
of positions (`wallLightSockets`) returned alongside `ceilingLightSockets`,
and `LightingSystem._attachPracticalLights()` reading a second array the
same way it already reads the first. No new lighting mechanism; one
more pair of fixtures through the one that already existed.

**The light switch, finally switches.** The plate was sharing
`matte()`'s own numbers for a surface that's moulded plastic in
practically every real building — genuinely `Materials.plastic()` now —
and gained a small toggle nub that physically tilts between an on and
off position, driven by `LightingSystem._applySwitchToggle()` from the
exact same `lightsOn` state everything else already reacts to. A flat,
static plate implying a switch existed somewhere unseen was itself a
small inconsistency this phase resolved.

**The Workshop's third interaction sound effect.** A soft creak on
opening and closing the front doors (`AudioSynth.playDoorCreak()`,
lower and slower than the Desk phase's chair creak — a door is a
bigger, heavier object) — the third `kind` in
`AudioSystem.playInteractionSound()`'s own switch, looked up from
`RoomLayoutSystem.toggleDoor()` on demand rather than threaded through
a constructor, since `RoomLayoutSystem` registers before `AudioSystem`
exists but the door is never toggled that early.

**Two real material/architectural findings, resolved.** `ToolStorage.js`'s
own screwdriver handle was sharing `matte()`'s numbers for something
that's always a moulded plastic or rubber grip in real life — genuinely
`Materials.plastic()` now, the same finding the last two phases each
made about their own fixtures. And in `Shelving.js`: `shelfColors` (four
near-identical wood browns) was already doing double duty as the book/box
item palette, while a second, genuinely varied array — `placeholderColors`,
clearly meant for exactly that — sat completely unused behind a `void`
statement. Rather than deleting the orphaned array (there was nothing
wrong with it, unlike `softBox()` last phase), each array got a real,
distinct purpose: the varied palette now colours the books and boxes,
and the wood-tone array now varies each shelf board's own tint, a small,
believable "assembled from whatever timber was on hand" detail neither
array was doing before.

**Environmental audio, reviewed rather than expanded.** Room ambience,
window rain response, indoor/outdoor muffling, and wind through trees
were all already built out substantially in the Atmosphere phase (see
this document's own Environmental Audio section) — confirmed still
correct, not re-built. A genuinely ambient "building creak" (the
structure settling, independent of any interaction) was considered and
deliberately left for a future pass: every existing interaction sound in
the Workshop is triggered by a specific action, and an unprompted
ambient creak would be the first sound in the project with no clear
cause a player could ever connect it to.

**What stayed exactly as it was, reviewed and confirmed rather than
touched.** The roof remains a simple flat shell with no gable or hip
caps, and the exterior siding/interior wall materials are unchanged —
both already correctly documented as deliberate simplifications above,
and neither needed revisiting to make the interior feel more lived-in.
Every material on every new addition this phase uses correct PBR
properties and already responds properly to the day/night cycle and the
new sconces' own light, the same "verified, not altered" standard the
last two phases already held their own new geometry to.

**Future craftsmanship philosophy.** Three phases in (the Workbench, the
Desk, now the room itself), the pattern holds at a bigger scale too:
keep structure and position fixed, spend the budget on trim, hardware,
and material accuracy, add fixtures through mechanisms that already
exist rather than new ones, and treat a real dead-code or dead-setting
finding as worth resolving on the spot. The Music Cabinet and the
Wardrobe remain the natural next candidates for the Workbench/Desk
treatment specifically; a second interior pass (crown moulding, a
ceiling beam, more built-in storage) is the natural next candidate at
the room scale, whenever it's time to return to it.

## Craftsmanship (Version 2, Phase 19) — Decorative Details

"Decoration should never exist simply because empty space looks
unfinished... if this object disappeared tomorrow, would the Workshop
lose a tiny piece of its personality? If the answer is no, reconsider
why it exists." The smallest-scoped craftsmanship phase yet by design —
three new room-level additions total, chosen specifically because each
one passes that test, rather than an attempt to decorate every surface
the brief's own examples named.

**A wall clock — the Workshop's first genuinely time-driven
decoration.** Mounted in the open wall segment between the two north
windows. The hour and minute hands are real pivot groups
(`clockHourHand`/`clockMinuteHand`, the exact same "a mesh offset from
its own local origin inside a group whose origin is the true pivot"
shape the front doors' own panels already use), rotated by
`LightingSystem._updateClockHands()` from the same `hour` value
`TimeOfDaySystem` already broadcasts on `timeofday:changed` for the
sun. No new system, no new event — a fourth consumer of a value three
other systems already read, the same architectural shape
`docs/ARCHITECTURE.md`'s own "one state, five independent listeners"
section already describes for weather.

**One small plant, on one window sill, not both.** The Workshop Interior
phase gave both windows a real protruding sill; this phase finally put
something on one of them — deliberately not both, since a matching pair
reads as decorated rather than lived-in. A compact succulent, chosen
specifically to look different from the music cabinet's own leafier
plant rather than repeating the same pot around the room.

**One small framed sketch, south wall.** Reuses `Materials.sketchPaper()`
— already built for the Builder's own sketch presence items — rather
than inventing a second way to suggest hand-drawn paper on canvas. A
sketch reads as "somebody's own work, framed," which fits a workshop's
identity more specifically than a generic print would have.

**A real material gap, named directly in this phase's own brief:**
`Materials.ceramic()` joins `wood()`/`metal()`/`fabric()`/`plastic()`/
`rubber()`/`cork()` in `PlaceholderFactory.js` — every plant pot in the
Workshop (this phase's new one, and the music cabinet's existing one)
was sharing `matte()`'s own numbers for a surface that's almost always
glazed ceramic in real life. Smoother and very slightly reflective,
distinct from plastic's own glossier, completely non-metallic read.

**A real architectural-review pass, confirmed rather than changed.**
Every `Materials.*` factory and every `ProceduralTexture` function was
checked for real callers this phase (the same audit that found
`softBox()` and `Materials.ground()` dead in earlier phases) — nothing
new turned up. `DecorationBehaviour.js`, the Builder's own "this object
is purely decorative" behaviour, was reviewed and found already exactly
as honest as it should be: it does nothing at all, on purpose, and says
so in its own comment.

**What was considered and deliberately left out (resolved, Sound &
Presence phase).** A ticking clock sound was the obvious pairing for a
functioning clock, and didn't survive the same restraint test
everything else in this phase did: a continuous tick needs real
distance-based volume to be believable, which nothing in `AudioSystem`
provided at the time. Positional audio arrived in the Sound & Presence
phase (`AudioSystem._computeDistanceGain()`), and with it, a chime —
not a continuous tick, which that phase's own brief ruled out on
separate grounds — on the hour. See `docs/AUDIO.md` for the full
account. Record-player ambience (crackle, hiss) remains left to
`docs/MUSIC.md`'s own domain — a real audio-quality feature for the
music system itself, not a decorative object question.

## Future extension points (Decorative Details)

- **A second framed piece or two**, if a future pass ever wants the
  walls to feel a little further along without tipping into the
  "decorated, not lived-in" read this phase deliberately avoided.

## Visual Identity phase — the shadow regression, actually understood

"The Workshop terrain correctly receives lighting but no longer
receives dynamic shadows as it previously did. Determine why shadow
reception was lost." Every terrain-side setting was already correct —
`this.mesh.receiveShadow = true`, a genuine `MeshStandardMaterial`,
correctly computed normals. The real cause lived one file away, in
`LightingSystem.js`, and had nothing to do with `TerrainSystem.js`
itself.

**The actual bug: a classic, well-documented three.js gotcha.** The
sun's shadow camera has its `near`/`far`/`left`/`right`/`top`/`bottom`
set directly as plain properties in `LightingSystem.init()` — but
`OrthographicCamera` (what a `DirectionalLight`'s shadow uses) only
ever recomputes its `projectionMatrix` in its own constructor, or when
`updateProjectionMatrix()` is called explicitly; nothing about setting
those properties afterward triggers it automatically, and three.js's
own shadow-map render path (`LightShadow.updateMatrices()`) reads
`camera.projectionMatrix` directly rather than deriving it fresh every
frame. That call was missing entirely — grepped for across the whole
codebase and found nowhere near `this.sun.shadow.camera`. The practical
effect: the shadow camera had been silently running on its
*construction-time default* frustum (a `DirectionalLightShadow`'s own
default camera is `±5, near 0.5, far 500`) this entire time, regardless
of what this file's own comments claimed — every "expand shadow
coverage" pass in this system's history (±6 → ±9 → the ±13 currently in
the code) changed a JavaScript property that nothing ever read for
rendering purposes.

**Why this specifically reads as a *terrain* regression.** The bug
itself predates the terrain rewrite — it's unrelated to
`TerrainSystem.js` and was presumably always there. But its visible
*impact* is what changed: a ±5 frustum pinned to the world origin
happens to roughly cover a single small room, which is what the
Workshop's entire outdoor "ground" used to be (a 48m patch plus an
infinitely-recentring flat plane that followed the player, so shadows
being limited to a small area around a fixed point was much less
noticeable). Once the terrain became one real 200m ground that doesn't
recentre, that same stale ±5 frustum left nearly the entire outdoor
world permanently outside the shadow camera's own view — exactly
"terrain correctly lit, never shadowed." One `updateProjectionMatrix()`
call, right after the properties it depends on are set, fixes every
future change to those properties too, not just this one.

**A worth-watching, not clearly broken, side effect — re-verified,
Version 3, Phase 2 ("Living Spaces").** `shadow.bias` and
`shadow.normalBias` (tuned to avoid shadow acne) were presumably tuned
against whatever was *actually* rendering at the time — which, given
this bug, was always the stale ±5 frustum, never the larger one the
comments describe. Restoring the real ±13 frustum spreads the same
1024×1024 shadow map texel budget across roughly 6x the area (in each
dimension), which coarsens shadow resolution and could plausibly want a
different bias value to look its best. Left unchanged at the time
rather than retuned blind, pending an actual rendered frame to judge —
that judging has now happened (real rendered frames, read back
pixel-by-pixel rather than eyeballed, since this environment's own
screenshot tooling proved unreliable): zero shadow acne detected across
ten scanlines of open terrain at a deliberately extreme ~3.4° grazing
sun angle, and a clean, sharp lit-to-shadow transition on a real
occluder with no intermediate banding. The existing values hold up at
the current ±13 frustum. See `docs/VISUAL_IDENTITY.md`'s own "Known
limitations" section for the full method and result.

## Visual Identity phase — terrain review

Confirmed against every item the brief named: materials (the terrain's
`MeshStandardMaterial` with `roughness: 0.95` already sits in the exact
same "very rough, non-reflective" family as the interior floor's own
`roughness: 0.95` — the two meet at the doorway threshold already
reading as one continuous, consistent world, not two different
surfaces), lighting (ordinary diffuse/ambient response was never the
reported problem, and wasn't touched), and shadow rendering (fixed
above). `_computeGroundHeight()` in `CameraSystem.js` already queries
`TerrainSystem.getHeightAt()` directly wherever the terrain patch
covers a point, falling back to flat `0` only outside it — the same
single source of truth for movement, collision, and Builder object
placement this system's own file comment already promises. No separate
rendering behaviour exists for terrain anywhere in the pipeline; the
brief's own "avoid introducing separate rendering behaviour for
terrain" was already true going into this phase, not something this
phase had to create.

