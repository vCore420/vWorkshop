import * as THREE from "three";

/**
 * LookAtIK
 * ---------
 * Version 4, Phase 8c ("The Rest of IK") — the last of the four pieces
 * `TwoBoneIK.js`'s own header named back in Version 3, Phase 1: "foot
 * placement, hand placement, object interaction, ground adaptation,
 * looking at targets." Architecturally distinct from that file's own
 * law-of-cosines two-bone solver — this is a single joint aiming at a
 * point, not a two-bone chain reaching for one, so no two-bone math
 * applies here; the real content is computing a target local direction
 * and clamping the angle so a head can't unnaturally spin past a
 * believable range.
 *
 * Reuses the identical rig convention every other IK caller in this
 * project already relies on: an identity quaternion is the rest pose,
 * and — confirmed directly from the already-working whole-body-turn
 * feature (`BeingController.js`'s own `Math.atan2(toPlayer.x,
 * toPlayer.z)` yaw, applied straight to `rotation.y`) — local `+Z` is
 * this project's own established "forward" at rest, for the Player rig
 * and every compiled Being body alike.
 */
const _headWorldPos = new THREE.Vector3();
const _parentWorldQuat = new THREE.Quaternion();
const _toTargetLocal = new THREE.Vector3();
const _restForward = new THREE.Vector3(0, 0, 1);
const _clampedDir = new THREE.Vector3();
const _clampAxis = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();

/** Rotates `headPivot` in place so it aims toward `targetWorld`, blended
 *  in by `blend` (0-1) and clamped to `maxAngleRad` off the rig's own
 *  rest-forward — called every frame by `BeingController.js`, after
 *  whatever base pose/whole-body turn already applied this frame, the
 *  same "correction layered after the base pose" contract every
 *  `FootIK.js`/`HandIK.js` caller already follows. `blend` is expected
 *  to already be a smoothed 0-1 value (`runtime.awarenessBlend`) — no
 *  separate easing happens here beyond the slerp itself, which blends
 *  from whatever the head's *current* quaternion already is, so a
 *  shrinking `blend` naturally eases back toward rest over the same
 *  frames the caller's own awareness state is already decaying over. */
export function applyLookAt(headPivot, targetWorld, blend, maxAngleRad) {
  if (!headPivot || blend <= 0.001) return;

  const headWorldPos = headPivot.getWorldPosition(_headWorldPos);
  const parentWorldQuat = headPivot.parent.getWorldQuaternion(_parentWorldQuat);

  const toTargetLocal = _toTargetLocal.subVectors(targetWorld, headWorldPos).normalize().applyQuaternion(parentWorldQuat.invert());

  const angle = _restForward.angleTo(toTargetLocal);
  let clampedDir = toTargetLocal;
  if (angle > maxAngleRad) {
    // An exact angular clamp — rotate rest-forward by precisely
    // `maxAngleRad` around the axis perpendicular to both it and the
    // target direction, rather than a cheaper normalized-lerp
    // approximation (tried first; measured live to overshoot the
    // intended clamp by several degrees at a 90° input; the wrongness
    // was small but avoidable, and this feature is exactly the kind of
    // feel-work the roadmap's own risk note warns is easy to get subtly
    // wrong).
    const axis = _clampAxis.crossVectors(_restForward, toTargetLocal);
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0); // target directly behind rest-forward — no well-defined swing axis; an arbitrary (up) one is as honest as any other
    axis.normalize();
    clampedDir = _clampedDir.copy(_restForward).applyAxisAngle(axis, maxAngleRad);
  }

  const targetQuat = _targetQuat.setFromUnitVectors(_restForward, clampedDir);
  headPivot.quaternion.slerp(targetQuat, blend);
}
