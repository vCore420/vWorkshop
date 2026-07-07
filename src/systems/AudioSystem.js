import { playAmbientTrack, createNoiseSource, getTrackList } from "../utils/AudioSynth.js";

/**
 * AudioSystem
 * -----------
 * Two independent audio layers, mixed together:
 *   - Music: whatever the stereo is playing (or nothing). Controlled by the
 *     stereo overlay, one track at a time.
 *   - Ambience: a quiet noise bed tied to the current weather (rain, wind).
 *     Controlled entirely by WeatherSystem's events — no direct coupling.
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
    this.masterGain = null;
    this.currentTrack = null;
    this.currentAmbience = null;
    this.volume = 0.6;
    this.isPlaying = false;
    this._pendingTrackId = null;
    this._lastAmbienceId = null;
  }

  init(engine) {
    this.engine = engine;
    engine.events.on("weather:changed", ({ ambience }) => {
      this._lastAmbienceId = ambience;
      this._setAmbience(ambience);
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
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.context.destination);

    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.ambienceGain = this.context.createGain();
    this.ambienceGain.gain.value = 0.25;
    this.ambienceGain.connect(this.masterGain);

    if (this._pendingTrackId) {
      this.playTrack(this._pendingTrackId);
      this._pendingTrackId = null;
    }
    this._setAmbience(this._lastAmbienceId);
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
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.linearRampToValueAtTime(this.volume, this.context.currentTime + 0.1);
  }

  _setAmbience(ambienceId) {
    if (!this.context) return; // resumeContext() re-applies _lastAmbienceId once a context exists
    if (this.currentAmbience?.id === ambienceId) return;
    this._stopAmbience();
    if (!ambienceId) return;

    const source = createNoiseSource(this.context);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = ambienceId === "rain" ? 1800 : 500;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceGain);
    source.start();
    gain.gain.linearRampToValueAtTime(ambienceId === "rain" ? 0.9 : 0.5, this.context.currentTime + 1.5);
    this.currentAmbience = { id: ambienceId, source, gain };
  }

  _stopAmbience() {
    if (!this.currentAmbience) return;
    const { source, gain } = this.currentAmbience;
    const t = this.context.currentTime;
    gain.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => source.stop(), 1100);
    this.currentAmbience = null;
  }

  update(_dt) {}
}
