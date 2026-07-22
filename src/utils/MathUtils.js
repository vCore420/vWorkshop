import * as THREE from "three";

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent damping toward a target — smoother than a flat lerp. */
export function damp(current, target, smoothing, dt) {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

export function lerpColorHex(hexA, hexB, t) {
  const a = parseInt(hexA.replace("#", ""), 16);
  const b = parseInt(hexB.replace("#", ""), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/**
 * Samples a piecewise-linear colour gradient at `key` — `stops` is a
 * `[key, hexColor]` array sorted ascending by key (not enforced, just
 * expected; every call site here builds its own literal array in order).
 * Below the first stop or above the last, the nearest end colour holds
 * flat rather than extrapolating. Generalises `lerpColorHex`'s single
 * A→B blend to any number of bands — the Atmosphere phase's richer sky
 * (night → blue hour → dawn → golden hour → day, and back) is one
 * ordered list of (altitude, colour) pairs sampled through this, rather
 * than a chain of manually nested if/else branches.
 */
export function sampleColorGradient(stops, key) {
  if (key <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [k, color] = stops[i];
    if (key <= k) {
      const [prevKey, prevColor] = stops[i - 1];
      const t = k === prevKey ? 1 : (key - prevKey) / (k - prevKey);
      return lerpColorHex(prevColor, color, clamp(t, 0, 1));
    }
  }
  return stops[stops.length - 1][1];
}

export const TAU = Math.PI * 2;

/**
 * Lerp between two angles (radians) the *short* way around, regardless of
 * how far apart `a` and `b` are numerically. A plain `lerp` on raw yaw
 * values breaks as soon as the camera has turned enough that its
 * accumulated yaw drifts outside [-π, π] (which it always eventually does
 * during normal walk-mode look-around, since nothing ever wraps it) — the
 * numeric gap to a freshly-computed target angle can end up looking like
 * several radians even though the *actual* angular distance is small,
 * producing a visible spin instead of a small turn. See CameraSystem's
 * focus-mode interpolation, which is exactly this bug.
 */
export function shortestAngleLerp(a, b, t) {
  let delta = (b - a) % TAU;
  if (delta > Math.PI) delta -= TAU;
  else if (delta < -Math.PI) delta += TAU;
  return a + delta * t;
}

/** Wraps an angle (radians) into (-π, π] — keeps yaw from growing unbounded
 *  over a long play session (harmless numerically, but untidy). */
export function wrapAngle(a) {
  return a - TAU * Math.round(a / TAU);
}

/** "The player's reticle is directly over it" — a forgiving angular cone
 *  test against the camera's own actual forward direction, not a precise
 *  raycast hit-test against the target's own geometry. Originally private
 *  to `InteractionSystem._isLookingAt()`; extracted here (Version 4, "Fix:
 *  Bubble's Reticle-Gated Interaction + Click-and-Drag Reposition") once a
 *  second caller (`BeingController`'s own drag-trigger detection) needed
 *  the identical test, rather than reaching into `InteractionSystem`'s own
 *  private method or duplicating it. `scratch` is an optional pre-allocated
 *  `THREE.Vector3` for a hot-path caller that scans many candidates per
 *  frame (see `InteractionSystem.js`'s own use) — omitted, this allocates
 *  one fresh, harmless for an infrequent caller like a single mousedown
 *  check. */
export function isWithinLookCone(targetWorldPos, playerPos, cameraForwardDir, cosThreshold, scratch = new THREE.Vector3()) {
  scratch.subVectors(targetWorldPos, playerPos).normalize();
  return scratch.dot(cameraForwardDir) >= cosThreshold;
}
