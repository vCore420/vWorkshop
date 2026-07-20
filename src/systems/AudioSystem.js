import * as THREE from "three";
import { playAmbientTrack, createNoiseSource, createNatureAmbience, playPaperShuffle, playChairCreak, playDoorCreak, playBuildingCreak, playDrawerSlide, playClockChime, playResidentThinking, getTrackList } from "../utils/AudioSynth.js";
import { CameraSystem } from "./CameraSystem.js";
import { InteriorSystem } from "./InteriorSystem.js";
import { EnvironmentSystem } from "./EnvironmentSystem.js";
import { clamp } from "../utils/MathUtils.js";

// Atmosphere phase — "indoor ambience, outdoor ambience... audio should
// respond naturally to location." One shared lowpass filter downstream
// of each layer's own gain (see resumeContext()) gives every ambience
// the generic "heard through walls" muffling; these per-ambience-type
// multipliers then decide how much *presence* each specific sound keeps
// once indoors — rain on the roof stays close and audible (you very much
// still hear it), wind is heavily buried (a wall genuinely blocks moving
// air in a way it doesn't block a heavy patter), storm sits between the
// two. Nothing here invents a third audio layer for "rain on windows" —
// the window pane streak overlay (EnvironmentSystem.js) already
// represents that visually; this is the same rain sound, just heard
// through a wall instead of falling on one directly outdoors.
const INDOOR_AMBIENCE_PROFILE = {
  rain: { cutoff: 3200, gainMult: 1 },
  storm: { cutoff: 2600, gainMult: 0.88 },
  wind: { cutoff: 650, gainMult: 0.32 },
};
const OUTDOOR_FILTER_CUTOFF = 19000; // effectively unfiltered — a plain, high lowpass ceiling rather than bypassing the node entirely, so ramping toward it stays a lowpass sweep, not a click
const INDOOR_NATURE_CUTOFF = 1100; // "distant birds" through a wall
const INDOOR_NATURE_GAIN_MULT = 0.45;
const LOCATION_CHECK_INTERVAL = 0.6; // seconds — indoor/outdoor doesn't need checking every frame
const WIND_GUST_MODULATION_INTERVAL = 0.2;
// Sound & Presence phase — "building creaks... should remain subtle and
// infrequent." A genuinely wide, randomised window (3-7 real minutes)
// rather than a fixed interval — a metronomic creak would read as a
// mechanism, not a building. A few fixed, plausible spots (old wooden
// structures creak from their joints and beams, not from mid-air) rather
// than a random point anywhere in the room.
const BUILDING_CREAK_MIN_INTERVAL = 180;
const BUILDING_CREAK_MAX_INTERVAL = 420;
const BUILDING_CREAK_POSITIONS = [
  new THREE.Vector3(-3.35, 1.6, -0.6), // near the workbench
  new THREE.Vector3(3.8, 1.8, -0.8), // near the shelving
  new THREE.Vector3(0, 2.85, 0), // the ceiling, roughly overhead
];

/**
 * AudioSystem
 * -----------
 * Three independent audio layers, mixed together:
 *   - Music: a single generative track, played through the `audioSource`
 *     world-object behaviour (see AudioSourceBehaviour.js) — a simple
 *     "this custom object plays one ambient tune" use case, distinct from
 *     the real personal library the music cabinet opens (see
 *     src/music/MusicSystem.js and docs/MUSIC.md), which this system has
 *     no involvement in at all.
 *   - Weather ambience: a noise bed tied to the current environment (wind,
 *     rain, a heavier storm mix). Controlled entirely by
 *     EnvironmentSystem's events — no direct coupling.
 *   - Nature ambience: a four-phase dawn/day/dusk/night bird-and-insect
 *     bed — controlled by TimeOfDaySystem's own hour, and quieted down
 *     (not silenced) during heavier precipitation, since birdsong over a
 *     rainstorm reads as a mistake, not atmosphere. This is a second,
 *     independent gain from the weather layer, not a replacement for it —
 *     both can be audible at once, the way a light rain with birdsong
 *     easing back in as it clears actually sounds.
 *   - Location: indoors vs outdoors, checked against InteriorSystem —
 *     see the INDOOR_AMBIENCE_PROFILE comment below.
 *
 * The AudioContext can only start after a user gesture (browser autoplay
 * policy), so `resume()` is called from the entry screen's "Step inside"
 * button — see main.js.
 */
export class AudioSystem {
  constructor() {
    this.context = null;
    this.musicGain = null;
    this.ambienceGain = null;
    this.natureGain = null;
    this.masterGain = null;
    this.currentTrack = null;
    this.currentAmbience = null;
    this.nature = null; // the createNatureAmbience() controller, once the context exists
    this.volume = 0.6;
    this.isPlaying = false;
    this._pendingTrackId = null;
    this._lastAmbienceId = null;
    this._precipitation = 0;
    // Atmosphere phase — location + live wind (see INDOOR_AMBIENCE_PROFILE
    // and update()'s own wind-gust modulation).
    this._cameraSystem = null;
    this._interiorSystem = null;
    this._environmentSystem = null;
    this._indoor = false;
    this._locationCheckTimer = 0;
    this._windGustTimer = 0;
    // Sound & Presence phase — see BUILDING_CREAK_MIN/MAX_INTERVAL above
    // and _updateBuildingPresence() below. Randomised immediately so the
    // very first creak doesn't always land at the same, predictable
    // moment after the Workshop loads.
    this._buildingCreakTimer = this._randomCreakInterval();
    // Settings-driven multipliers (Settings app's Audio tab), layered on
    // top of this system's own existing volume/balance choices below,
    // rather than replacing them — see setVolumeMultipliers.
    this._masterMultiplier = 1;
    this._musicMultiplier = 1;
    this._ambientMultiplier = 1;
    this._effectsMultiplier = 1;
    this._ambiencePeak = 0; // the current ambience's own target level (storm/rain/wind) — remembered so a multiplier change can rescale a fade already in progress
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem); // resolved once — safe regardless of registration order, see ARCHITECTURE.md's own note on this pattern
    this._interiorSystem = engine.getSystem(InteriorSystem);
    this._environmentSystem = engine.getSystem(EnvironmentSystem);
    engine.events.on("environment:changed", ({ ambience, precipitation }) => {
      this._lastAmbienceId = ambience;
      this._precipitation = precipitation ?? 0;
      this._setAmbience(ambience);
      this._updateNatureIntensity();
    });
    engine.events.on("timeofday:changed", ({ hour }) => {
      this.nature?.setHour(hour);
    });
    engine.events.on("persistence:save", (bag) => {
      bag.audio = { trackId: this.currentTrack?.id ?? null, isPlaying: this.isPlaying, volume: this.volume };
    });
    engine.events.on("persistence:load", (bag) => {
      if (!bag?.audio) return;
      this.volume = bag.audio.volume ?? this.volume;
      this._pendingTrackId = bag.audio.isPlaying ? bag.audio.trackId : null;
    });
  }

  /** Must be called from within a user-gesture handler (click, keydown). */
  resumeContext() {
    if (this.context) {
      this.context.resume();
      return;
    }
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.volume * this._masterMultiplier;
    this.masterGain.connect(this.context.destination);

    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = this._musicMultiplier;
    this.musicGain.connect(this.masterGain);

    // "Indoor ambience. Outdoor ambience... audio should respond
    // naturally to location." One shared lowpass per layer, downstream
    // of that layer's own gain — indoors, both ease toward a lower
    // cutoff (see _applyLocationFilter()); outdoors, toward
    // OUTDOOR_FILTER_CUTOFF, which is high enough to be effectively no
    // filtering at all. Built at the outdoor value; _applyLocationFilter()
    // below corrects it to the player's real starting location (indoors,
    // in the Workshop) before the first frame renders, rather than
    // waiting for update()'s own throttled check to notice.
    this._locationFilterAmbience = this.context.createBiquadFilter();
    this._locationFilterAmbience.type = "lowpass";
    this._locationFilterAmbience.frequency.value = OUTDOOR_FILTER_CUTOFF;
    this._locationFilterNature = this.context.createBiquadFilter();
    this._locationFilterNature.type = "lowpass";
    this._locationFilterNature.frequency.value = OUTDOOR_FILTER_CUTOFF;

    this.ambienceGain = this.context.createGain();
    this.ambienceGain.gain.value = 0.25;
    this.ambienceGain.connect(this._locationFilterAmbience);
    this._locationFilterAmbience.connect(this.masterGain);
    this.natureGain = this.context.createGain();
    this.natureGain.gain.value = 0.3;
    this.natureGain.connect(this._locationFilterNature);
    this._locationFilterNature.connect(this.masterGain);

    if (this._pendingTrackId) {
      this.playTrack(this._pendingTrackId);
      this._pendingTrackId = null;
    }
    this._setAmbience(this._lastAmbienceId);
    this.nature = createNatureAmbience(this.context, this.natureGain);
    this.nature.setHour(12); // a harmless starting guess — corrected on the very next timeofday:changed tick
    this._updateNatureIntensity();
    this._checkLocation(true); // establish the real indoor/outdoor state immediately rather than waiting a full LOCATION_CHECK_INTERVAL
  }

  getTrackList() {
    return getTrackList();
  }

  playTrack(trackId) {
    if (!this.context) return;
    this.currentTrack?.stop();
    this.currentTrack = playAmbientTrack(this.context, this.musicGain, trackId);
    this.isPlaying = true;
    this.engine.events.emit("audio:trackChanged", { id: this.currentTrack.id, title: this.currentTrack.title });
  }

  stop() {
    this.currentTrack?.stop();
    this.currentTrack = null;
    this.isPlaying = false;
    this.engine.events.emit("audio:trackChanged", { id: null, title: null });
  }

  togglePlay() {
    if (this.isPlaying) this.stop();
    else if (this.currentTrack) this.playTrack(this.currentTrack.id);
    else this.playTrack(getTrackList()[0].id);
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.masterGain) this.masterGain.gain.linearRampToValueAtTime(this.volume * this._masterMultiplier, this.context.currentTime + 0.1);
  }

  /** Called by SettingsSystem whenever the Audio tab changes. Layered on
   *  top of this system's own volume/balance values (see the constructor
   *  comment) rather than replacing them. `effects` (Settings' own
   *  "Effects Volume" slider) genuinely does something as of the
   *  Workbench phase — see `playInteractionSound()`'s own comment for
   *  why it was inert before this. */
  setVolumeMultipliers({ master, music, ambient, effects }) {
    this._masterMultiplier = master;
    this._musicMultiplier = music;
    this._ambientMultiplier = ambient;
    this._effectsMultiplier = effects ?? this._effectsMultiplier;
    if (!this.context) return;
    this.masterGain.gain.linearRampToValueAtTime(this.volume * this._masterMultiplier, this.context.currentTime + 0.1);
    this.musicGain.gain.linearRampToValueAtTime(this._musicMultiplier, this.context.currentTime + 0.1);
    this._applyLocationFilter(); // re-applies the ambience gain (with the indoor multiplier folded in) and nature's own intensity together, rather than duplicating that math here
  }

  /** Nature's own target level, before EnvironmentSystem or Settings say
   *  otherwise: quieted under heavier precipitation (birdsong over a
   *  downpour reads as a mistake), quieted further indoors ("distant
   *  birds" through a wall), scaled by the same ambient multiplier the
   *  weather layer already respects. */
  _updateNatureIntensity() {
    if (!this.nature) return;
    const precipitationQuiet = 1 - Math.min(1, this._precipitation * 0.9);
    const locationMult = this._indoor ? INDOOR_NATURE_GAIN_MULT : 1;
    this.nature.setIntensity(0.5 * precipitationQuiet * this._ambientMultiplier * locationMult);
  }

  /** Recomputes whether the player is currently indoors (via
   *  InteriorSystem — the same "one generic question, architected once"
   *  capability its own doc comment already names "muffling outdoor
   *  sound" as a natural future use of) and, only on an actual change
   *  (or when `force` is set, from resumeContext()'s own first call),
   *  re-applies every location-dependent level. Called from update() on
   *  a slow throttle — indoor/outdoor doesn't need checking every frame. */
  _checkLocation(force = false) {
    const pos = this._cameraSystem?.position;
    const indoor = pos ? (this._interiorSystem?.isInside(pos) ?? false) : this._indoor;
    if (indoor !== this._indoor || force) {
      this._indoor = indoor;
      this._applyLocationFilter();
    }
  }

  /** "Indoor ambience. Outdoor ambience... rain on roof... wind through
   *  trees... audio should respond naturally to location." Eases (never
   *  snaps) the two shared location filters toward the indoor or outdoor
   *  cutoff, and re-applies the current ambience's own indoor gain
   *  multiplier (see INDOOR_AMBIENCE_PROFILE) and nature's own (see
   *  _updateNatureIntensity()) together, so a doorway crossing reads as
   *  one coherent change rather than several small ones landing at
   *  slightly different times. */
  _applyLocationFilter() {
    if (!this.context) return;
    const RAMP = 1.2;
    const t = this.context.currentTime;
    const profile = INDOOR_AMBIENCE_PROFILE[this._lastAmbienceId] ?? { cutoff: 900, gainMult: 0.5 };
    this._locationFilterAmbience.frequency.linearRampToValueAtTime(this._indoor ? profile.cutoff : OUTDOOR_FILTER_CUTOFF, t + RAMP);
    this._locationFilterNature.frequency.linearRampToValueAtTime(this._indoor ? INDOOR_NATURE_CUTOFF : OUTDOOR_FILTER_CUTOFF, t + RAMP);
    if (this.currentAmbience) {
      const mult = this._indoor ? profile.gainMult : 1;
      this.currentAmbience.gain.gain.linearRampToValueAtTime(this._ambiencePeak * this._ambientMultiplier * mult, t + RAMP);
    }
    this._updateNatureIntensity();
  }

  _setAmbience(ambienceId) {
    if (!this.context) return; // resumeContext() re-applies _lastAmbienceId once a context exists
    if (this.currentAmbience?.id === ambienceId) return;
    this._stopAmbience();
    if (!ambienceId) return;

    const source = createNoiseSource(this.context);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = { rain: 1800, storm: 2200, wind: 500 }[ambienceId] ?? 500;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceGain);
    source.start();
    this._ambiencePeak = { rain: 0.9, storm: 1, wind: 0.5 }[ambienceId] ?? 0.5;
    const indoorMult = this._indoor ? (INDOOR_AMBIENCE_PROFILE[ambienceId]?.gainMult ?? 0.5) : 1;
    gain.gain.linearRampToValueAtTime(this._ambiencePeak * this._ambientMultiplier * indoorMult, this.context.currentTime + 1.5);
    // `filter`/`baseFrequency` kept on the record (not just closure-
    // locals) so update() can live-modulate the cutoff with real wind
    // gusts, varying around this base rather than overwriting it — see
    // "Wind through trees" in update()'s own comment.
    this.currentAmbience = { id: ambienceId, source, filter, baseFrequency: filter.frequency.value, gain };
  }

  _stopAmbience() {
    if (!this.currentAmbience) return;
    const { source, gain } = this.currentAmbience;
    const t = this.context.currentTime;
    gain.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => source.stop(), 1100);
    this.currentAmbience = null;
  }

  /** Two independent, both throttled, slow checks — neither needs
   *  per-frame precision:
   *   - Indoor/outdoor (`_checkLocation`) — LOCATION_CHECK_INTERVAL.
   *   - "Wind through trees" — the current ambience's own base filter
   *     cutoff (see _setAmbience's own `baseFrequency`) breathes with
   *     EnvironmentSystem's *live* windSpeed (already gust-smoothed
   *     there every frame — see that file's own `_windGustPhase`), for
   *     wind/storm specifically; a gust genuinely brightens the noise
   *     bed for a moment, the same way real wind moving through trees
   *     swells and fades rather than holding one flat, unchanging pitch.
   *     Pulled directly from EnvironmentSystem rather than waiting for
   *     its own `environment:changed` event, which only fires on a
   *     state *change*, not on every frame's own gust wobble.
   */
  /** Workshop Workbench phase — "interaction sounds... audio should
   *  remain understated and believable." The one entry point for every
   *  short, one-shot sound effect in the Workshop — `kind` selects which
   *  (today, only `"paperShuffle"`), rather than a dedicated method per
   *  sound, so a future door or drawer reaches for this same method
   *  with a new `kind` instead of building its own audio graph from
   *  scratch. Routes through `masterGain` (so the Master Volume slider
   *  still applies, the same as every other sound this system makes)
   *  scaled by `_effectsMultiplier` — Settings' own "Effects Volume"
   *  slider existed since early in Version 2 but had nothing to control
   *  until this phase gave the Workshop its first real sound effect.
   *  Silently does nothing before the AudioContext exists (the same
   *  "resumeContext() hasn't happened yet" case every other sound in
   *  this file already tolerates) — missing a one-shot effect before the
   *  very first click has even resumed audio is inaudible regardless.
  /** Sound & Presence phase — "spatial positioning... nothing should
   *  feel disconnected." Every interaction sound before this phase
   *  played at one flat volume no matter where the player actually
   *  stood relative to the object making it — a door creak from across
   *  the room was exactly as loud as one right next to your ear. A
   *  simple distance falloff against the same `_cameraSystem.position`
   *  this file already reads for indoor/outdoor detection, not a new
   *  dependency: full volume within `NEAR`, easing to a small (never
   *  quite zero — a real sound this close by is still faintly audible,
   *  not a hard cliff) floor by `FAR`. No `position` supplied (an
   *  existing call site that hasn't been updated, or genuinely
   *  position-less audio) plays at full volume, unchanged from before
   *  this phase. */
  _computeDistanceGain(position) {
    if (!position || !this._cameraSystem?.position) return 1;
    const NEAR = 3; // metres — full volume this close or closer
    const FAR = 14; // metres — the quiet floor beyond this distance
    const FLOOR = 0.06;
    const dist = this._cameraSystem.position.distanceTo(position);
    if (dist <= NEAR) return 1;
    if (dist >= FAR) return FLOOR;
    return 1 - ((dist - NEAR) / (FAR - NEAR)) * (1 - FLOOR);
  }

  /** Workshop Workbench phase — "interaction sounds... audio should
   *  remain understated and believable." The one entry point for every
   *  short, one-shot sound effect in the Workshop — `kind` selects which,
   *  rather than a dedicated method per sound, so a future door or
   *  drawer reaches for this same method with a new `kind` instead of
   *  building its own audio graph from scratch. Routes through
   *  `masterGain` (so the Master Volume slider still applies, the same
   *  as every other sound this system makes) scaled by
   *  `_effectsMultiplier` — Settings' own "Effects Volume" slider existed
   *  since early in Version 2 but had nothing to control until this
   *  phase gave the Workshop its first real sound effect. Silently does
   *  nothing before the AudioContext exists (the same "resumeContext()
   *  hasn't happened yet" case every other sound in this file already
   *  tolerates) — missing a one-shot effect before the very first click
   *  has even resumed audio is inaudible regardless.
   *  The Desk phase added a second `kind` ("chairCreak"); the Workshop
   *  Interior phase a third ("doorCreak"). Sound & Presence phase — two
   *  more (`"buildingCreak"`, `"drawerSlide"`), a fifth
   *  (`"clockChime"`, event-triggered rather than player-triggered —
   *  "one-shot sound effect" never actually required a click, just a
   *  cause, and a hand crossing an hour mark is as real a cause as a
   *  button press), and an optional `options.position` (world-space
   *  `THREE.Vector3`) every caller *can* now supply for real distance
   *  falloff via `_computeDistanceGain()` above. */
  playInteractionSound(kind, options = {}) {
    if (!this.context) return;
    const gain = this.context.createGain();
    gain.gain.value = this._effectsMultiplier * this._computeDistanceGain(options.position);
    gain.connect(this.masterGain);
    if (kind === "paperShuffle") playPaperShuffle(this.context, gain, options);
    if (kind === "chairCreak") playChairCreak(this.context, gain, options);
    if (kind === "doorCreak") playDoorCreak(this.context, gain, options);
    if (kind === "buildingCreak") playBuildingCreak(this.context, gain, options);
    if (kind === "drawerSlide") playDrawerSlide(this.context, gain, options);
    if (kind === "clockChime") playClockChime(this.context, gain, options);
    if (kind === "residentThinking") playResidentThinking(this.context, gain, options);
  }

  /** A fresh random wait until the next building creak — see
   *  BUILDING_CREAK_MIN/MAX_INTERVAL's own comment for why this is wide
   *  and randomised rather than fixed. */
  _randomCreakInterval() {
    return BUILDING_CREAK_MIN_INTERVAL + Math.random() * (BUILDING_CREAK_MAX_INTERVAL - BUILDING_CREAK_MIN_INTERVAL);
  }

  /** Sound & Presence phase — "the Workshop should breathe... silence
   *  should exist naturally, sound should appear naturally." Indoors
   *  only (a building's own joints and beams settling isn't something
   *  you'd hear from out in the yard) — picks one of a few fixed,
   *  plausible spots, plays a soft creak there with a little pitch
   *  variety, and reschedules for another long, random wait. */
  _updateBuildingPresence(dt) {
    if (!this._indoor) return;
    this._buildingCreakTimer -= dt;
    if (this._buildingCreakTimer > 0) return;
    this._buildingCreakTimer = this._randomCreakInterval();
    const position = BUILDING_CREAK_POSITIONS[Math.floor(Math.random() * BUILDING_CREAK_POSITIONS.length)];
    this.playInteractionSound("buildingCreak", { position, pitch: 0.85 + Math.random() * 0.3 });
  }

  update(dt) {
    if (!this.context) return;

    this._locationCheckTimer -= dt;
    if (this._locationCheckTimer <= 0) {
      this._locationCheckTimer = LOCATION_CHECK_INTERVAL;
      this._checkLocation();
    }

    this._updateBuildingPresence(dt);

    this._windGustTimer -= dt;
    if (this._windGustTimer <= 0 && this.currentAmbience && (this.currentAmbience.id === "wind" || this.currentAmbience.id === "storm")) {
      this._windGustTimer = WIND_GUST_MODULATION_INTERVAL;
      const windSpeed = this._environmentSystem?.windSpeed ?? 0.2;
      const gustFrequency = this.currentAmbience.baseFrequency * (0.85 + windSpeed * 0.6);
      this.currentAmbience.filter.frequency.linearRampToValueAtTime(gustFrequency, this.context.currentTime + WIND_GUST_MODULATION_INTERVAL);
    }
  }
}
