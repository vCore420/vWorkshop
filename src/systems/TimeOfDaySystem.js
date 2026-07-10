import { lerpColorHex, clamp } from "../utils/MathUtils.js";
import { solarPosition, azimuthAltitudeToDirection, moonPhaseFraction, moonIllumination, dayOfYear, getObserverLocation, requestGeolocation } from "../utils/Astronomy.js";

function toRadLocal(deg) {
  return (deg * Math.PI) / 180;
}

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
 * wants to watch a full day cycle in a few minutes. Both modes emit the same
 * `timeofday:changed` event so LightingSystem/WorldEnvironmentSystem never
 * need to know which mode is active.
 *
 * **The Settings app's own time control** (`setTime()`) also uses simulated
 * mode under the hood, but never jumps straight to the requested hour —
 * "avoid instantly teleporting the sun or moon... the transition should
 * feel calm and believable." `update()` eases `currentTime` toward
 * whatever was requested along the *shorter* of the two directions around
 * the 24-hour clock (so 23:00 → 01:00 moves forward two hours, not
 * backward twenty-two), at a fixed rate — a few real seconds for even the
 * most extreme (12-hour) jump. Setting a time switches to simulated mode
 * and pauses there once the transition finishes, rather than continuing
 * to advance afterward; it's "go look at this specific moment," not "start
 * a new clock."
 *
 * **Astronomy** (`src/utils/Astronomy.js`) replaced the fixed,
 * direction-agnostic arc this system used to compute the sun/moon with —
 * "correct sunrise/sunset direction based on the player's location," using
 * a standard approximate solar-position formula driven by the player's own
 * geolocation when available (falling back to a fixed, reasonable
 * mid-latitude otherwise, the same "ask once, fall back gracefully on any
 * failure" shape `WeatherProvider.js`'s live weather already uses). The
 * moon's own position is derived from the same formula, offset by its
 * current phase's fraction of the day — a real moon phase visibly changes
 * *where* the moon rises and sets relative to the sun, not just how bright
 * it looks, and this is what actually reproduces that relationship rather
 * than just placing it "roughly opposite" the sun regardless of phase.
 *
 * This system only *computes* the sky colour, sun/moon direction, moon
 * phase, and star visibility now — it doesn't apply any of it anywhere
 * itself. `WorldEnvironmentSystem` listens to the same `timeofday:changed`
 * event independently, and the Compass (`CompassSystem.js`) reads the same
 * sun direction this emits to show where east/west actually are, so both
 * always agree with each other by construction.
 */
export class TimeOfDaySystem {
  constructor() {
    this.mode = "realtime"; // "realtime" | "simulated"
    this.currentTime = 12; // hours, 0-24, used directly in simulated mode
    this.speedMultiplier = 0.5; // game-hours per real second, simulated mode only
    this.paused = false;
    this._emitAccumulator = 0;
    this._transitionTarget = null; // hours, 0-24 — non-null while easing toward a Settings-requested time; see setTime()
  }

  init(engine) {
    this.engine = engine;
    requestGeolocation(); // see Astronomy.js — a no-op if already requested or unsupported; falls back gracefully either way
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
    this._transitionTarget = null; // switching modes explicitly cancels any transition in progress rather than fighting it
    this._applyAndEmit();
  }

  setSpeed(hoursPerSecond) {
    this.speedMultiplier = hoursPerSecond;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  /** The Settings app's own time control. Switches to simulated mode and
   *  eases toward `hour` rather than jumping — see this class's own doc
   *  comment for why. Pauses there once the transition finishes ("go look
   *  at this specific moment," not "start a new clock running from here"). */
  setTime(hour) {
    this.mode = "simulated";
    this._transitionTarget = ((hour % 24) + 24) % 24;
  }

  getState() {
    return { mode: this.mode, currentTime: this.currentTime, paused: this.paused, transitioning: this._transitionTarget !== null };
  }

  update(dt) {
    if (this._transitionTarget !== null) {
      this._advanceTransition(dt);
    } else if (this.mode === "realtime") {
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

  /** Eases `currentTime` toward `_transitionTarget` along whichever
   *  direction around the 24-hour clock is shorter, at a fixed rate — a
   *  few real seconds even for the most extreme (12-hour) jump. "Moving
   *  from morning to evening should smoothly move the sun across the
   *  sky... night should naturally transition into dawn," implemented as
   *  literally advancing the clock forward (or back) through every
   *  moment in between, not a cut. */
  _advanceTransition(dt) {
    const TRANSITION_RATE = 3; // game-hours of clock movement per real second
    let delta = (this._transitionTarget - this.currentTime) % 24;
    if (delta > 12) delta -= 24;
    else if (delta < -12) delta += 24;

    const step = Math.sign(delta) * TRANSITION_RATE * dt;
    if (Math.abs(step) >= Math.abs(delta) || delta === 0) {
      this.currentTime = this._transitionTarget;
      this._transitionTarget = null;
      this.paused = true; // arrived — hold here rather than continuing to run, until the player changes something else
    } else {
      this.currentTime = (this.currentTime + step + 24) % 24;
    }
  }

  _computeState() {
    const { latitude } = getObserverLocation();
    const doy = dayOfYear(new Date());

    const sun = solarPosition(this.currentTime, latitude, doy);
    const sunDirection = azimuthAltitudeToDirection(sun.azimuth, Math.max(sun.altitude, -8.6));
    // sin of the *actual* solar altitude — 1 at zenith, 0 at the horizon,
    // negative (clamped away) below it. Naturally varies by season and
    // latitude now rather than always reaching the same fixed maximum
    // every single day, since it's driven by a real altitude angle
    // rather than an arbitrary phase sine.
    const dayFactor = clamp(Math.sin(toRadLocal(sun.altitude)), 0, 1);

    // The moon's position is derived from the exact same solar-position
    // formula, at an "effective hour" offset by how far through its
    // current phase it is — a new moon (phase 0) sits at essentially the
    // sun's own position (0-hour offset: they rise and set together, which
    // is what "new moon" astronomically means), a full moon (phase 0.5)
    // is a 12-hour offset (opposite the sun, rising as it sets), and
    // anything in between falls proportionally somewhere around the same
    // daily arc. That relationship — not just "always opposite the sun
    // regardless of phase" — is what "moon movement matching the current
    // date and time" actually means astronomically.
    const moonPhaseFrac = moonPhaseFraction();
    const moonHour = (this.currentTime + moonPhaseFrac * 24) % 24;
    const moon = solarPosition(moonHour, latitude, doy);
    const moonDirection = azimuthAltitudeToDirection(moon.azimuth, Math.max(moon.altitude, -8.6));
    const moonIllum = moonIllumination(moonPhaseFrac);

    // Stars fade in well before full darkness and stay hidden in daylight
    // — a soft-edged threshold around dayFactor, not a hard cutoff.
    const starVisibility = clamp(1 - dayFactor / 0.2, 0, 1);

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

    return {
      sunDirection, sunColor, sunIntensity, hemiIntensity, ambientIntensity, skyColor, dayFactor,
      moonDirection, moonIllumination: moonIllum, starVisibility, hour: this.currentTime,
    };
  }

  _applyAndEmit() {
    const state = this._computeState();
    this.engine.events.emit("timeofday:changed", state);
  }
}
