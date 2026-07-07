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
