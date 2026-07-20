/**
 * AudioSynth
 * ----------
 * Generates simple ambient pads and noise beds entirely with the Web Audio
 * API — no audio files to source, license, or download. Each "track" here
 * (`TRACK_DEFS`, below) is a small, fixed set of generative ambient tunes
 * for the `audioSource` world-object behaviour to choose from — not a
 * placeholder for the real music library (see `src/music/`, docs/MUSIC.md),
 * which reads actual audio files from disk and has no relationship to this
 * file at all. `AudioSystem` only ever knows a track by its id/title
 * contract, not how the sound is produced, so adding a new generative
 * track here is a one-file change.
 *
 * Also generates the Workshop's outdoor ambience: `createNoiseSource` for
 * the weather layer (wind/rain/storm, filtered differently per state by
 * `AudioSystem`) and `createNatureAmbience` for the day/night layer
 * (birds, crickets) — see docs/WORLD.md's Environmental Audio section.
 */
import { clamp } from "./MathUtils.js";

const TRACK_DEFS = [
  { id: "warm-static", title: "Warm Static", chord: [130.81, 164.81, 196.0], filter: 900 },
  { id: "brass-hum", title: "Brass Hum", chord: [110.0, 146.83, 164.81], filter: 700 },
  { id: "quiet-pine", title: "Quiet Pine", chord: [146.83, 174.61, 220.0], filter: 1200 },
  { id: "late-shift", title: "Late Shift", chord: [98.0, 123.47, 146.83], filter: 600 },
];

export function getTrackList() {
  return TRACK_DEFS.map(({ id, title }) => ({ id, title }));
}

/**
 * Starts a generative ambient pad for the given track id. Returns a
 * controller with stop()/setVolume(). Caller owns the AudioContext.
 */
export function playAmbientTrack(audioContext, destinationNode, trackId) {
  const def = TRACK_DEFS.find((t) => t.id === trackId) ?? TRACK_DEFS[0];
  const now = audioContext.currentTime;

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.5, now + 1.5);
  masterGain.connect(destinationNode);

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = def.filter;
  filter.connect(masterGain);

  const oscillators = def.chord.map((freq, i) => {
    const osc = audioContext.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = freq;

    // slow LFO drift on detune so the pad feels alive rather than a static tone
    const lfo = audioContext.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.02;
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    lfo.start();

    const voiceGain = audioContext.createGain();
    voiceGain.gain.value = 1 / def.chord.length;

    osc.connect(voiceGain);
    voiceGain.connect(filter);
    osc.start();
    return { osc, lfo };
  });

  return {
    id: def.id,
    title: def.title,
    setVolume(v) {
      masterGain.gain.linearRampToValueAtTime(clamp(v, 0, 1) * 0.5, audioContext.currentTime + 0.2);
    },
    stop() {
      const t = audioContext.currentTime;
      masterGain.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => {
        oscillators.forEach(({ osc, lfo }) => { osc.stop(); lfo.stop(); });
        masterGain.disconnect();
      }, 900);
    },
  };
}

/** White-noise bed used for rain / wind — looped, filtered differently per weather state. */
export function createNoiseSource(audioContext) {
  const bufferSize = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/**
 * The Workbench phase's own "interaction sounds... audio should remain
 * understated and believable" — the first interaction sound effect
 * anywhere in the Workshop (every door, drawer, and switch before this
 * stayed silent; see `docs/WORKBENCH.md`'s own "Audio" section for why
 * this phase scoped itself to just the Workbench rather than
 * retrofitting all of them at once). A short burst of filtered noise —
 * the exact same `createNoiseSource()` above already uses for weather
 * ambience — through a narrow bandpass filter and a fast decay, rather
 * than a synthesised "paper" sample that doesn't exist. `pitch` (a
 * small multiplier around 1) lets two calls of the same function read
 * as subtly different moments (leaning in versus standing back up)
 * without needing a second, near-identical function.
 *
 * Sound & Presence phase — "inconsistent volume levels." This was the
 * very first interaction sound built, before there was any family to be
 * consistent *with* — its own peak gain (0.5) had never been revisited
 * against the ones that came later (chairCreak 0.32, doorCreak 0.28),
 * and was noticeably louder than all of them. Brought down to 0.3, in
 * line with the other two "direct object interaction" sounds of
 * comparable prominence.
 */
export function playPaperShuffle(audioContext, destinationNode, { pitch = 1 } = {}) {
  const source = createNoiseSource(audioContext);
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3200 * pitch;
  filter.Q.value = 0.6;
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destinationNode);
  source.start(now);
  source.stop(now + 0.25);
}

/**
 * The Desk phase's own interaction sound — a soft chair creak on sitting
 * down and standing back up, the second entry in `AudioSystem
 * .playInteractionSound()`'s own `kind` switch (see `playPaperShuffle()`
 * above for the first). Built the same way: `createNoiseSource()` through
 * a filter and a short gain envelope, not a recorded sample that doesn't
 * exist. What actually reads as "creak" rather than "shuffle" is the
 * filter itself — narrower (`Q` of 4 rather than 0.6, a resonant sweep
 * rather than a flat hiss) and *sliding* from a higher frequency down to
 * a lower one over the sound's own short life, the way a real creak's
 * pitch settles as whatever was flexing stops moving. `pitch` still lets
 * the same two calls (sitting, standing) read as distinct moments without
 * a second function, exactly like `playPaperShuffle()`'s own parameter.
 */
/**
 * Sound & Presence phase — "opportunities for better reuse." Four sounds
 * built across four separate phases — the chair creak, the door creak,
 * the building creak, and the drawer slide — turned out to be the exact
 * same four operations (noise, through a bandpass sweep, through a short
 * gain envelope) differing only in six numbers each. With three of them
 * a shared helper felt premature; with four, the duplication stopped
 * being debatable. Every one of those four public functions below is now
 * a single, readable call naming its own tuning, not a fourth copy of
 * the graph-building code to keep in sync by hand if this technique
 * itself ever needs a change (a different rolloff, say). `stopBuffer`
 * exists only so this refactor could preserve each original function's
 * exact stop time — a few hundredths of a second of silent padding after
 * the envelope's own decay, never audible either way — rather than
 * quietly changing something nobody asked to change.
 */
function playFilteredNoiseBurst(audioContext, destinationNode, {
  startFreq, endFreq, sweepDuration, q, peakGain, attackTime, decayDuration, stopBuffer, pitch = 1,
}) {
  const source = createNoiseSource(audioContext);
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  const now = audioContext.currentTime;
  filter.frequency.setValueAtTime(startFreq * pitch, now);
  filter.frequency.linearRampToValueAtTime(endFreq * pitch, now + sweepDuration);
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + attackTime);
  gain.gain.exponentialRampToValueAtTime(0.001, now + decayDuration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destinationNode);
  source.start(now);
  source.stop(now + decayDuration + stopBuffer);
}

/**
 * The Desk phase's own interaction sound — a soft chair creak on sitting
 * down and standing back up, the second entry in `AudioSystem
 * .playInteractionSound()`'s own `kind` switch (see `playPaperShuffle()`
 * above for the first). What actually reads as "creak" rather than
 * "shuffle" is the filter itself — narrower (`Q` of 4 rather than 0.6, a
 * resonant sweep rather than a flat hiss) and *sliding* from a higher
 * frequency down to a lower one over the sound's own short life, the way
 * a real creak's pitch settles as whatever was flexing stops moving.
 * `pitch` still lets the same two calls (sitting, standing) read as
 * distinct moments without a second function, exactly like
 * `playPaperShuffle()`'s own parameter. Built on `playFilteredNoiseBurst()`
 * — see that function's own comment.
 */
export function playChairCreak(audioContext, destinationNode, { pitch = 1 } = {}) {
  playFilteredNoiseBurst(audioContext, destinationNode, {
    startFreq: 520, endFreq: 300, sweepDuration: 0.28, q: 4,
    peakGain: 0.32, attackTime: 0.05, decayDuration: 0.32, stopBuffer: 0.02, pitch,
  });
}

/**
 * The Workshop Interior phase's own interaction sound — a soft creak on
 * opening and closing the front doors, lower and slower than the Desk
 * phase's chair creak — a door is a bigger, heavier object, and a real
 * hinge creak settles more slowly than a seat cushion does. Built on
 * `playFilteredNoiseBurst()` — see that function's own comment.
 */
export function playDoorCreak(audioContext, destinationNode, { pitch = 1 } = {}) {
  playFilteredNoiseBurst(audioContext, destinationNode, {
    startFreq: 340, endFreq: 220, sweepDuration: 0.4, q: 3,
    peakGain: 0.28, attackTime: 0.06, decayDuration: 0.45, stopBuffer: 0.03, pitch,
  });
}

/**
 * Sound & Presence phase — "building creaks... wooden furniture
 * settling... should remain subtle and infrequent." The lowest, slowest
 * of the Workshop's creak family — a bigger, more diffuse "the whole
 * structure, somewhere" sound rather than one specific object, so it's
 * tuned lower and slower again than even the door's own creak, and
 * quieter at its peak: this one is meant to occasionally register at the
 * edge of attention, not announce itself. Triggered by `AudioSystem`'s
 * own self-scheduling timer (see `_updateBuildingPresence()`), never by
 * a player action — the first creak-family member with no cause behind
 * it at all beyond the building itself. Built on
 * `playFilteredNoiseBurst()` — see that function's own comment.
 */
export function playBuildingCreak(audioContext, destinationNode, { pitch = 1 } = {}) {
  playFilteredNoiseBurst(audioContext, destinationNode, {
    startFreq: 200, endFreq: 130, sweepDuration: 0.65, q: 2.5,
    peakGain: 0.18, attackTime: 0.1, decayDuration: 0.75, stopBuffer: 0.05, pitch,
  });
}

/**
 * Sound & Presence phase — "storage... drawers." Shorter and
 * higher-pitched than the creak family — a drawer runner's own friction
 * reads as a grainier, more metallic scrape than a wooden joint settling,
 * so a narrower, higher-frequency bandpass rather than a lower, broader
 * one. Played once, on interaction, through `FurnitureSystem`'s own
 * generic `soundOnInteract` field (see that file's own comment) — no
 * furniture definition file calls this, or any sound function, directly.
 * Built on `playFilteredNoiseBurst()` — see that function's own comment.
 */
export function playDrawerSlide(audioContext, destinationNode, { pitch = 1 } = {}) {
  playFilteredNoiseBurst(audioContext, destinationNode, {
    startFreq: 900, endFreq: 650, sweepDuration: 0.22, q: 5,
    peakGain: 0.22, attackTime: 0.03, decayDuration: 0.26, stopBuffer: 0.02, pitch,
  });
}

/**
 * Sound & Presence phase — "clock sounds." The Workshop's first *tonal*
 * one-shot — every other interaction sound is filtered noise, honest for
 * a scrape, a creak, a hinge, but wrong for a clock, which actually rings
 * a pitch. Two sine oscillators a major third apart (a soft, consonant
 * two-note chime, not a full bell peal) through one shared envelope,
 * rather than a single tone, for a little more warmth than one sine wave
 * alone would have. Triggered once per simulated hour the wall clock's
 * own hands cross (see `LightingSystem._updateClockHands()`), not once a
 * second — "avoid continuous looping audio where occasional, contextual
 * sounds would feel more believable" ruled out a literal tick-tock
 * entirely; a chime on the hour is the same instinct real longcase
 * clocks already apply, marking a moment rather than narrating every
 * second.
 */
export function playClockChime(audioContext, destinationNode) {
  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  gain.connect(destinationNode);
  for (const [freq, level] of [[523.25, 1], [659.25, 0.55]]) {
    const osc = audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const oscGain = audioContext.createGain();
    oscGain.gain.value = level;
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start(now);
    osc.stop(now + 1.4);
  }
}

/**
 * Sound & Presence phase — "Residents... Thinking... should communicate
 * life without becoming distracting." Bubble had no audio at all before
 * this phase. A single soft triangle-wave tone with a quick upward pitch
 * bend, under 200 milliseconds and quiet even at its peak — deliberately
 * the smallest, gentlest sound in the Workshop's entire library, since
 * it fires on its own (see `ResidentController._maybeAnnounceThinking()`),
 * with no click or door behind it to already have primed a listener's
 * attention. Distinct in character from `playClockChime()` (two
 * sustained sine tones, a resonant interval) — this is a single quick
 * flicker, reading as "a thought, passing" rather than "a bell, rung."
 */
export function playResidentThinking(audioContext, destinationNode) {
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(destinationNode);
  osc.start(now);
  osc.stop(now + 0.2);
}

/**
 * A self-scheduling nature ambience — four phases across the day, not
 * just day/night: a brighter, denser dawn chorus; the original, sparser
 * daytime bird chirp; a warmer dusk mix of evening insects and lower,
 * slower bird calls; and the original steady night cricket trill —
 * layered independently on top of whatever weather ambience is also
 * playing (see AudioSystem.js: this is a second, always-potentially-
 * active gain, not a replacement for the wind/rain/storm noise bed).
 * "Morning birds. Evening birds. Crickets. Insects... avoid excessive
 * repetition" — four distinct characters sharing two parameterised
 * synthesis functions (a chirp, a trill) rather than four independent
 * ones, so no two phases can drift out of the same underlying "texture,
 * not tone" design the original day/night pair already established.
 * Owns its own `setTimeout` scheduling internally and disposes each
 * brief oscillator as it finishes; the caller only ever starts it once,
 * calls `setHour()`/`setIntensity()` as conditions change, and `stop()`s
 * it once, rather than managing individual chirps.
 */
export function createNatureAmbience(audioContext, destinationNode) {
  let phase = "day";
  let stopped = false;
  let pendingTimeout = null;
  const gain = audioContext.createGain();
  gain.gain.value = 0;
  gain.connect(destinationNode);

  /** A single bird call, `brightness` shifting how high and how likely
   *  it is to carry a genuine two-note follow-up (a real call is rarely
   *  one perfectly isolated note) — the original daytime chirp is just
   *  this at brightness 1; dawn brightens it further, dusk dims it. */
  function playBirdChirp(brightness = 1) {
    const now = audioContext.currentTime;
    const startFreq = (1800 + Math.random() * 1400) * brightness;
    const osc = audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * (0.7 + Math.random() * 0.5), now + 0.12);
    const chirpGain = audioContext.createGain();
    chirpGain.gain.setValueAtTime(0.0001, now);
    chirpGain.gain.linearRampToValueAtTime(0.5, now + 0.015);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(chirpGain);
    chirpGain.connect(gain);
    osc.start(now);
    osc.stop(now + 0.2);

    const secondNoteChance = brightness >= 1 ? 0.4 : 0.25;
    if (Math.random() < secondNoteChance) {
      // A real bird call is rarely a single, perfectly isolated note.
      const osc2 = audioContext.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(startFreq * 1.15, now + 0.2);
      const gain2 = audioContext.createGain();
      gain2.gain.setValueAtTime(0.0001, now + 0.2);
      gain2.gain.linearRampToValueAtTime(0.4, now + 0.21);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(gain);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.36);
    }
  }

  /** A short trill of a few rapid sub-pulses, not one isolated tone —
   *  see this file's own top-level note on the "intermittent beeping"
   *  this replaced. A single square-wave pulse through a narrow bandpass
   *  filter, repeated at a steady clip, is essentially the same
   *  synthesis as an electronic chirp alarm; a softer waveform through a
   *  wider filter reads as insect texture rather than a pure,
   *  "electronic" tone. `baseFreq`/`pulseCount` distinguish the original
   *  night cricket (higher, tighter) from a warmer dusk insect hum
   *  (lower, looser) using this exact same shape. */
  function playInsectPulse({ baseFreq, pulseCountRange, gainPeak }) {
    const now = audioContext.currentTime;
    const freq = baseFreq + (Math.random() - 0.5) * (baseFreq * 0.1);
    const pulseCount = pulseCountRange[0] + Math.floor(Math.random() * (pulseCountRange[1] - pulseCountRange[0] + 1));
    const pulseSpacing = 0.026; // fast enough to blur into one trill, not read as separate beeps

    for (let i = 0; i < pulseCount; i++) {
      const pulseStart = now + i * pulseSpacing;
      const osc = audioContext.createOscillator();
      osc.type = "triangle"; // softer than a square wave — less "electronic beep," more insect buzz
      osc.frequency.value = freq + (Math.random() - 0.5) * (freq * 0.04);
      const filter = audioContext.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = 4; // wider than a single pure tone — texture, not a whistle
      const pulseGain = audioContext.createGain();
      pulseGain.gain.setValueAtTime(0.0001, pulseStart);
      pulseGain.gain.linearRampToValueAtTime(gainPeak, pulseStart + 0.004);
      pulseGain.gain.exponentialRampToValueAtTime(0.001, pulseStart + 0.03);
      osc.connect(filter);
      filter.connect(pulseGain);
      pulseGain.connect(gain);
      osc.start(pulseStart);
      osc.stop(pulseStart + 0.035);
    }
  }

  const NIGHT_CRICKET = { baseFreq: 4200, pulseCountRange: [3, 5], gainPeak: 0.16 };
  // Warmer and looser than the night cricket — a lower pitch and fewer
  // pulses per trill reads as a different, calmer insect (cicada/katydid
  // territory) rather than the same crickets just quieter.
  const DUSK_INSECT = { baseFreq: 2400, pulseCountRange: [2, 4], gainPeak: 0.13 };

  function playForPhase() {
    if (phase === "dawn") playBirdChirp(1.25);
    else if (phase === "day") playBirdChirp(1);
    else if (phase === "dusk") {
      if (Math.random() < 0.35) playBirdChirp(0.75);
      else playInsectPulse(DUSK_INSECT);
    } else playInsectPulse(NIGHT_CRICKET);
  }

  function delayForPhase() {
    if (phase === "dawn") return 1.2 + Math.random() * 2.8; // denser than ordinary daytime — the dawn chorus
    if (phase === "day") return 2.5 + Math.random() * 7;
    if (phase === "dusk") return 1 + Math.random() * 2.5;
    return 0.4 + Math.random() * 0.3; // night — unchanged from before this phase
  }

  function scheduleNext() {
    if (stopped) return;
    pendingTimeout = setTimeout(() => {
      if (stopped) return;
      playForPhase();
      scheduleNext();
    }, delayForPhase() * 1000);
  }
  scheduleNext();

  return {
    /** `hour` is the Workshop's own 0-24 clock (TimeOfDaySystem.currentTime)
     *  — bucketed here into dawn/day/dusk/night, the one place that
     *  judgement is made, rather than the caller pre-computing a phase. */
    setHour(hour) {
      if (hour >= 4.5 && hour < 8) phase = "dawn";
      else if (hour >= 8 && hour < 17) phase = "day";
      else if (hour >= 17 && hour < 20.5) phase = "dusk";
      else phase = "night";
    },
    /** 0-1 overall level for this layer — AudioSystem fades it in/out with weather (birds/crickets quiet down in heavy rain or storm) and the Settings ambient volume. */
    setIntensity(level) {
      gain.gain.linearRampToValueAtTime(Math.max(0, level), audioContext.currentTime + 1.5);
    },
    stop() {
      stopped = true;
      if (pendingTimeout) clearTimeout(pendingTimeout);
      gain.disconnect();
    },
  };
}
