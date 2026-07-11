import { LightingSystem } from "../systems/LightingSystem.js";
import { WorldEnvironmentSystem } from "../systems/WorldEnvironmentSystem.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { MusicSystem } from "../music/MusicSystem.js";

/**
 * SettingsSystem
 * ----------------
 * `SettingsStore` is just data (see src/settings/SettingsStore.js) —
 * this is the one place that knows what each field actually *means* and
 * applies it, the same "one orchestrator, several independent appliers"
 * shape `TimeOfDaySystem` already established (it computes state and
 * emits an event; LightingSystem/WorldEnvironmentSystem each apply their
 * own slice independently). Most of the "applying" methods already live
 * on the systems that own the thing being changed (LightingSystem's own
 * shadow/lighting-quality setters, WorldEnvironmentSystem's own
 * render-distance setter, InputManager's own sensitivity setters,
 * AudioSystem/MusicSystem's own volume-multiplier setters) — this
 * system's job is narrow: translate a settings change into calls to
 * those, plus the handful of things (camera FOV, UI scale, renderer-level
 * options) that don't have a more specific owner.
 *
 * See docs/PERFORMANCE.md for what every setting actually does.
 */
export class SettingsSystem {
  constructor({ settingsStore }) {
    this.settingsStore = settingsStore;
  }

  init(engine) {
    this.engine = engine;
    this._lightingSystem = engine.getSystem(LightingSystem);
    this._worldEnvironmentSystem = engine.getSystem(WorldEnvironmentSystem);
    this._audioSystem = engine.getSystem(AudioSystem);
    this._musicSystem = engine.getSystem(MusicSystem);

    this._applyAll(this.settingsStore.settings);
    this.settingsStore.events.on("settings:changed", (settings) => this._applyAll(settings));

    // "Please review performance across lower-powered devices. Rather
    // than reducing Workshop functionality, adapt graphical quality
    // where appropriate." The device-capability detection already
    // existed (`detectRecommendedPreset()`) but only ever ran when a
    // player found and clicked Settings' own "Optimise For This Device"
    // button — meaningless for the very first impression, on exactly the
    // device that needs it most. Applied automatically, but only once,
    // only on a genuinely fresh Workshop (`isFirstSession`, from
    // WorldTimeService) — an existing player's own deliberate choice is
    // never overwritten by a later session's own detection.
    engine.events.on("world:continuity", ({ isFirstSession }) => {
      if (!isFirstSession) return;
      this.settingsStore.applyPreset(this.settingsStore.detectRecommendedPreset());
    });
  }

  _applyAll(settings) {
    this._applyGraphics(settings.graphics);
    this._applyDisplay(settings.display);
    this._applyControls(settings.controls);
    this._applyAudio(settings.audio);
  }

  _applyGraphics(graphics) {
    this.engine.setAntialiasing(graphics.antialiasing);
    this.engine.setFrameRateLimit(graphics.frameRateLimit);
    this._worldEnvironmentSystem?.setRenderDistance(graphics.renderDistance);
    this._lightingSystem?.setShadowQuality(graphics.shadowQuality);
    this._lightingSystem?.setLightingQuality(graphics.lightingQuality);
    // A lower shadow tier also caps the internal render resolution a
    // little — the single highest-impact lever available on a high-DPI
    // tablet display, and not something worth its own separate slider in
    // the UI (see docs/PERFORMANCE.md).
    const pixelRatioCap = { off: 1.5, low: 1.5, medium: 1.75, high: 2 }[graphics.shadowQuality] ?? 2;
    this.engine.setPixelRatioCap(pixelRatioCap);
  }

  _applyDisplay(display) {
    this.engine.camera.fov = display.fov;
    this.engine.camera.updateProjectionMatrix();
    this._applyUiScale(display.uiScale);
  }

  _applyUiScale(scale) {
    // Applied directly to each UI root rather than a shared wrapper — the
    // workshop's various panels (HUD, overlays, the computer/workbench/
    // Build Mode panels, touch controls) are deliberately independent
    // siblings under <body>, not nested in one common container, so there
    // isn't a single element to scale instead. `zoom` reflows layout
    // (unlike `transform: scale`, which would need separate size
    // compensation to avoid clipping/overlap) — the trade-off is that a
    // handful of older/non-Chromium-family browsers don't support `zoom`;
    // on those, this setting simply has no effect rather than breaking
    // anything, since an unsupported CSS property is just ignored.
    for (const id of ["hud-root", "overlay-root", "computer-root", "workbench-root", "workshop-phone-root", "touch-controls"]) {
      const el = document.getElementById(id);
      if (el) el.style.zoom = String(scale);
    }
  }

  _applyControls(controls) {
    this.engine.input?.setMouseSensitivity(controls.mouseSensitivity);
    this.engine.input?.setTouchSensitivity(controls.touchSensitivity);
    this.engine.input?.setInvertLook(controls.invertLook);
  }

  _applyAudio(audio) {
    this._audioSystem?.setVolumeMultipliers({ master: audio.masterVolume, music: audio.musicVolume, ambient: audio.ambientVolume });
    this._musicSystem?.setSettingsMultiplier(audio.masterVolume * audio.musicVolume);
    // Effects volume is stored and ready for the moment a discrete
    // "effect" sound (as opposed to music or ambience) actually exists —
    // see docs/PERFORMANCE.md's known-limitations note.
  }
}
