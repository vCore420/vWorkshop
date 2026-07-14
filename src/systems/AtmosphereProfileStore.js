import { EventBus } from "../core/EventBus.js";

let _nextId = 1;

/**
 * AtmosphereProfileStore
 * -------------------------
 * "Support creating and saving atmosphere profiles... Sunny Morning,
 * Golden Evening, Storm, Fog, Winter Morning, Summer Afternoon." A
 * profile is a small, plain snapshot of everything the Atmosphere tab
 * already lets someone set by hand — weather mode/state, the four
 * manual overrides, and the clock — captured together under one name so
 * it can be re-applied in one click instead of several. Follows the
 * exact same "permanent hand-authored set, live in code, never inside
 * the mutable store array" shape `AnimationLibraryStore.js` already
 * established for its own default clips (see that file's own comment) —
 * a Workshop with no player-saved profiles at all still always has six
 * real ones to start from.
 *
 * This store holds *data only* — `{ id, name, description, weather,
 * time }` — never a reference to `EnvironmentSystem`/`TimeOfDaySystem`
 * themselves, matching every other plain store's own "no scene/camera
 * concerns" boundary (see docs/ARCHITECTURE.md's Persistence section).
 * Capturing the *current* live state into a new profile, and applying a
 * saved one back onto the real systems, are both the Atmosphere tab's
 * own job (`SettingsApp.js`) — the same split `BuildModeSystem.js`
 * already draws with `BlueprintStore.js` (the store holds the shape, the
 * system with direct access to what's live does the reading/writing).
 *
 * `weather.manualOverrides` mirrors `EnvironmentSystem.manualOverrides`
 * exactly (`null` means "use the weather preset's own value") and
 * `time.mode`/`time.hour` mirror `TimeOfDaySystem`'s own — applying a
 * profile is just handing these straight to each system's already-real
 * `setMode()`/`setWeather()`/`setManualOverride()`/`setTime()` methods,
 * nothing new to interpret.
 */
export const BUILTIN_ATMOSPHERE_PROFILES = [
  {
    id: "builtin-sunny-morning",
    name: "Sunny Morning",
    description: "A clear, bright morning — soft golden light, calm air.",
    weather: { current: "clear", manualOverrides: { cloudCoverage: null, precipitation: null, fogDensity: null, windSpeed: 0.15 } },
    time: { hour: 7.5 },
  },
  {
    id: "builtin-golden-evening",
    name: "Golden Evening",
    description: "Clear skies at the warmest part of the evening light.",
    weather: { current: "clear", manualOverrides: { cloudCoverage: null, precipitation: null, fogDensity: null, windSpeed: null } },
    time: { hour: 18.5 },
  },
  {
    id: "builtin-storm",
    name: "Storm",
    description: "Heavy rain, strong wind, a dramatic afternoon sky.",
    weather: { current: "storm", manualOverrides: { cloudCoverage: null, precipitation: null, fogDensity: null, windSpeed: null } },
    time: { hour: 15 },
  },
  {
    id: "builtin-fog",
    name: "Fog",
    description: "A thick, quiet fog rolling through an early morning.",
    weather: { current: "fog", manualOverrides: { cloudCoverage: null, precipitation: null, fogDensity: null, windSpeed: 0.05 } },
    time: { hour: 7 },
  },
  {
    id: "builtin-winter-morning",
    name: "Winter Morning",
    description: "A cold, overcast morning with a low, hazy sky.",
    weather: { current: "overcast", manualOverrides: { cloudCoverage: null, precipitation: null, fogDensity: 0.25, windSpeed: 0.3 } },
    time: { hour: 8 },
  },
  {
    id: "builtin-summer-afternoon",
    name: "Summer Afternoon",
    description: "A warm, clear, unhurried midday — barely a breeze.",
    weather: { current: "clear", manualOverrides: { cloudCoverage: 0.1, precipitation: null, fogDensity: null, windSpeed: 0.1 } },
    time: { hour: 13.5 },
  },
];

export class AtmosphereProfileStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} user-saved profiles only — never the built-ins above */
    this.profiles = [];
  }

  /** `weather`/`time` are already in the exact shape described in this
   *  file's own top comment — SettingsApp.js's own "Save current as
   *  profile" action builds them directly from the live systems. */
  create({ name, description = "", weather, time }) {
    const profile = {
      id: `profile-${_nextId++}`,
      name: name?.trim() || "Untitled Atmosphere",
      description,
      weather,
      time,
      createdAt: new Date().toISOString(),
    };
    this.profiles.push(profile);
    this._emitChanged();
    return profile;
  }

  /** Only ever removes a user profile — a built-in's id is simply not found here. */
  remove(id) {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    this._emitChanged();
  }

  /** User profiles only — use `getProfile()` to resolve either kind. */
  get(id) {
    return this.profiles.find((p) => p.id === id) ?? null;
  }

  /** Resolves a profile id against user profiles first, then the
   *  permanent built-in set — the one function anything that just wants
   *  "the profile for this id, whatever kind it is" should call. */
  getProfile(id) {
    return this.get(id) ?? BUILTIN_ATMOSPHERE_PROFILES.find((p) => p.id === id) ?? null;
  }

  isBuiltIn(id) {
    return BUILTIN_ATMOSPHERE_PROFILES.some((p) => p.id === id);
  }

  /** Built-ins first, then user profiles — for the Atmosphere tab's own listing. */
  all() {
    return [...BUILTIN_ATMOSPHERE_PROFILES, ...this.profiles];
  }

  _emitChanged() {
    this.events.emit("profiles:changed", this.all());
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  // Only ever the user's own profiles — the built-ins are code, not
  // data, and regenerate identically from this file on every load.
  save() {
    return { profiles: this.profiles };
  }

  load(data) {
    if (!data?.profiles) return;
    this.profiles = data.profiles;
    const maxId = this.profiles.reduce((m, p) => {
      const match = /^profile-(\d+)$/.exec(p.id ?? "");
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    _nextId = maxId + 1;
    this.events.emit("profiles:changed", this.all());
  }
}
