/**
 * AudioSynth
 * ----------
 * Generates simple ambient pads and noise beds entirely with the Web Audio
 * API — no audio files to source, license, or download. Each "track" here
 * is a placeholder for a real recorded piece of music later: AudioSystem
 * and the stereo overlay only know about a track's id/title/duration
 * contract (see /src/data/tracks.js), not how the sound is produced, so
 * dropping in real .mp3/.ogg files later is a one-file change.
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
