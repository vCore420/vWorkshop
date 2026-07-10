import * as THREE from "three";
import { TAU } from "./MathUtils.js";

/**
 * Astronomy
 * -----------
 * "Correct sunrise direction based on the player's location... correct
 * sunset direction... moon movement matching the current date and time."
 * A standard, well-established approximate solar-position formula (the
 * kind used by countless simple sun-calculators — not NASA-grade
 * precision, but a genuine astronomical calculation rather than the
 * fixed, direction-agnostic arc the Workshop used before this pass),
 * driven by the player's own latitude/longitude when available.
 *
 * **The one convention everything in this file (and the Compass, and
 * TimeOfDaySystem) agrees on**: world -Z is north, +X is east, +Z is
 * south, -X is west — an ordinary map-like layout. `azimuthAltitudeToDirection()`
 * is the single place that turns an (azimuth, altitude) pair into a
 * world-space direction vector; every caller uses it, so this convention
 * only ever needs to be right in one place.
 *
 * `getObserverLocation()`/`requestGeolocation()` mirror
 * `WeatherProvider.js`'s own shape deliberately — geolocation is
 * inherently the kind of thing that can fail (permission denied,
 * unsupported, offline), and every failure here falls back the same way:
 * a fixed, reasonable default location (45°N, a generic
 * mid-latitude, rather than the equator, so a "typical" sky doesn't
 * degenerate into the sun going almost straight overhead year-round),
 * not a crash or a blank sky.
 */

const DEFAULT_LATITUDE = 45;
const DEFAULT_LONGITUDE = 0;

let _observerLocation = { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE, isReal: false };
let _geolocationRequested = false;

/** Whatever the current best-known observer location is — real, if
 *  geolocation was ever granted; the fixed default otherwise. Synchronous
 *  and always available, unlike the geolocation request itself. */
export function getObserverLocation() {
  return _observerLocation;
}

/** Requests real geolocation once (mirrors WeatherProvider.js's own
 *  "ask once, remember the outcome" shape) and updates
 *  `getObserverLocation()`'s result if it succeeds. Safe to call
 *  repeatedly — later calls are no-ops once a request has already gone
 *  out, successful or not, so nothing needs to track whether this was
 *  called before. */
export function requestGeolocation() {
  if (_geolocationRequested || !("geolocation" in navigator)) return;
  _geolocationRequested = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      _observerLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, isReal: true };
    },
    () => {
      // Denied, unavailable, or timed out — the fixed default location
      // already in place is a perfectly reasonable fallback; nothing
      // further to do.
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 }
  );
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Day-of-year (1-365/366) for the current real calendar date — the
 *  seasonal component of solar declination below depends on this, not on
 *  the Workshop's own simulated/real-time clock (which only ever
 *  represents a time *within* a day, not a date). */
function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

/**
 * Solar altitude/azimuth (both in degrees) for a given decimal hour
 * (0-24, local clock time — treated as solar time directly, a common
 * simplification that ignores the equation of time and the small
 * longitude-within-timezone offset; good enough to be "believable," not
 * claimed to be precise to the minute), latitude, and day-of-year.
 * Standard NOAA-style approximate formula.
 */
export function solarPosition(hour, latitude, dayOfYearValue) {
  const declination = 23.45 * Math.sin(toRad((360 / 365) * (dayOfYearValue + 284)));
  const hourAngle = 15 * (hour - 12);

  const latRad = toRad(latitude);
  const decRad = toRad(declination);
  const hourRad = toRad(hourAngle);

  const sinAltitude = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourRad);
  const altitude = Math.asin(clampUnit(sinAltitude)) * (180 / Math.PI);

  const cosAzimuth = (Math.sin(decRad) - Math.sin(toRad(altitude)) * Math.sin(latRad)) / (Math.cos(toRad(altitude)) * Math.cos(latRad) || 1e-6);
  let azimuth = Math.acos(clampUnit(cosAzimuth)) * (180 / Math.PI);
  if (hourAngle > 0) azimuth = 360 - azimuth; // afternoon — mirror to the western half of the sky

  return { altitude, azimuth };
}

function clampUnit(v) {
  return Math.min(1, Math.max(-1, v));
}

/** The one place (azimuth, altitude) in degrees becomes a world-space
 *  direction — see this file's own top comment for the convention. */
export function azimuthAltitudeToDirection(azimuthDeg, altitudeDeg, target = new THREE.Vector3()) {
  const az = toRad(azimuthDeg);
  const alt = toRad(altitudeDeg);
  return target.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az));
}

/** A world-space direction back into a compass heading (0-360°, 0=north,
 *  clockwise) — used by the Compass to read out where the player (or
 *  anything else with a world-space forward vector) is facing, using the
 *  exact same convention the sun/moon are positioned with. */
export function directionToAzimuth(direction) {
  const azimuth = Math.atan2(direction.x, -direction.z) * (180 / Math.PI);
  return (azimuth + 360) % 360;
}

/** 0 (new moon) - 1 (just before the next new moon) fraction through the
 *  synodic month, from the real calendar date — ~29.53 days per cycle;
 *  the reference new-moon date is arbitrary (any known new moon works as
 *  the epoch), only the current offset from it matters. */
export function moonPhaseFraction(date = new Date()) {
  const daysSinceEpoch = (date.getTime() - Date.UTC(2000, 0, 6)) / 86400000;
  return (((daysSinceEpoch % 29.53) + 29.53) % 29.53) / 29.53;
}

/** 0 (new, dark) - 1 (full, bright) illumination fraction from a moon phase fraction. */
export function moonIllumination(phaseFraction) {
  return (1 - Math.cos(phaseFraction * TAU)) / 2;
}

export { dayOfYear };
