# Audio (Version 2, Phase 21 — Sound & Presence, v2.2.1)

`AudioSystem.js` and `AudioSynth.js` have grown substantially across
almost every phase of Version 2 — a paper shuffle here, a chair creak
there — without ever having one place that describes the whole thing.
This document is that place, written at the point the Workshop's audio
finally became substantial enough to need it.

"The objective is not simply to add more audio. The objective is to
give the Workshop presence... closing your eyes should still tell you
you're inside the Workshop." Everything below is in service of that,
not volume for its own sake — see "What was reviewed and deliberately
left alone" at the end for what this phase considered and chose not to
add.

## Architecture

Four independent layers, all mixed through one `masterGain` (see
`AudioSystem.js`'s own class comment for the full breakdown):

- **Music** — a single generative track, playable through the phone/
  computer's own Media apps, or a custom Builder object via
  `AudioSourceBehaviour`.
- **Weather ambience** — a noise bed keyed to the current environment
  (wind/rain/storm), with live wind-gust modulation on top of the base
  colour (see `update()`'s own wind-gust timer).
- **Nature ambience** — a four-phase dawn/day/dusk/night bird-and-insect
  bed, quieted (not silenced) under heavier precipitation.
- **Location** — indoors vs outdoors (via `InteriorSystem`), muffling
  both the weather and nature beds through a shared, eased lowpass
  filter per layer, rather than a hard cut at the doorway.

All four already existed before this phase. What this phase added is a
fifth, structurally different kind of sound: short, one-shot effects
tied to a specific moment rather than a continuous bed.

## The interaction-sound family

One entry point — `AudioSystem.playInteractionSound(kind, options)` —
for every one-shot sound in the Workshop, `kind` selecting which. Seven
now exist, three of them new this phase:

| kind | phase introduced | trigger | character |
|---|---|---|---|
| `paperShuffle` | Workbench | leaning in/out at the clipboard; browsing the archive shelf; the pinboard | flat noise hiss, fast decay |
| `chairCreak` | Desk | sitting/standing at the computer | mid bandpass sweep |
| `doorCreak` | Workshop Interior | opening/closing the front doors | lower, slower sweep |
| `buildingCreak` | **Sound & Presence** | self-scheduled, indoors only, every 3-7 real minutes | lowest, slowest sweep, no player cause at all |
| `drawerSlide` | **Sound & Presence** | opening tool storage | short, high, grainy sweep |
| `clockChime` | **Sound & Presence** | the wall clock's hands crossing an hour | two sustained sine tones, the Workshop's first tonal (non-noise) sound |
| `residentThinking` | **Sound & Presence** | Bubble's `isThinking` turning true | one quick triangle-wave flicker, the quietest sound in the Workshop |

**Every one of the four noise-sweep sounds (`chairCreak`, `doorCreak`,
`buildingCreak`, `drawerSlide`) now shares one implementation** —
`playFilteredNoiseBurst()` in `AudioSynth.js` — differing only in six
named numbers (start/end frequency, sweep time, Q, peak gain, attack,
decay). They were four separate, hand-copied functions before this
phase; see "Architectural review" below for why this was worth doing
now and not sooner.

## Positional audio

Before this phase, every interaction sound played at one flat volume no
matter where the player stood — a door creak from across the room was
exactly as loud as one at arm's length. `AudioSystem._computeDistanceGain()`
reuses the exact `_cameraSystem.position` reference this file already
reads for indoor/outdoor detection (no new dependency) to scale a
sound's gain by distance from an optional `options.position`: full
volume within 3m, easing to a small, never-quite-silent floor by 14m.
Every existing call site (the workbench clipboard, the computer chair,
the front doors) now passes its own object's real world position, not
just the three new sounds built this phase.

This is deliberately *not* full 3D panning/attenuation via
`THREE.PositionalAudio` — the Workshop's entire audio graph is hand-built
on the raw Web Audio API (`AudioContext`, `GainNode`, `BiquadFilterNode`),
and a distance-based gain scalar answers "spatial positioning" (the
brief's own words) without introducing a second audio API alongside the
one every other sound in this system already uses.

## Building presence

`AudioSystem._updateBuildingPresence()` — a self-scheduling timer (a
genuinely wide, randomised 3-7 real-minute window, not a fixed
interval; a metronomic creak would read as a mechanism, not a
building), indoors only, picking from a few fixed, plausible spots
(near the workbench, near the shelving, the ceiling overhead) rather
than a random point in mid-air. This resolves a deferral from the
Workshop Interior phase (see `docs/WORLD.md`'s own account there) —
that phase's own concern was "an unprompted creak would be the first
sound with no cause a player could connect it to"; this phase's own
brief ("avoid continuous looping audio where occasional, contextual
sounds would feel more believable... the Workshop should breathe")
directly names the exact behaviour that concern was worried about as
the *desired* one, which is what makes implementing it now the right
call rather than a reversal.

## The clock finally chimes

Deferred in the Decorative Details phase for lack of positional audio
(see `docs/WORLD.md`'s Phase 19 account) — now that positional gain
exists, `LightingSystem._checkClockChime()` compares the integer hour
against the last-seen one (on `_onTimeChanged`'s own throttled sample)
and plays a soft two-tone chime, at the clock's own real world
position, exactly on a crossing. Deliberately *not* a continuous
tick-tock — "avoid continuous looping audio where occasional,
contextual sounds would feel more believable" ruled that out
completely; a chime on the hour is the same instinct a real longcase
clock already applies.

## Storage gained a sound, generically

Tool storage's drawer sound was deferred in the Furniture & Storage
phase (see `docs/FURNITURE.md`) specifically because it had no
dedicated system of its own the way the computer, workbench, and front
doors do — adding a sound would have meant either a new system (out of
scope then) or a furniture *definition file* reaching directly into
`AudioSystem`, breaking the "furniture describes geometry; systems own
behaviour" split every other object respects.

This phase resolves it generically instead: `FurnitureSystem` — the one
system that already wires up every furniture piece's interaction —
gained an optional `soundOnInteract` string on the `interaction` config.
When present, `FurnitureSystem` itself (not the furniture file) plays
that sound at the piece's own real world position before running
whatever the definition's own `onInteract` already does. Three furniture
pieces use it as of this phase: tool storage (`drawerSlide`, the
originally-deferred one), and the shelving archive and the pinboard
(both `paperShuffle` — browsing books or reading notes is the same
physical gesture the Workbench's own clipboard sound already
represents, reused rather than invented twice more).

## Residents gained their first sound

Bubble had no audio at all before this phase — reviewed and found
genuinely absent, not just quiet. `ResidentController._maybeAnnounceThinking()`
played a single, very soft cue exactly on the false→true edge of
`residentBehaviour.isThinking` (never continuously while thinking,
never on the way back to idle — thinking *ending* has no equivalent
moment worth marking), at Bubble's own current position for real
distance falloff. The quietest, briefest sound in the entire Workshop,
by design — "communicate life without becoming distracting" is a
description of restraint, not licence to give a chatty companion a full
sound design.

**Restored, Version 4 Phase 7a.** `ResidentController.js` — the
per-frame system that used to watch a shared `residentBehaviour` for this
edge transition — is deleted for good; through the end of Phase 7, with
`ResidentBehaviour` now constructed fresh per conversation, nothing
outside that one conversation was left watching its `isThinking` field
for a false→true edge to cue a sound from, and the resident went one
phase entirely silent. `ResidentConversation.js` gained a new optional
`audioSystem` dependency and calls it directly —
`audioSystem?.playInteractionSound("residentThinking", { position:
bundle.residentState.currentPosition })` — right at the existing
`residentBehaviour.setThinking(true)` call, no per-frame watcher needed
at all. Verified live: the call fires synchronously the moment a message
is sent (before Ollama's own response even comes back), with a real,
non-null position matching the resident's own actual location at the
time.

## Architectural review

- **A real volume inconsistency, found and fixed.** `playPaperShuffle`
  — the very first interaction sound built, before there was any family
  to be consistent with — had a peak gain of `0.5`, noticeably louder
  than every sound built in later phases (`0.18`-`0.32`). Nobody had
  gone back to check it against the family that grew up around it.
  Brought down to `0.3`, in line with `chairCreak`/`doorCreak`.
- **A real duplication, found and resolved.** `playChairCreak`,
  `playDoorCreak`, `playBuildingCreak`, and `playDrawerSlide` were four
  separate, hand-written copies of the identical noise/bandpass-sweep/
  envelope graph. Extracted into `playFilteredNoiseBurst()`; every
  numeric value preserved exactly during the extraction, so this changed
  nothing audible — a pure maintainability improvement, not a retuning.
- **No dead sounds or unused definitions found.** Every exported
  function in `AudioSynth.js` was checked for a real caller; all seven
  interaction-sound kinds are reachable from at least one place.

## What was reviewed and deliberately left alone

- **Windows** — "object audio... windows" was checked directly. Unlike
  a door, a drawer, or a chair, a window pane doesn't move when you
  look through it (`overlayId: "window"` just opens a view — see
  `RoomLayoutSystem.js`); there's no physical gesture for a sound to
  represent, so adding one would be decoration, not presence.
- **The phone** — reviewed for the same reason. Raising a phone to look
  at it is silent in reality too; a UI-open sound here would be the
  first sound in the Workshop's library with no physical cause behind
  it at all, which this phase's own "every sound should earn its place"
  standard argues against.
- **Record-player ambience** (crackle, hiss while music plays) — a real
  audio-*quality* feature that belongs to `src/music/MusicSystem.js`
  and `docs/MUSIC.md`'s own domain, not this system, which has no
  involvement in the personal music library at all.
- **Day/night ambience** — already built out across the four-phase
  nature bed; confirmed still correct, not touched further.

## Known limitations / future opportunities

- **Distance falloff is a straight-line gain scalar, not true 3D
  panning.** A sound to the player's left and one to their right at the
  same distance sound identical — directionally accurate spatial audio
  would need `THREE.PositionalAudio` or an `AudioListener`-driven pan,
  a bigger architectural addition than this phase's own scope.
- **`BUILDING_CREAK_POSITIONS` is a fixed, hand-picked list** rather
  than derived from actual furniture/room geometry — genuinely fine at
  the Workshop's current, single-room scale, but wouldn't automatically
  extend to a future room without updating this list by hand.
