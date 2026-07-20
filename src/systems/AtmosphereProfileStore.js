import { EventBus } from "../core/EventBus.js";
import { clamp } from "../utils/MathUtils.js";

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

  // ---- export/import (Version 3, Phase 7 — "Sharing the Workshop") ----

  /** Same small envelope shape `ResidentProfileStore.exportProfile()`/
   *  `BlueprintStore.exportBlueprint()` already use. `getProfile()`, not
   *  `get()` — a built-in preset is just as real and just as shareable as
   *  a player-saved one, the same "author defaults to You, a plugin can
   *  say otherwise" spirit `docs/ASSETS.md`'s own descriptor already
   *  holds for every other kind. */
  exportProfile(id) {
    const profile = this.getProfile(id);
    if (!profile) return null;
    return { type: "workshop-atmosphere-profile", version: 1, exportedAt: new Date().toISOString(), profile: { name: profile.name, description: profile.description, weather: profile.weather, time: profile.time } };
  }

  /** Never trusts the file — `weather.current` falls back to `"clear"`
   *  if it isn't even a non-empty string (this store deliberately never
   *  imports `EnvironmentSystem.WEATHER_STATES` to validate against it
   *  more precisely — see this file's own top comment on why it holds no
   *  reference to that system at all; an id this Workshop's own
   *  `EnvironmentSystem.setWeather()` doesn't recognise is already a safe
   *  no-op there, the same honest degradation an export from a future
   *  Workshop version with a weather state this one doesn't have yet
   *  would need anyway), each manual override is either a finite number
   *  or `null` (never `undefined`, which `setManualOverride()` doesn't
   *  expect), and `time.hour` clamps into a real 0-24 range. Always
   *  creates a genuinely new profile via `create()` — importing is
   *  additive, never overwrites anything by id. */
  importProfile(data) {
    if (!data || typeof data !== "object") throw new Error("That file doesn't look like a Workshop Atmosphere profile.");
    if (data.type && data.type !== "workshop-atmosphere-profile") {
      throw new Error(data.type === "workshop-backup" ? "That's a whole Workshop backup file, not an Atmosphere profile — import it from Settings instead." : "That file doesn't look like a Workshop Atmosphere profile.");
    }
    const source = data.profile ?? data;
    if (!source || typeof source !== "object" || !source.weather || !source.time) {
      throw new Error("That file doesn't look like a Workshop Atmosphere profile.");
    }
    const overrides = source.weather.manualOverrides ?? {};
    const normalizedOverride = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return this.create({
      name: source.name ? `${source.name} (imported)` : "Imported Atmosphere",
      description: typeof source.description === "string" ? source.description : "",
      weather: {
        current: typeof source.weather.current === "string" && source.weather.current ? source.weather.current : "clear",
        manualOverrides: {
          cloudCoverage: normalizedOverride(overrides.cloudCoverage),
          precipitation: normalizedOverride(overrides.precipitation),
          fogDensity: normalizedOverride(overrides.fogDensity),
          windSpeed: normalizedOverride(overrides.windSpeed),
        },
      },
      time: { hour: typeof source.time.hour === "number" && Number.isFinite(source.time.hour) ? clamp(source.time.hour, 0, 24) : 12 },
    });
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
