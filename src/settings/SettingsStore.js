import { EventBus } from "../core/EventBus.js";

/**
 * SettingsStore
 * ---------------
 * Plain data + presets, exactly like `ProjectsStore` — no engine/scene
 * concerns here at all. `SettingsSystem` (see SettingsSystem.js) is what
 * actually *applies* this data to the renderer/camera/audio graph; every
 * other interested system (LightingSystem, CameraSystem, InputManager,
 * AudioSystem, MusicSystem) listens for this store's `settings:changed`
 * event and applies its own relevant slice independently — the same
 * decoupled, event-driven shape as `timeofday:changed` or
 * `environment:changed` already use elsewhere in the workshop, not a new
 * pattern invented for this.
 *
 * See docs/PERFORMANCE.md for what each graphics/performance field
 * actually does and why.
 */

export const DEFAULT_SETTINGS = {
  graphics: {
    renderDistance: 100, // metres — drives camera.far and the outdoor fog distance together
    shadowQuality: "medium", // "off" | "low" | "medium" | "high"
    lightingQuality: "medium", // "low" | "medium" | "high" — shadow map resolution on practical lights
    antialiasing: true,
    frameRateLimit: 0, // 0 = uncapped (follows the display's own refresh rate)
  },
  performance: {
    preset: "balanced", // "performance" | "balanced" | "quality" | "custom"
  },
  display: {
    fov: 62,
    uiScale: 1,
    // Version 3, Phase 13 ("The Phone Becomes a Device") — one setting,
    // read by both the PC Settings app and the Phone's own, and by
    // PhoneSystem's status-bar clock; see TimeFormat.js's own comment.
    timeFormat: "24h", // "24h" | "12h"
  },
  controls: {
    mouseSensitivity: 1,
    touchSensitivity: 1,
    // "Invert the default vertical camera controls." The setting already
    // existed (Settings' own Controls tab) but had never actually been
    // wired to CameraSystem.js at all — see that file's own comment.
    // Flipping the default here, now that it's genuinely connected, is
    // what actually changes the Workshop's own default feel; a player
    // who prefers the non-inverted convention can still switch it back.
    invertLook: true,
  },
  audio: {
    masterVolume: 1,
    musicVolume: 1,
    effectsVolume: 1,
    ambientVolume: 1,
  },
  // Version 3, Phase 13 ("The Phone Becomes a Device") — "a phone a
  // player has actually customised is a small, concrete way ownership
  // shows up." A handful of curated presets (see `css/phone.css`'s own
  // `[data-wallpaper]`/`[data-border]` rules), not a colour picker — every
  // preset reuses an existing design token, deliberately not "a theming
  // engine for its own sake" the phase brief itself warns against.
  phone: {
    wallpaper: "paper", // "paper" | "sage" | "glow" | "wood"
    borderColor: "oak", // "oak" | "walnut" | "brass" | "teal"
  },
};

/**
 * A preset is a *partial* graphics object — only the fields it actually
 * takes a position on. Applying one leaves performance/display/controls/
 * audio completely untouched, since "Performance" vs "Quality" is
 * specifically about rendering cost, not how sensitive your mouse is.
 */
export const PERFORMANCE_PRESETS = {
  performance: {
    renderDistance: 55,
    shadowQuality: "off",
    lightingQuality: "low",
    antialiasing: false,
    frameRateLimit: 30,
  },
  balanced: {
    renderDistance: 100,
    shadowQuality: "medium",
    lightingQuality: "medium",
    antialiasing: true,
    frameRateLimit: 0,
  },
  quality: {
    renderDistance: 160,
    shadowQuality: "high",
    lightingQuality: "high",
    antialiasing: true,
    frameRateLimit: 0,
  },
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(base[key] ?? {}, value) : value;
  }
  return result;
}

export class SettingsStore {
  constructor() {
    this.events = new EventBus();
    this.settings = deepClone(DEFAULT_SETTINGS);
  }

  get(category) {
    return this.settings[category];
  }

  /** Shallow-patches one category, e.g. `update("audio", { masterVolume: 0.5 })`. */
  update(category, patch) {
    this.settings[category] = { ...this.settings[category], ...patch };
    if (category === "graphics") this.settings.performance.preset = "custom";
    this._emitChanged();
  }

  applyPreset(presetName) {
    const preset = PERFORMANCE_PRESETS[presetName];
    if (!preset) return;
    this.settings.graphics = { ...this.settings.graphics, ...preset };
    this.settings.performance.preset = presetName;
    this._emitChanged();
  }

  /**
   * A simple, honestly-labelled heuristic, not a real benchmark: touch-
   * primary devices and low core counts point at "performance"; generous
   * core counts point at "quality"; everything else stays "balanced". See
   * docs/PERFORMANCE.md for why a real benchmark wasn't worth building for
   * this pass.
   */
  detectRecommendedPreset() {
    const cores = navigator.hardwareConcurrency ?? 4;
    const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (isTouchPrimary || cores <= 4) return "performance";
    if (cores >= 8) return "quality";
    return "balanced";
  }

  resetToDefaults() {
    this.settings = deepClone(DEFAULT_SETTINGS);
    this._emitChanged();
  }

  _emitChanged() {
    this.events.emit("settings:changed", this.settings);
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return this.settings;
  }

  load(data) {
    if (!data) return;
    this.settings = deepMerge(deepClone(DEFAULT_SETTINGS), data);
    this.events.emit("settings:changed", this.settings);
  }
}
