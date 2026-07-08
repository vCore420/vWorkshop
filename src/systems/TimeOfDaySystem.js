import * as THREE from "three";
import { lerpColorHex, clamp, TAU } from "../utils/MathUtils.js";

/**
 * TimeOfDaySystem
 * ---------------
 * By default the workshop's lighting follows the visitor's actual real-world
 * clock — open it in the morning and morning light comes through the
 * windows; open it at 11pm and the room is dim with the practical lights
 * doing the work. That single decision does more for "a place that feels
 * alive" than any amount of decoration.
 *
 * A "simulated" mode also exists (currentTime advances at `speedMultiplier`
 * game-hours per real second, independent of the wall clock) for anyone who
 * wants to watch a full day cycle in a few minutes, or for a future
 * "time control" plugin. Both modes emit the same `timeofday:changed` event
 * so LightingSystem/WorldEnvironmentSystem never need to know which mode is
 * active.
 *
 * This system only *computes* the sky colour now — it doesn't apply it
 * anywhere itself. Before the outdoor world existed, it tinted the window
 * panes directly to fake a sky through glass that wasn't really there; now
 * that the windows are real transparent openings (see WorkshopRoom.js) and
 * a real sky exists (WorldEnvironmentSystem's scene.background/fog), that
 * hack is gone — WorldEnvironmentSystem listens to the same
 * `timeofday:changed` event independently.
 */
export class TimeOfDaySystem {
  constructor() {
    this.mode = "realtime"; // "realtime" | "simulated"
    this.currentTime = 12; // hours, 0-24, used directly in simulated mode
    this.speedMultiplier = 0.5; // game-hours per real second, simulated mode only
    this.paused = false;
    this._emitAccumulator = 0;
  }

  init(engine) {
    this.engine = engine;
    this._applyAndEmit(); // so the very first frame is already lit correctly

    engine.events.on("persistence:save", (bag) => {
      bag.timeOfDay = {
        mode: this.mode,
        currentTime: this.currentTime,
        speedMultiplier: this.speedMultiplier,
        paused: this.paused,
      };
    });
    engine.events.on("persistence:load", (bag) => {
      if (!bag?.timeOfDay) return;
      Object.assign(this, bag.timeOfDay);
      this._applyAndEmit();
    });
  }

  setMode(mode) {
    this.mode = mode;
    this._applyAndEmit();
  }

  setSpeed(hoursPerSecond) {
    this.speedMultiplier = hoursPerSecond;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  getState() {
    return { mode: this.mode, currentTime: this.currentTime, paused: this.paused };
  }

  update(dt) {
    if (this.mode === "realtime") {
      const now = new Date();
      this.currentTime = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    } else if (!this.paused) {
      this.currentTime = (this.currentTime + this.speedMultiplier * dt) % 24;
    }

    // Recompute lighting every frame in realtime mode is cheap and keeps
    // things perfectly smooth; still throttle slightly to be tidy.
    this._emitAccumulator += dt;
    if (this._emitAccumulator > 0.25) {
      this._emitAccumulator = 0;
      this._applyAndEmit();
    }
  }

  _computeState() {
    const phase = ((this.currentTime - 6) / 24) * TAU; // 0 at 06:00 (sunrise), PI at 18:00 (sunset)
    const altitude = Math.sin(phase);
    const dayFactor = clamp(altitude, 0, 1); // 0 at night, 1 at midday

    const sunDirection = new THREE.Vector3(
      Math.cos(phase),
      Math.max(altitude, -0.15),
      Math.sin(phase) * 0.4
    ).normalize();

    // Warm at the edges of the day, neutral-white at midday, cool at night.
    let sunColor;
    if (this.currentTime > 5 && this.currentTime < 8) sunColor = lerpColorHex("#ff9d5c", "#fff2df", (this.currentTime - 5) / 3);
    else if (this.currentTime > 16 && this.currentTime < 19) sunColor = lerpColorHex("#fff2df", "#ff8a5c", (this.currentTime - 16) / 3);
    else if (dayFactor > 0) sunColor = "#fff2df";
    else sunColor = "#405878";

    // Ambient/hemisphere floor raised from what this system originally
    // shipped with — the workshop read as too dark anywhere away from a
    // direct light source, even at midday. A real room is rarely near-total
    // darkness in its corners; this raises that floor without changing how
    // much the sun or the practical lights (lamps, ceiling pendants)
    // dominate near a window or a fixture — see LightingSystem.js, which
    // is untouched. Daytime maximums only move a little; the point is
    // fixing the dark corners and the night-time floor specifically, not
    // making the room brighter overall.
    const sunIntensity = 0.08 + dayFactor * 1.3;
    const hemiIntensity = 0.28 + dayFactor * 0.5;
    const ambientIntensity = 0.12 + dayFactor * 0.16;

    let skyColor;
    if (dayFactor > 0.15) skyColor = lerpColorHex("#ffb27a", "#bfe6ff", clamp((dayFactor - 0.15) / 0.4, 0, 1));
    else skyColor = lerpColorHex("#0d1b2e", "#ffb27a", clamp(dayFactor / 0.15, 0, 1));

    return { sunDirection, sunColor, sunIntensity, hemiIntensity, ambientIntensity, skyColor, dayFactor };
  }

  _applyAndEmit() {
    const state = this._computeState();
    this.engine.events.emit("timeofday:changed", state);
  }
}
