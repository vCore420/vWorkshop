/**
 * AlignmentTools
 * ----------------
 * "Introduce alignment helpers... align left, centre, right, top,
 * bottom, even spacing... these should simplify creating clean layouts."
 * Pure functions over plain `[x,y,z]` position arrays — never touch
 * `WorldObjectsStore` or a `THREE.Object3D` directly, so they're testable
 * in isolation and reusable anywhere a set of positions needs aligning,
 * not tied to Build Mode's own selection mechanics.
 *
 * Every function takes `positions: Array<[x,y,z]>` and returns a new
 * array of adjusted positions in the same order — never mutates its
 * input. `BuildModeSystem.js`'s own `_alignSelection()` is the only
 * caller, and is the one place that turns the returned positions back
 * into real `updateInstanceTransform()` calls (each wrapped in its own
 * undo entry).
 *
 * "Left/right/top/bottom" are expressed as Workshop world axes rather
 * than screen-relative terms, since alignment here means "line these
 * objects up in 3D space," not "line them up as seen from the current
 * camera angle": X is left↔right, Y is bottom↔top, Z is near↔far.
 */
const AXIS_INDEX = { x: 0, y: 1, z: 2 };

function axisValues(positions, axis) {
  const i = AXIS_INDEX[axis];
  return positions.map((p) => p[i]);
}

function withAxis(positions, axis, values) {
  const i = AXIS_INDEX[axis];
  return positions.map((p, idx) => {
    const next = [...p];
    next[i] = values[idx];
    return next;
  });
}

/** `mode` is `"min"` (align to the lowest value on this axis — "left"/
 *  "bottom"/"near"), `"center"` (align to the midpoint of the group's own
 *  span), or `"max"` ("right"/"top"/"far"). Every position ends up with
 *  the identical value on `axis`, whichever one that resolves to. */
export function alignPositions(positions, axis, mode) {
  if (positions.length < 2) return [...positions];
  const values = axisValues(positions, axis);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const target = mode === "min" ? min : mode === "max" ? max : (min + max) / 2;
  return withAxis(positions, axis, positions.map(() => target));
}

/** Spreads every position evenly between the group's own current minimum
 *  and maximum on `axis`, in ascending order of their current value on
 *  that axis — "even spacing" without needing the caller to have sorted
 *  its own selection first. The two extremes never move; only whatever's
 *  between them redistributes to equal gaps. Fewer than three positions
 *  has nothing meaningful to distribute (two points are already "evenly
 *  spaced" by definition), so it's returned unchanged. */
export function distributeEvenly(positions, axis) {
  if (positions.length < 3) return [...positions];
  const values = axisValues(positions, axis);
  const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const min = values[order[0]];
  const max = values[order[order.length - 1]];
  const step = (max - min) / (order.length - 1);

  const nextValues = new Array(positions.length);
  order.forEach((originalIndex, rank) => {
    nextValues[originalIndex] = min + step * rank;
  });
  return withAxis(positions, axis, nextValues);
}

/** The overall bounding extent of a set of positions alone — a simple,
 *  point-based measurement (not the true geometric bounding box each
 *  object's own compiled mesh would have, which `WorldObjectsSystem.
 *  getFootprints()` already computes per instance for collision — see
 *  `BuildModeSystem.js`'s own `_measureSelection()` for where the two are
 *  combined). Useful on its own for "how far apart is my whole layout,
 *  from object origin to object origin." */
export function positionsBounds(positions) {
  const xs = axisValues(positions, "x");
  const ys = axisValues(positions, "y");
  const zs = axisValues(positions, "z");
  return {
    min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
  };
}
