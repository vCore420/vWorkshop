# Atmosphere (Version 2, Phase 11)

"A living world is not one that constantly performs. A living world is
one that quietly notices" was Living World 2.0's own line (see
`docs/RESIDENT.md`'s "World Awareness" section) — this phase asks the
same question one layer down: not whether the Workshop's *systems*
notice each other, but whether the *place itself* feels like somewhere
to stand still in. "Teaching the Workshop how to breathe," not adding
more weather effects.

Nothing here is a new system bolted onto the side. Every change in this
phase deepens `TimeOfDaySystem`, `WorldEnvironmentSystem`,
`EnvironmentSystem`, and `AudioSystem` — the same four files
`docs/WORLD.md`'s own "Environment System" section already describes —
plus one small, genuinely new piece (Atmosphere Profiles) that follows
the exact shape every other "save a named thing" feature in this project
already uses. Read `docs/WORLD.md`'s Environment System section first if
you haven't; this document assumes it.

## Sky

"Richer dawn colours, golden hour, blue hour, improved sunset, richer
night sky" — before this phase, `TimeOfDaySystem`'s sky colour was a
single two-stop blend (a flat orange midpoint, a flat blue day colour).
It's now `SKY_GRADIENT` (`TimeOfDaySystem.js`) — eight ordered
`[altitude, colour]` stops, sampled by `MathUtils.sampleColorGradient()`
(a small generalisation of the existing `lerpColorHex`, walking a sorted
list instead of blending exactly two colours):

```
night → blue hour → civil twilight → dawn/dusk → golden hour → day
```

**Keyed by the sun's real altitude, not the clock hour.** This is the
detail that makes it correct rather than merely decorative: the exact
same table produces a correct sunrise *and* sunset, in every season and
at every latitude, because a low winter sun and a high summer one simply
pass through the same bands at different rates — there's no separate
morning/evening branch to keep in sync, and nothing to re-tune if
someone's `solarPosition()` data changes later. `sunColor` (the light's
own colour, as opposed to the sky's) keeps its existing fixed-hour
dawn/dusk blend, deliberately left alone — see "Known simplifications."

**Cloud cover now dims the night sky.** Real cloud cover hides stars and
dampens the moon; `WorldEnvironmentSystem._applyCelestialVisibility()`
multiplies each one's own base visibility (still entirely
`TimeOfDaySystem`'s to decide — moon phase, how dark it currently is) by
`1 - cloudCoverage * 0.7`, recomputed whenever either input changes. Two
independent facts, combined in exactly one place, neither needing to
know about the other.

**Morning mist.** Real mist is overnight radiative cooling, not a
weather *state* — it wouldn't belong in `WEATHER_STATES`. Instead,
`WorldEnvironmentSystem._dawnMistStrength()` is a small, standalone
contribution (a fixed local-hour window, peaking at 6am, fading out by
9am) that `_applyFog()` takes the *stronger* of against whatever the
current weather's own fog density already is — a calm, clear morning
still gets a little haze; an already-foggy or storming morning is
however foggy the weather says, never stacked thicker than either alone.
Suppressed while real precipitation is falling.

## Clouds

"Multiple cloud layers... variable density... natural cloud motion."
`WorldEnvironmentSystem._buildClouds()` now builds two independent
fields from one shared `_buildCloudLayer()` helper: the original low,
denser layer (closely tied to `cloudCoverage`, as before), and a second,
higher, sparser, more translucent one — cirrus-like, drifting at 1.8× the
low layer's own speed via a per-cloud `driftMultiplier`, so the two
layers visibly separate rather than moving as one mass. Real high cloud
does exactly this; no second wind value was needed to get it.

**Better cloud lighting.** Before this phase, every cloud sprite was flat
white regardless of conditions. `_updateCloudTint()` now blends white
toward `_baseSkyColor` (so clouds read as lit by whatever the sky itself
currently looks like — warm at golden hour, cool at night) and, on top
of that, toward the current weather's own tint at a reduced strength (so
a storm or overcast sky's clouds read visibly greyer, not just the
background around them). Applied to every cloud sprite's own material
colour each frame — cheap, since there are at most nineteen of them.

## Wind

Wind was already real and already shared before this phase —
`EnvironmentSystem.windSpeed`/`windDirectionRad`, smoothed with a gentle
gust wobble every frame, already drove rain drift, cloud drift, and
(via `WorldObjectsSystem`'s `swaysInWind` flag) every tree, bush, flower,
and grass patch in the Construction Library. This phase's own
contribution is connecting a genuinely new consumer to that exact same
shared value rather than inventing a second one: the wind/storm ambience
noise bed's own filter cutoff now breathes with live `windSpeed`
(`AudioSystem.update()`'s own wind-gust modulation — see "Environmental
Audio" below), so a gust audibly brightens the sound for a moment the
same way it visibly speeds up cloud drift and tree sway. "Future
foliage... future cloth... future environmental systems" all have
exactly the same one property to read from — nothing about this phase
changed what `windSpeed`/`windDirectionRad` mean or where they live.

## Environmental Audio

"Indoor ambience. Outdoor ambience... audio should respond naturally to
location." `AudioSystem` gained a fourth independent layer — Location —
sitting downstream of the two existing ambience gains rather than beside
them:

```
ambienceGain ──▶ locationFilterAmbience ──▶ masterGain
natureGain   ──▶ locationFilterNature   ──▶ masterGain
```

Each `locationFilter*` is a shared lowpass filter, checked against
`InteriorSystem.isInside()` on a slow throttle
(`AudioSystem._checkLocation()`, `LOCATION_CHECK_INTERVAL` = 0.6s —
indoor/outdoor doesn't need per-frame precision) — the exact capability
`InteriorSystem.js`'s own doc comment already named "muffling outdoor
sound" as a natural future use of, back when it was built for rain
occlusion alone.

**Presence, not just muffling.** A flat lowpass alone would make every
outdoor sound equally quieter indoors, which isn't how it actually
works — you still clearly hear rain drumming on a roof; wind is nearly
silent through a wall. `INDOOR_AMBIENCE_PROFILE` gives each ambience
type its own indoor gain multiplier on top of the shared filter (rain
1.0 — stays close and present; storm 0.88; wind 0.32 — heavily buried),
and nature gets its own fixed "distant birds through a wall" treatment.
Nothing here invents a third audio layer for "rain on windows"
specifically — the window pane streak overlay (`EnvironmentSystem.js`,
unchanged) already represents that visually; indoors, it's the same rain
sound, just heard through a wall instead of falling on one outdoors.

**Wind through trees.** `AudioSystem.update()` reads
`EnvironmentSystem.windSpeed` directly (a pull, not a push — that value
updates every frame with its own gust wobble, but `environment:changed`
only fires on a state *change*, not on every frame's own wobble) and
gently varies the current wind/storm ambience's own base filter
frequency around its resting point, throttled to five times a second.
A gust genuinely brightens the sound for a moment rather than holding
one flat, unchanging pitch.

## Nature

"Morning birds. Evening birds. Crickets. Insects... avoid excessive
repetition." `AudioSynth.createNatureAmbience()` grew from a flat
day/night pair into four phases, bucketed from the real clock hour
(`setHour()`, called from `AudioSystem`'s own `timeofday:changed`
listener):

- **Dawn** (4:30–8:00) — the brightest, densest bird chorus; the same
  `playBirdChirp()` used at a higher `brightness` and a shorter delay
  between calls.
- **Day** (8:00–17:00) — the original, sparser daytime chirp, unchanged
  in character.
- **Dusk** (17:00–20:30) — a warm mix: mostly a new, lower-pitched
  `DUSK_INSECT` trill (calmer and looser than the night cricket — reads
  as a different insect, not the same one quieter), with an occasional
  dimmer bird call.
- **Night** (everything else) — the original cricket trill, deliberately
  untouched (see "Known simplifications").

All four share exactly two synthesis functions (a parameterised chirp, a
parameterised trill) rather than four independent ones — the same
"texture, not tone" instinct the original day/night pair already
established, just with more places for it to apply.

## Rain

Continued from `docs/WORLD.md`'s own "Atmosphere" subsection — surface
darkening and wet surfaces are still honestly future work (see below),
but rain now *sounds* different depending on where you stand (the
Environmental Audio section above) on top of already looking different
per weather state and already falling as real geometry.

## Fog

Weather-driven fog density (Overcast, Fog, Mist, a storm's own haze) is
unchanged from `docs/WORLD.md`'s own account. This phase's one addition
is morning mist — see "Sky" above; it's fog-shaped in effect (the exact
same `scene.fog.near/far` calculation) but driven by time, not a weather
state, which is why it's documented as its own small mechanism rather
than a memo entry in `WEATHER_STATES`.

## Sun, Moon & Stars

Solar/lunar position, real moonrise/moonset, and star rotation are all
unchanged from `docs/WORLD.md`'s own "Astronomy" section — this phase's
contribution is "cloud cover influence" (see "Sky" above): a real
astronomical fact (an overcast night hides the sky) reaching a system
that already existed, rather than a new one. A real, modest constellation
catalogue was added afterward, in Version 4 Phase 9 — see
`docs/WORLD.md`'s own "Astronomy" section for the full account; it reuses
this phase's `_starVisibility`/`clearFactor` cloud-cover pipeline exactly
as-is, nothing about that mechanism needed to change for it.

### Constellation lines are off by default (Version 4, Phase 13)

The asterism lines joining each constellation's stars shipped always-on
in Phase 9. They are now **off unless a player switches them on**, from
the Atmosphere tab's own Stars section. The night sky should read as a
sky; the lines are something you turn on to learn the shapes, not a
permanent overlay drawn across them.

`settings.atmosphere.constellationLines` is the first genuinely
*persisted* setting that tab has ever had — everything else on it is a
live override that drives `TimeOfDaySystem`/`EnvironmentSystem` directly
and saves nothing. That distinction is the reason it needed its own
settings category rather than joining `graphics` (where
`update("graphics", …)` would flip the performance preset to `"custom"`
as a side effect, which says nothing true about a device's rendering
budget). Defaults to `false`, and `deepMerge` gives an older save the
default automatically — **no migration.**

`WorldEnvironmentSystem.setConstellationLinesVisible()` toggles `.visible`
rather than driving opacity to zero, so a player who leaves them off pays
nothing for them at all. Opacity is still recomputed on every sky change
regardless, which costs two multiplications and means switching them on
mid-scene shows them at the right brightness for the current sky
immediately.

**The catalogued stars had to get brighter to compensate**, since they
now carry the constellations alone out of a field of 320 others. This is
where a measurement changed the design: on a clear night the shared star
opacity is already **0.82**, so a brightness *multiplier* clips against
the material's 1.0 ceiling and delivers only 1.22× — the difference
compresses exactly when the sky is darkest and the shapes most want to be
findable. Opacity has almost no headroom up there. **Sprite size has no
ceiling at all**, so the step up is taken mostly there (2.4 → 2.9,
against the background field's 1.6), with the multiplier adding whatever
opacity headroom genuinely exists on hazier or moonlit nights. Measured
effective prominence is about **4×** the background field
(3.3× area × 1.2× opacity).

Deliberately *not* solved by dimming the background field to make room:
nobody asked for a darker sky, and buying contrast by taking brightness
away from 320 ordinary stars is a worse trade than taking it from a
ceiling that wasn't being used.

## Season Foundations

"Establish clean architectural foundations. Do not fully implement
seasonal gameplay." `Astronomy.getSeason(dayOfYear, latitude)` is the
entire foundation: a pure function, no new state, no migration, four
meteorological bands (day-of-year 79/172/266/355 — roughly the
equinoxes/solstices) with the names rotated a half-year for southern
latitudes rather than a second calculation. It's surfaced in exactly two
places this phase — `WorldAwareness.snapshot().season` (for any future
system that wants to ask "what does the world look like right now" the
same way it already asks about weather and time) and a read-only row in
the Atmosphere tab — plus a quiet mention folded into the window's own
summary line (`WindowOverlay.js`: "Clear, Summer — 14:30"). Nothing
currently *changes* because of the season; that's deliberately next
phase's problem, not this one's.

**Version 4, Phase 9d ("Seasonal Vegetation Colour") is that next
phase**, for vegetation specifically. `ConstructionLibrary.js`'s Nature
pieces (tree, bush, flower's stem, grassPatch) carry a new
`seasonalFoliage: true` flag alongside their existing `swaysInWind` one
— `ObjectCompiler.js` clones each tagged part's own material (the shared
`Materials.matte()` cache is keyed by hex string alone; mutating it in
place would retint every other object in the world sharing that exact
colour by coincidence) and records its authored base colour.
`WorldObjectsSystem._applySeasonalTint()` blends that base colour toward
a small fixed per-season table (`SEASON_FOLIAGE_TINT` — spring/summer
untinted, autumn a warm amber, winter dulled and greyed) via
`lerpColorHex()`, applied the instant a part spawns and on an occasional
90-second throttle thereafter (a season boundary is a once-per-~3-months
event, not something worth a per-frame cost). Resident behaviour and
deeper environmental change remain future work.

## Atmosphere Profiles

"Support creating and saving atmosphere profiles... Sunny Morning,
Golden Evening, Storm, Fog, Winter Morning, Summer Afternoon."
`AtmosphereProfileStore.js` follows the exact same "permanent
hand-authored set, live in code, never inside the mutable store array"
shape `AnimationLibraryStore.js` already established for its own default
clips — six built-in profiles (`BUILTIN_ATMOSPHERE_PROFILES`) that can be
applied but never edited or deleted, alongside anything a person saves
themselves. A profile is deliberately plain data — `{ id, name,
description, weather: { current, manualOverrides }, time: { hour } }` —
never a reference to `EnvironmentSystem`/`TimeOfDaySystem` themselves,
the same "no scene/camera concerns" boundary every other plain store
already respects (see `docs/ARCHITECTURE.md`'s Persistence section).

**Capturing and applying both live in the Atmosphere tab**
(`SettingsApp.js`), not in the store — the same split
`BuildModeSystem.js`/`BlueprintStore.js` already draws (the store holds
the shape; the code with direct access to what's live does the
reading/writing). "Save current as profile…" reads
`environmentSystem.current`/`manualOverrides` and
`timeOfDaySystem.currentTime` directly into a new profile; "Apply" hands
a profile's own fields straight to `setWeather()` /
`setManualOverride()` / `setTime()` — the exact same calls every other
control on the tab already makes, nothing new to interpret. Applying a
profile switches weather to Manual mode (`setWeather()` always does)
which is deliberate: recalling "Storm" should show a storm regardless of
what Workshop Dynamic or Live Weather currently have going on, visibly
and honestly reflected in the Mode selector rather than silently
overridden underneath it.

## Atmosphere Application

"The application should become the central place for controlling
environmental conditions... should feel like a creative environment
rather than simply another settings page." The Settings app's own
Atmosphere tab (added in an earlier phase — see `SettingsApp.js`'s own
top comment) is where this lives, per this project's own stated
non-goal: "a traditional settings menu... the computer's Settings app is
the one deliberate exception." Atmosphere Profiles now open the tab (the
creative starting point), followed by the existing live weather/wind/
manual-override controls and the Sun/Moon/Stars/Season read-outs (the
fine detail for anyone who wants to adjust further) — one tab, not a
second app, matching "everything should feel like one Workshop rather
than many separate applications."

## Living World Integration

"Residents should naturally respond to weather, time, wind, atmosphere,
environmental conditions. Do not create scripted events." Layered
directly into `ResidentController._windowWatchWeights()` — the exact
weighted-merge mechanism the Living World phase already established, not
a new decision system: a windy day (the real `windy` weather state, not
an arbitrary threshold) now also counts as "worth watching" from the
window alongside rain and golden hour, and a storm specifically adds a
pull toward the Quiet Corner — sheltering, reusing the identical pull
night already established rather than inventing a second one. See
`docs/RESIDENT.md`'s own "Resident awareness, extended" section for the
exact wording. Never guaranteed, never scripted — one more weighted
option among several in the same ordinary idle-location pick that always
existed.

**Restored, Version 4 Phase 7a.** `_windowWatchWeights()` lived on
`ResidentController.js`, retired in Phase 7 along with the rest of it and
offline for one phase; `BeingController._residentLocationWeights()` is
the reconstruction — see `docs/RESIDENT.md`'s own "A quiet habit"
correction for the full account, including a live statistical
verification of the storm/Quiet-Corner pull specifically.

## Known simplifications (by design, for this phase)

- **`sunColor` (the light's own colour) keeps its original fixed-hour
  dawn/dusk blend** — only the *sky's* colour moved to the altitude-based
  gradient this phase. Unifying the two was judged a real but separate
  cleanup, not required for "the sky should become something players
  genuinely enjoy watching," and risked touching how the room itself is
  lit for a phase about atmosphere, not lighting.
- **The night cricket's own cadence is untouched** — a real bug (an
  "over-electronic cricket sound") was root-caused and fixed in an
  earlier phase; this phase added new phases around it rather than
  risking that fix by changing its own timing.
- **No wet surfaces or puddles** — both remain named future work (see
  `docs/WORLD.md`'s own "Future extension points"); rain sounding
  different indoors/outdoors and the roof/ground distinction are
  audio-only this phase, not a new visual. (A real falling-particle snow
  visual, also once named here, shipped in Version 4 Phase 9b — see
  `docs/WORLD.md`'s own "Falling Snow" section.)
- **Morning mist uses a fixed local-hour window, not sun-altitude** — the
  same honest simplification `sunColor`'s own dawn/dusk blend already
  uses, for the same reason: a small atmospheric flourish, not something
  that needs to be exact to the minute or correct at every latitude.
- **Season Foundations changes vegetation colour only** (Phase 9d) —
  resident behaviour and deeper environmental change remain by-design
  future work; see "Season Foundations" above.
- **Atmosphere Profiles don't capture Moon Phase** — `time` only ever
  carries `hour`; a profile's moon looks like whatever the real calendar
  date currently gives it (or whatever manual Moon Phase override was
  already set before applying). Judged a reasonable, honest boundary —
  "atmosphere" is weather and time of day, not a moon-phase preset.
- **The indoor/outdoor check is proximity-only, on a 0.6s throttle** —
  the same "doesn't need per-frame precision" trade-off every other slow
  poll in this project already makes; crossing a doorway takes up to
  0.6s (plus the filter's own 1.2s ease) to be heard, not instant.

## Future extension points

- **A genuinely custom embodiment reacting to atmosphere** — Bubble
  already reacts through `_windowWatchWeights()`; a Being doing the same
  is the natural next step, following `docs/RESIDENT.md`'s own
  "Beings reading `WorldAwareness` too" extension point.
- **Resident behaviour reacting to season** — vegetation colour shipped
  in Phase 9d (see "Season Foundations" above); day length already
  varies realistically for free, inherent in the existing
  `solarPosition()` formula (see `docs/WORLD.md`'s own "Astronomy"
  section). A resident's own idle-location weighting or mood reacting to
  season is the one candidate from the original three-item list still
  genuinely open.
- **Per-property Atmosphere Profile editing** — profiles currently
  capture-and-apply as a whole; adjusting one saved profile's own wind
  without re-saving the entire thing would be a natural Builder-style
  "Update" action, the same one Blueprints already have.
- (A visible lightning bolt and thunder, and real falling snow, were
  both once named here as future work — both have since shipped, in
  Version 4 Phase 9b and 9c respectively; see `docs/WORLD.md`'s own
  "Falling Snow" and "Lightning + Thunder" sections.)
- **Moon-phase-aware Atmosphere Profiles** — see "Known simplifications"
  above; the seam (`time.moonPhaseOverride`) would be a small, additive
  field.
- **Event-driven location audio** — `AudioSystem._checkLocation()` polls
  on a throttle; a future system wanting to react to a doorway crossing
  the instant it happens would need a real `interior:entered`/
  `interior:exited` event from `InteriorSystem`, which doesn't exist yet
  (`isInside()` remains query-only).
