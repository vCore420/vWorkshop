import * as THREE from "three";

const _toTarget = new THREE.Vector3();
const _toPole = new THREE.Vector3();
const _bendAxis = new THREE.Vector3();
const _upperDir = new THREE.Vector3();
const _chainRootPos = new THREE.Vector3();
const _chainParentQuat = new THREE.Quaternion();
const _chainDir = new THREE.Vector3();
const REST_DOWN = new THREE.Vector3(0, -1, 0);

/**
 * TwoBoneIK
 * -----------
 * "Begin introducing IK support... foot placement, hand placement,
 * object interaction, ground adaptation, looking at targets... the
 * architecture should be established even where complete
 * implementations are deferred." A real, working, tested solver for the
 * single most common IK case a humanoid rig actually needs — an arm or a
 * leg, exactly two bones, reaching for a point (a target object, a spot
 * on the ground). "Looking at targets" and full "ground adaptation"
 * (a real floor raycast feeding this solver automatically) stay honest
 * future extension points — this file is the actual math either would be
 * built on, not a placeholder claiming to do either yet.
 *
 * **A pure geometry function, not a rig-specific one.** `solveTwoBoneIK()`
 * takes plain `THREE.Vector3` positions and bone lengths and returns
 * *positions and directions* — never a rotation in some specific rig's
 * own local-axis convention (the Player rig's own pivots, `PlayerCharacter
 * .applyPose()`'s own negated-X/Z convention, an imported bone's own
 * rest-relative delta — see `AnimationRetargeting.js`). Any of those can
 * turn a direction vector into their own local rotation using ordinary
 * `THREE.Quaternion.setFromUnitVectors()`; this file has no opinion on
 * which convention a caller needs, which is what makes it reusable by
 * the Player rig, a retargeted Being, and a future Animation Sandbox
 * alike, unchanged.
 *
 * The classic two-bone analytic solution (law of cosines) — exact,
 * closed-form, no iteration — for a root joint (shoulder/hip), a middle
 * joint (elbow/knee), and an end effector (hand/foot), reaching for
 * `target`. `poleHint` is a point roughly where the middle joint should
 * bend toward (in front of and slightly outward, for an elbow; forward,
 * for a knee) — without one, a two-bone chain has one remaining degree
 * of freedom (it could bend any direction around the root-target axis
 * and still reach), which is exactly what a pole hint resolves.
 */
export function solveTwoBoneIK(rootPos, upperLength, lowerLength, target, poleHint) {
  _toTarget.subVectors(target, rootPos);
  const rawDistance = _toTarget.length();
  const maxReach = upperLength + lowerLength;
  const minReach = Math.abs(upperLength - lowerLength);
  // Reachability clamp — a target further away than the chain's own full
  // length, or closer than it can fold to, is brought to the nearest
  // point it can actually reach rather than producing an invalid
  // (NaN-yielding) triangle. `reachable` tells the caller whether that
  // clamp actually happened, honestly, rather than silently pretending
  // the chain touched a target it didn't.
  const distance = THREE.MathUtils.clamp(rawDistance, minReach + 1e-4, maxReach - 1e-4);
  const reachable = Math.abs(rawDistance - distance) < 1e-3;

  const toTargetDir = _toTarget.clone().normalize();

  // Law of cosines: the angle at the root, between the upper bone and
  // the straight line to the target.
  const cosRootAngle = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * upperLength * distance);
  const rootAngle = Math.acos(THREE.MathUtils.clamp(cosRootAngle, -1, 1));

  // The interior angle at the middle joint (between the two bones) —
  // exported as `bendAngle` mainly for callers that want it directly
  // (a debug readout, a future facial/joint-limit system), not needed to
  // compute the positions below.
  const cosBendAngle = (upperLength * upperLength + lowerLength * lowerLength - distance * distance) / (2 * upperLength * lowerLength);
  const bendAngle = Math.acos(THREE.MathUtils.clamp(cosBendAngle, -1, 1));

  // The bend plane is defined by the root->target line and the pole
  // hint — its normal is the axis `toTargetDir` is rotated around by
  // `rootAngle` to get the upper bone's own direction.
  _toPole.subVectors(poleHint, rootPos);
  _bendAxis.crossVectors(toTargetDir, _toPole).normalize();
  if (_bendAxis.lengthSq() < 1e-8) {
    // toTargetDir and the pole hint direction were parallel (a target
    // directly in line with the pole) — no well-defined bend plane;
    // fall back to a world-up-based axis so this never divides by zero
    // or returns NaN directions, even in this degenerate case.
    _bendAxis.set(1, 0, 0);
  }

  _upperDir.copy(toTargetDir).applyAxisAngle(_bendAxis, rootAngle);

  const midPos = rootPos.clone().addScaledVector(_upperDir, upperLength);
  const lowerDir = target.clone().sub(midPos).normalize();
  // If clamped for reachability, `target` itself was never actually
  // reached — recompute the true end position the chain lands on, so a
  // caller can tell the difference between "reached exactly" and
  // "stretched as far as it goes."
  const endPos = reachable ? target.clone() : midPos.clone().addScaledVector(lowerDir, lowerLength);

  return {
    midPosition: midPos,
    endPosition: endPos,
    upperDirection: _upperDir.clone(),
    lowerDirection: lowerDir,
    bendAngle,
    reachable,
  };
}

/**
 * Version 4, Phase 8b ("The Rest of IK") — the shared rig-glue
 * `solveTwoBoneIK()`'s own header already named as any rig's job:
 * turning a world-space direction into a local rotation via
 * `Quaternion.setFromUnitVectors()`. `FootIK.js`'s own private
 * `applyLegIK()` already does exactly this for the leg chain — this is
 * the identical logic, exported here as a shared entry point for a
 * second chain (an arm, reaching for an object) rather than either
 * duplicating it or reaching into `FootIK.js`'s own private function,
 * which stays untouched to avoid any regression risk to its own already-
 * verified leg correction. Safe to reuse unmodified: every limb segment
 * `PlayerCharacter.js`/`BodyCompiler.js` build (leg *and* arm alike)
 * shares the identical rig convention — each child pivot's own rest
 * position, quaternion identity, points straight down (local `-Y`) from
 * its parent — confirmed directly in both files before writing this,
 * not assumed from the leg case alone.
 *
 * Mutates `rootPivot`/`midPivot` in place (shoulder/elbow, or hip/knee)
 * so the end effector (hand, or foot) reaches `targetWorld`, given
 * `poleWorld` for the same reason `solveTwoBoneIK()`'s own header
 * explains — the chain's one remaining degree of freedom. Returns the
 * same `solved` object `solveTwoBoneIK()` produced, so a caller that
 * wants `reachable`/`endPosition` (a reach animation checking whether it
 * actually landed on its target, say) doesn't need to solve twice.
 */
export function applyTwoBoneChain(rootPivot, midPivot, endPivot, targetWorld, poleWorld) {
  const rootWorldPos = rootPivot.getWorldPosition(_chainRootPos);
  const upperLength = midPivot.position.length();
  const lowerLength = endPivot.position.length();
  const solved = solveTwoBoneIK(rootWorldPos, upperLength, lowerLength, targetWorld, poleWorld);

  const rootParentWorldQuat = rootPivot.parent.getWorldQuaternion(_chainParentQuat);
  const rootLocalDir = _chainDir.copy(solved.upperDirection).applyQuaternion(rootParentWorldQuat.invert()).normalize();
  rootPivot.quaternion.setFromUnitVectors(REST_DOWN, rootLocalDir);

  const midParentWorldQuat = rootPivot.getWorldQuaternion(_chainParentQuat);
  const midLocalDir = _chainDir.copy(solved.lowerDirection).applyQuaternion(midParentWorldQuat.invert()).normalize();
  midPivot.quaternion.setFromUnitVectors(REST_DOWN, midLocalDir);

  return solved;
}
