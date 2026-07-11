import * as THREE from "three";
import { rainStreakTexture } from "../utils/ProceduralTexture.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";
import { fetchLiveWeather } from "../utils/WeatherProvider.js";

/**
 * EnvironmentSystem
 * -------------------
 * "Think beyond simply adding weather effects" — this is the successor to
 * the original WeatherSystem, grown from "pick one of three weather
 * states" into the one place that owns weather, wind, and the modes that
 * decide where weather actually comes from. It doesn't render the sky,
 * light the room, or make any sound itself — `WorldEnvironmentSystem`
 * (sky/clouds/sun/moon/stars/fog), `LightingSystem` (indoor light,
 * including a storm's lightning flicker), and `AudioSystem` (wind/rain/
 * birds/crickets) all listen to the one event this system emits,
 * `environment:changed`, exactly the same "compute state, emit an event,
 * let every consumer react independently" split `TimeOfDaySystem` already
 * established. Nothing about a future building or Builder-placed
 * structure needs to know this system exists at all — it lights and
 * fogs the *scene*, not any one building in it, which is what makes
 * "Builder compatibility... without requiring special cases" true for
 * free.
 *
 * **Three modes** (see `setMode`):
 *   - **Manual** — the player picks a weather state directly; it stays
 *     exactly that until changed again. For building, screenshots, or
 *     personal preference, as the brief puts it.
 *   - **Live Weather** — real conditions from Open-Meteo (see
 *     `WeatherProvider.js`), using the browser's own geolocation. Refetched
 *     periodically while active. Any failure — permission denied,
 *     offline, geolocation unsupported, a bad response — falls back to
 *     Workshop Dynamic automatically; `getState().liveError` carries a
 *     human-readable reason for the Environment panel to show.
 *   - **Workshop Dynamic** (the default) — a real, if simple, Markov
 *     process: `TRANSITIONS` gives every state a weighted set of states
 *     it can naturally lead to next (clear rarely jumps straight to
 *     storm; storm always decays back toward heavy rain), each held for
 *     a randomised real-world duration before advancing. On load, elapsed
 *     real time since the state was last entered is replayed forward
 *     (bounded — see `_catchUpDynamic`) rather than the weather either
 *     freezing or resetting, which is what makes "conditions persist
 *     between visits" genuinely true instead of just a saved label.
 *
 * Rain is still represented the same honest way it always has been for a
 * room with placeholder-style windows rather than a fully simulated
 * exterior view (see WorkshopRoom.js): streaks scrolling across the glass
 * — now skewed by wind direction, since "rain direction" was asked for
 * specifically — plus the light/fog/ambience effects every consumer
 * reacts to independently.
 */
export const WEATHER_STATES = {
  clear: { label: "Clear", lightDampening: 0, fogDensity: 0, cloudCoverage: 0.05, precipitation: 0, ambience: null },
  partlyCloudy: { label: "Partly Cloudy", lightDampening: 0.12, fogDensity: 0, cloudCoverage: 0.35, precipitation: 0, ambience: null },
  overcast: { label: "Overcast", lightDampening: 0.32, fogDensity: 0.08, cloudCoverage: 0.85, precipitation: 0, ambience: "wind" },
  drizzle: { label: "Drizzle", lightDampening: 0.4, fogDensity: 0.15, cloudCoverage: 0.7, precipitation: 0.2, ambience: "rain" },
  lightRain: { label: "Light Rain", lightDampening: 0.45, fogDensity: 0.1, cloudCoverage: 0.75, precipitation: 0.45, ambience: "rain" },
  heavyRain: { label: "Heavy Rain", lightDampening: 0.6, fogDensity: 0.15, cloudCoverage: 0.9, precipitation: 0.85, ambience: "rain" },
  fog: { label: "Fog", lightDampening: 0.35, fogDensity: 0.65, cloudCoverage: 0.5, precipitation: 0, ambience: null },
  mist: { label: "Mist", lightDampening: 0.2, fogDensity: 0.35, cloudCoverage: 0.3, precipitation: 0, ambience: null },
  windy: { label: "Windy", lightDampening: 0.1, fogDensity: 0, cloudCoverage: 0.4, precipitation: 0, ambience: "wind" },
  storm: { label: "Storm", lightDampening: 0.65, fogDensity: 0.12, cloudCoverage: 0.95, precipitation: 0.9, ambience: "storm" },
};

// How strongly each state's own conditions push the wind base level
// (0-1) — independent of `lightDampening`/etc, since a foggy day is
// usually still, but an overcast one often isn't.
const WIND_BASE = {
  clear: 0.12, partlyCloudy: 0.18, overcast: 0.25, drizzle: 0.2, lightRain: 0.25,
  heavyRain: 0.4, fog: 0.05, mist: 0.08, windy: 0.8, storm: 0.95,
};

// Every state's naturally-reachable next states and their relative
// likelihood — "sensible transitions", not a uniform random pick. Storm
// is deliberately absent as a destination from anything except heavy
// rain, and always decays straight back toward it — genuinely rare and
// short-lived, the way the brief asked for.
const TRANSITIONS = {
  clear: { clear: 3, partlyCloudy: 2, windy: 0.5, mist: 0.3 },
  partlyCloudy: { partlyCloudy: 3, clear: 1.6, overcast: 1.2, windy: 0.4 },
  overcast: { overcast: 3, partlyCloudy: 1.3, drizzle: 0.9, lightRain: 0.5, fog: 0.3, windy: 0.3 },
  drizzle: { drizzle: 2, overcast: 1.6, lightRain: 0.9 },
  lightRain: { lightRain: 2, drizzle: 0.9, overcast: 1, heavyRain: 0.5 },
  heavyRain: { heavyRain: 1.6, lightRain: 1.6, storm: 0.2 },
  storm: { storm: 0.3, heavyRain: 2.2 },
  fog: { fog: 2, mist: 1.3, overcast: 0.8, clear: 0.4 },
  mist: { mist: 2, fog: 0.8, clear: 1.1, partlyCloudy: 0.8 },
  windy: { windy: 1.4, clear: 1.2, partlyCloudy: 1.2, overcast: 0.5 },
};

const MIN_DURATION_MIN = 40;
const MAX_DURATION_MIN = 150;
const STORM_MIN_DURATION_MIN = 8;
const STORM_MAX_DURATION_MIN = 18;
const MAX_CATCHUP_STEPS = 6; // bounds how far a long-absent save fast-forwards, rather than simulating months of ticks
const LIVE_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

function pickDurationMs(state) {
  const [min, max] = state === "storm" ? [STORM_MIN_DURATION_MIN, STORM_MAX_DURATION_MIN] : [MIN_DURATION_MIN, MAX_DURATION_MIN];
  return (min + Math.random() * (max - min)) * 60 * 1000;
}

export class EnvironmentSystem {
  constructor() {
    this.mode = "dynamic"; // "manual" | "live" | "dynamic"
    this.current = "clear";
    this.manualState = "clear"; // remembered independently, so switching back to Manual restores your last choice rather than defaulting
    this.windSpeed = WIND_BASE.clear; // 0-1, smoothed toward the current state's WIND_BASE with gentle gusts
    this.windDirectionRad = 0;
    this.temperatureC = null; // only ever set by live weather — see requestLiveWeather(); Settings' own Atmosphere tab shows "not available" while this is null
    this.liveStatus = "idle"; // "idle" | "loading" | "ok" | "error"
    this.liveError = null;
    // "Every environmental property currently displayed should also
    // support manual override... Clouds, Rain, Wind, Fog." Independent
    // per-property overrides, layered on top of whichever weather state
    // preset is currently active (see _emit()'s own use of these) —
    // rather than only being able to pick a whole preset and accept
    // whatever combination it bundles together, each of these four can
    // be pulled away from the preset's own value individually. `null`
    // means "use the preset's own value," matching the same
    // null-means-unset convention `temperatureC` already uses above.
    this.manualOverrides = { cloudCoverage: null, precipitation: null, fogDensity: null, windSpeed: null };

    this._enteredAt = Date.now();
    this._durationMs = pickDurationMs("clear");
    this._liveLastFetch = 0;
    this._windTarget = WIND_BASE.clear;
    this._windGustPhase = Math.random() * 1000;
    this._rainMeshes = [];
    this._rainScroll = 0;
  }

  /** `key` is one of `manualOverrides`' own keys; `value` a 0-1 number,
   *  or `null` to go back to following the current weather state's own
   *  preset value for that property. */
  setManualOverride(key, value) {
    if (!(key in this.manualOverrides)) return;
    this.manualOverrides[key] = value;
    if (key === "windSpeed" && value !== null) {
      this.windSpeed = value;
      this._windTarget = value;
    }
    this._emit();
    this.engine?.events.emit("persistence:saveRequested");
  }

  init(engine) {
    this.engine = engine;
    this.windDirectionRad = Math.random() * Math.PI * 2;
    this._buildRainOverlays();
    this._emit(); // unconditionally — a fresh workshop with no save yet never gets a persistence:load event at all, so every listener still needs an initial, correctly-defaulted emit from here

    engine.events.on("persistence:save", (bag) => {
      bag.environment = {
        mode: this.mode,
        current: this.current,
        manualState: this.manualState,
        enteredAt: this._enteredAt,
        windDirectionRad: this.windDirectionRad,
      };
    });
    engine.events.on("persistence:load", (bag) => {
      if (!bag?.environment) {
        this._emit();
        return;
      }
      const saved = bag.environment;
      this.mode = saved.mode ?? this.mode;
      this.current = saved.current ?? this.current;
      this.manualState = saved.manualState ?? saved.current ?? this.manualState;
      this.windDirectionRad = saved.windDirectionRad ?? this.windDirectionRad;
      this._enteredAt = saved.enteredAt ?? Date.now();
      this._durationMs = pickDurationMs(this.current);
      if (this.mode === "dynamic") this._catchUpDynamic();
      if (this.mode === "live") this.requestLiveWeather();
      this._windTarget = WIND_BASE[this.current] ?? 0.2;
      this._emit();
    });
  }

  _buildRainOverlays() {
    const roomSystem = this.engine.getSystem(RoomLayoutSystem);
    const panes = roomSystem?.getWindowPanes?.() ?? [];
    const streakTexture = rainStreakTexture();
    for (const { mesh } of panes) {
      const overlayMat = new THREE.MeshBasicMaterial({
        map: streakTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const overlay = new THREE.Mesh(mesh.geometry.clone(), overlayMat);
      overlay.position.copy(mesh.position);
      overlay.position.z += mesh.position.z > 0 ? 0.01 : -0.01;
      this.engine.scene.add(overlay);
      this._rainMeshes.push(overlay);
    }
  }

  // ---------------------------------------------------------------
  // Modes
  // ---------------------------------------------------------------

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === "manual") {
      this._setState(this.manualState);
    } else if (mode === "live") {
      this.requestLiveWeather();
    } else {
      this._enteredAt = Date.now();
      this._durationMs = pickDurationMs(this.current);
      this._emit();
    }
    this.engine.events.emit("persistence:saveRequested");
  }

  /** Manual mode's own picker — also switches into Manual mode if
   *  something else was active, since choosing a specific state is an
   *  unambiguous request to stop letting it change on its own. */
  setWeather(id) {
    if (!WEATHER_STATES[id]) return;
    this.manualState = id;
    this.mode = "manual";
    this._setState(id);
    this.engine.events.emit("persistence:saveRequested");
  }

  async requestLiveWeather() {
    this.liveStatus = "loading";
    this.liveError = null;
    this._emit();
    try {
      const result = await fetchLiveWeather();
      this._liveLastFetch = Date.now();
      this.liveStatus = "ok";
      this.windSpeed = Math.min(1, result.windSpeedKmh / 60);
      this._windTarget = this.windSpeed;
      if (Number.isFinite(result.windDirectionDeg)) this.windDirectionRad = (result.windDirectionDeg * Math.PI) / 180;
      if (Number.isFinite(result.temperatureC)) this.temperatureC = result.temperatureC;
      this._setState(result.state);
    } catch (err) {
      this.liveStatus = "error";
      this.liveError = err.message ?? "Live weather is unavailable.";
      this.mode = "dynamic"; // graceful fallback, per the brief — not a silent one: liveError stays set for the panel to explain what happened
      this._enteredAt = Date.now();
      this._durationMs = pickDurationMs(this.current);
      this._emit();
    }
    this.engine.events.emit("persistence:saveRequested");
  }

  // ---------------------------------------------------------------
  // Workshop Dynamic
  // ---------------------------------------------------------------

  _catchUpDynamic() {
    let elapsed = Date.now() - this._enteredAt;
    let steps = 0;
    while (elapsed > this._durationMs && steps < MAX_CATCHUP_STEPS) {
      elapsed -= this._durationMs;
      this.current = weightedPick(TRANSITIONS[this.current] ?? TRANSITIONS.clear);
      this._durationMs = pickDurationMs(this.current);
      steps++;
    }
    this._enteredAt = Date.now() - Math.min(elapsed, this._durationMs);
  }

  _advanceDynamic() {
    this.current = weightedPick(TRANSITIONS[this.current] ?? TRANSITIONS.clear);
    this._enteredAt = Date.now();
    this._durationMs = pickDurationMs(this.current);
    this._windTarget = WIND_BASE[this.current] ?? 0.2;
    // A gentle chance to drift the wind direction alongside a weather
    // change, rather than it only ever coming from the same quarter.
    if (Math.random() < 0.4) this.windDirectionRad += (Math.random() - 0.5) * Math.PI * 0.6;
    this._emit();
    this.engine.events.emit("persistence:saveRequested");
  }

  _setState(id) {
    this.current = id;
    this._windTarget = WIND_BASE[id] ?? 0.2;
    this._emit();
  }

  getState() {
    return {
      mode: this.mode,
      current: this.current,
      manualState: this.manualState,
      liveStatus: this.liveStatus,
      liveError: this.liveError,
      windSpeed: this.windSpeed,
      windDirectionRad: this.windDirectionRad,
      options: Object.keys(WEATHER_STATES),
      manualOverrides: this.manualOverrides,
    };
  }

  _emit() {
    const def = WEATHER_STATES[this.current] ?? WEATHER_STATES.clear;
    const o = this.manualOverrides;
    const fogDensity = o.fogDensity ?? def.fogDensity;
    const cloudCoverage = o.cloudCoverage ?? def.cloudCoverage;
    const precipitation = o.precipitation ?? def.precipitation;
    this.engine.events.emit("environment:changed", {
      id: this.current,
      label: def.label,
      lightDampening: def.lightDampening,
      fogDensity,
      cloudCoverage,
      precipitation,
      ambience: def.ambience,
      windSpeed: this.windSpeed,
      windDirectionRad: this.windDirectionRad,
    });
    const rainOpacity = precipitation > 0 ? 0.35 + precipitation * 0.5 : 0;
    for (const mesh of this._rainMeshes) mesh.material.opacity = rainOpacity;
  }

  update(dt) {
    // Wind eases toward its target rather than snapping, with a slow
    // gust wobble layered on top — enough to feel alive, subtle enough
    // to never be distracting.
    this._windGustPhase += dt;
    const gust = Math.sin(this._windGustPhase * 0.3) * 0.08 + Math.sin(this._windGustPhase * 0.77) * 0.04;
    this.windSpeed += (this._windTarget + gust - this.windSpeed) * Math.min(1, dt * 0.5);

    if (this.mode === "dynamic" && Date.now() - this._enteredAt > this._durationMs) {
      this._advanceDynamic();
    } else if (this.mode === "live" && Date.now() - this._liveLastFetch > LIVE_REFRESH_INTERVAL_MS) {
      this.requestLiveWeather();
    }

    const def = WEATHER_STATES[this.current];
    const effectivePrecipitation = this.manualOverrides.precipitation ?? def?.precipitation ?? 0;
    if (effectivePrecipitation > 0) {
      this._rainScroll += dt * (0.6 + this.windSpeed * 0.4);
      const drift = Math.sin(this.windDirectionRad) * this.windSpeed * dt * 0.5;
      for (const mesh of this._rainMeshes) {
        mesh.material.map.offset.y = this._rainScroll % 1;
        mesh.material.map.offset.x = (mesh.material.map.offset.x + drift) % 1;
      }
    }
  }
}
