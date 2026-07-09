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
      masterGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)) * 0.5, audioContext.currentTime + 0.2);
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
 * A self-scheduling nature ambience — intermittent bird chirps by day, a
 * steady cricket pulse by night, layered independently on top of whatever
 * weather ambience is also playing (see AudioSystem.js: this is a second,
 * always-potentially-active gain, not a replacement for the wind/rain/
 * storm noise bed). Owns its own `setTimeout` scheduling internally and
 * disposes each brief oscillator as it finishes; the caller only ever
 * starts it once, calls `setDayNight()`/`setIntensity()` as conditions
 * change, and `stop()`s it once, rather than managing individual chirps.
 */
export function createNatureAmbience(audioContext, destinationNode) {
  let isDay = true;
  let stopped = false;
  let pendingTimeout = null;
  const gain = audioContext.createGain();
  gain.gain.value = 0;
  gain.connect(destinationNode);

  function playBirdChirp() {
    const now = audioContext.currentTime;
    const startFreq = 1800 + Math.random() * 1400;
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

    if (Math.random() < 0.4) {
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

  function playCricketPulse() {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    osc.type = "square";
    osc.frequency.value = 4200 + Math.random() * 300;
    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 4300;
    filter.Q.value = 8;
    const pulseGain = audioContext.createGain();
    pulseGain.gain.setValueAtTime(0.0001, now);
    pulseGain.gain.linearRampToValueAtTime(0.22, now + 0.006);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(filter);
    filter.connect(pulseGain);
    pulseGain.connect(gain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function scheduleNext() {
    if (stopped) return;
    const delaySeconds = isDay ? 2.5 + Math.random() * 7 : 0.4 + Math.random() * 0.3;
    pendingTimeout = setTimeout(() => {
      if (stopped) return;
      if (isDay) playBirdChirp();
      else playCricketPulse();
      scheduleNext();
    }, delaySeconds * 1000);
  }
  scheduleNext();

  return {
    setDayNight(nextIsDay) {
      isDay = nextIsDay;
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
