import * as THREE from "three";
import { TAU, clamp } from "./MathUtils.js";

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
  return clamp(v, -1, 1);
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

/** Real right-ascension (hours)/declination (degrees) to a position on a
 *  sphere of the given radius — the spherical-to-Cartesian conversion
 *  every catalogued star and constellation-line endpoint goes through
 *  (see `CONSTELLATIONS` below), so nothing duplicates this math. Mirrors
 *  `azimuthAltitudeToDirection()`'s own role one level up: that one turns
 *  a sky *direction* into world space; this one turns a catalogued star's
 *  real coordinates into a point on the star sphere
 *  `WorldEnvironmentSystem` already builds. Deliberately not reconciled
 *  with `azimuthAltitudeToDirection()`'s own north/east convention — RA=0
 *  has no fixed real-world bearing here, since nothing in this simplified
 *  model tracks sidereal time or the observer's longitude; the whole
 *  sphere still rotates by hour-of-day regardless (see
 *  `WorldEnvironmentSystem`'s own `rotation.y`), the same as the random
 *  background star field it sits alongside. */
export function raDecToSpherePosition(raHours, decDeg, radius, target = new THREE.Vector3()) {
  const decRad = toRad(decDeg);
  const raRad = toRad(raHours * 15); // 15°/hour — 360°/24h
  const y = Math.sin(decRad) * radius;
  const r = Math.cos(decRad) * radius;
  return target.set(Math.cos(raRad) * r, y, Math.sin(raRad) * r);
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

/** Rise/set hours (decimal, 0-24, or `null` if it doesn't cross the
 *  horizon at all that day — near the poles, at the right time of year,
 *  it genuinely might not) for a body whose altitude at a given hour is
 *  computed by `altitudeAtHour(hour)`. A simple scan in 6-minute steps
 *  looking for a sign change, not a closed-form solve — "Settings' own
 *  Atmosphere tab" is the only caller, and a display-only estimate,
 *  recomputed at most a few times a minute, doesn't need to be exact
 *  down to the second. */
function findRiseSet(altitudeAtHour) {
  const STEP = 0.1; // hours — 6 minutes
  let rise = null;
  let set = null;
  let previousAltitude = altitudeAtHour(0);
  for (let hour = STEP; hour <= 24; hour += STEP) {
    const altitude = altitudeAtHour(hour);
    if (previousAltitude < 0 && altitude >= 0 && rise === null) rise = hour;
    if (previousAltitude >= 0 && altitude < 0 && set === null) set = hour;
    previousAltitude = altitude;
  }
  return { rise, set };
}

/** Sunrise/sunset, in decimal hours, for the given latitude/day-of-year —
 *  the exact same `solarPosition()` formula every other sun placement in
 *  this project already uses, just scanned across a full day instead of
 *  evaluated once. */
export function sunriseSunset(latitude, dayOfYearValue) {
  return findRiseSet((hour) => solarPosition(hour, latitude, dayOfYearValue).altitude);
}

/** Moonrise/moonset — uses the exact same "effective hour" offset by
 *  lunar phase that `TimeOfDaySystem.js`'s own moon *position* already
 *  relies on (see that file's own comment on why), so a moon phase that
 *  visibly rises/sets at a different time than the sun is the same
 *  underlying relationship represented twice, not two different models
 *  that could ever disagree with each other. */
export function moonriseMoonset(latitude, dayOfYearValue, phaseFraction) {
  const offsetHours = phaseFraction * 24;
  return findRiseSet((hour) => solarPosition((hour + offsetHours) % 24, latitude, dayOfYearValue).altitude);
}

// Approximate day-of-year for the four meteorological season boundaries
// (Mar/Jun/Sep/Dec) — "meteorological" rather than the exact astronomical
// equinox/solstice moment (which shifts by a day or two year to year),
// since nothing here needs more precision than "which of four roughly
// three-month blocks is it" in the first place.
const SEASON_BOUNDARIES = [79, 172, 266, 355]; // ~Mar 20, Jun 21, Sep 23, Dec 21
const NORTHERN_SEASON_NAMES = ["spring", "summer", "autumn", "winter"];
const SOUTHERN_SEASON_NAMES = ["autumn", "winter", "spring", "summer"]; // same four boundaries, shifted a half-year for the opposite hemisphere

/**
 * Season Foundations (Atmosphere phase). "Establish clean architectural
 * foundations... do not fully implement seasonal gameplay." A single
 * pure function — real day-of-year math, no invented state, nothing to
 * persist — is deliberately the entire foundation for now: a future
 * phase giving seasons real teeth (vegetation, resident behaviour,
 * environmental simulation) only ever needs to call this, the same way
 * `getObserverLocation()`'s latitude already decides which hemisphere's
 * naming applies to `solarPosition()` without a second, parallel
 * concept. Southern-hemisphere latitudes (negative) get the same four
 * boundaries with the names rotated a half-year, rather than a
 * different calculation.
 */
export function getSeason(dayOfYearValue, latitude = 45) {
  const names = latitude < 0 ? SOUTHERN_SEASON_NAMES : NORTHERN_SEASON_NAMES;
  if (dayOfYearValue < SEASON_BOUNDARIES[0]) return names[3];
  if (dayOfYearValue < SEASON_BOUNDARIES[1]) return names[0];
  if (dayOfYearValue < SEASON_BOUNDARIES[2]) return names[1];
  if (dayOfYearValue < SEASON_BOUNDARIES[3]) return names[2];
  return names[3];
}

/**
 * A real, modest constellation catalogue — Version 4, Phase 9
 * ("Atmosphere, Continued"). Six named constellations, real approximate
 * right ascension (hours)/declination (degrees) for their brightest
 * stars, and an "asterism" edge list (index pairs into that
 * constellation's own `stars` array) describing which stars connect to
 * which for the recognizable line pattern. `WorldEnvironmentSystem`'s
 * `_buildConstellationStars()`/`_buildConstellationLines()` resolve
 * these through `raDecToSpherePosition()` above — this file owns the
 * real-astronomy data and math, same as everywhere else in it; the
 * renderer never invents a position of its own.
 *
 * Spans a deliberate range of declinations: circumpolar-for-mid-latitudes
 * (Ursa Major, Cassiopeia, Cygnus) through near-equatorial (Orion, which
 * visibly straddles the horizon — its belt sits at dec ≈ -0.3° to -1.9°,
 * its shoulders above, its feet below) to well south (Scorpius, Crux).
 * Because the rotation this catalogue feeds is still the simplified
 * vertical-axis spin (see `WorldEnvironmentSystem._onTimeChanged()`) —
 * it changes a star's azimuth, never its altitude — Scorpius's and
 * Crux's real negative declinations put every one of their stars
 * permanently below the horizon (world-space Y=0) at this project's
 * `DEFAULT_LATITUDE = 45` config, at every hour. That's the honest,
 * expected result of using real coordinates without also adding real
 * observer-latitude correction (out of scope for this pass — see
 * `docs/WORLD.md`'s own "Known simplifications"), not a bug to chase.
 */
export const CONSTELLATIONS = [
  {
    name: "Ursa Major",
    stars: [
      { ra: 11.062, dec: 61.75 }, // Dubhe
      { ra: 11.031, dec: 56.38 }, // Merak
      { ra: 11.897, dec: 53.69 }, // Phecda
      { ra: 12.257, dec: 57.03 }, // Megrez
      { ra: 12.9, dec: 55.96 }, // Alioth
      { ra: 13.399, dec: 54.93 }, // Mizar
      { ra: 13.792, dec: 49.31 }, // Alkaid
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]], // bowl + handle
  },
  {
    name: "Cassiopeia",
    stars: [
      { ra: 0.153, dec: 59.15 }, // Caph
      { ra: 0.675, dec: 56.54 }, // Schedar
      { ra: 0.945, dec: 60.72 }, // Gamma Cas
      { ra: 1.43, dec: 60.24 }, // Ruchbah
      { ra: 1.907, dec: 63.67 }, // Segin
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]], // the "W"
  },
  {
    name: "Cygnus",
    stars: [
      { ra: 20.69, dec: 45.28 }, // Deneb
      { ra: 20.37, dec: 40.26 }, // Sadr
      { ra: 19.512, dec: 27.96 }, // Albireo
      { ra: 19.75, dec: 45.13 }, // Delta Cyg
      { ra: 20.77, dec: 33.97 }, // Gienah
    ],
    edges: [[0, 1], [1, 2], [3, 1], [1, 4]], // Northern Cross
  },
  {
    name: "Orion",
    stars: [
      { ra: 5.919, dec: 7.41 }, // Betelgeuse
      { ra: 5.419, dec: 6.35 }, // Bellatrix
      { ra: 5.533, dec: -0.3 }, // Mintaka
      { ra: 5.604, dec: -1.2 }, // Alnilam
      { ra: 5.679, dec: -1.94 }, // Alnitak
      { ra: 5.796, dec: -9.67 }, // Saiph
      { ra: 5.242, dec: -8.2 }, // Rigel
    ],
    edges: [[0, 1], [2, 3], [3, 4], [6, 5], [1, 2], [4, 5]], // shoulders / belt / feet
  },
  {
    name: "Scorpius",
    stars: [
      { ra: 16.091, dec: -19.8 }, // Graffias
      { ra: 16.006, dec: -22.62 }, // Dschubba
      { ra: 16.49, dec: -26.43 }, // Antares
      { ra: 16.598, dec: -28.22 }, // Tau Sco
      { ra: 16.836, dec: -34.29 }, // Epsilon Sco
      { ra: 16.865, dec: -38.04 }, // Mu Sco
      { ra: 17.56, dec: -37.1 }, // Shaula
      { ra: 17.513, dec: -37.29 }, // Lesath
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]], // head to stinger
  },
  {
    name: "Crux",
    stars: [
      { ra: 12.443, dec: -63.09 }, // Acrux
      { ra: 12.519, dec: -57.11 }, // Gacrux
      { ra: 12.795, dec: -59.69 }, // Mimosa
      { ra: 12.252, dec: -58.75 }, // Delta Cru
    ],
    edges: [[1, 0], [2, 3]], // long axis, cross-arm
  },
];

export { dayOfYear };
