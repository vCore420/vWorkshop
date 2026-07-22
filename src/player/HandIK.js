import * as THREE from "three";
import { applyTwoBoneChain } from "./TwoBoneIK.js";

/**
 * HandIK
 * -------
 * Version 4, Phase 8b ("The Rest of IK") — the second of `FootIK.js`'s
 * own sibling gaps, "hand placement, object interaction," closed the same
 * way the walk-cycle foot gap was: a small, honestly-scoped wiring of
 * `TwoBoneIK.js`'s already-real solver, not a new capability invented for
 * this. Two distinct poses, called by `HandInteractionSystem.js`
 * (`src/systems/`) — never by `PlayerAnimationSystem.js` itself, which
 * stays completely untouched this phase; both poses run as a correction
 * layered on top of whatever base pose already played this frame, the
 * identical "after the base pose, not instead of it" contract every
 * `FootIK.js` correction already follows.
 *
 * **Right hand holds, left hand reaches** — a deliberate assignment, not
 * an arbitrary one: a held book and a light-switch reach can genuinely
 * overlap in time (nothing stops a player from flipping a switch while
 * carrying a book), and opposite hands mean the two poses below never
 * need to coordinate or fight over the same arm.
 */

// Roughly where a bent elbow points — forward and slightly outward from
// the shoulder — expressed relative to the torso's own current world
// orientation, the identical "fixed, honest approximation" choice
// `FootIK.js`'s own knee pole hints already make, not derived from
// whichever clip happens to be playing.
const ELBOW_POLE_HINT_LOCAL = {
  Left: new THREE.Vector3(0.12, 0.15, 0.4),
  Right: new THREE.Vector3(-0.12, 0.15, 0.4),
};

// A fixed "holding something at chest height, slightly to the side and
// in front" spot, relative to the torso — not derived from the held
// object's own geometry (a book, today; whatever else the Construction
// Library grows later, tomorrow), since the object itself becomes a
// child of the hand pivot the moment it's picked up and simply follows
// wherever this pose puts the hand.
const HOLD_TARGET_LOCAL = new THREE.Vector3(0.16, -0.18, 0.32);

const _torsoWorldPos = new THREE.Vector3();
const _torsoWorldQuat = new THREE.Quaternion();
const _shoulderWorldPos = new THREE.Vector3();
const _targetWorld = new THREE.Vector3();
const _poleWorld = new THREE.Vector3();

/** Called every frame by `HandInteractionSystem` while an item is held —
 *  bends the right arm toward a fixed carry position. `pivots` is
 *  `PlayerCharacterSystem.getPivots()`'s own return value; a safe no-op
 *  for an imported-model rig (`pivots: {}`, no arm pivots to find), the
 *  same convention every other pivot consumer in this project follows. */
export function applyHoldPose(pivots) {
  if (!pivots?.torso) return;
  const shoulder = pivots.upperArmRight;
  const elbow = pivots.lowerArmRight;
  const wrist = pivots.handRight;
  if (!shoulder || !elbow || !wrist) return;

  const torsoWorldPos = pivots.torso.getWorldPosition(_torsoWorldPos);
  const torsoWorldQuat = pivots.torso.getWorldQuaternion(_torsoWorldQuat);
  const targetWorld = _targetWorld.copy(HOLD_TARGET_LOCAL).applyQuaternion(torsoWorldQuat).add(torsoWorldPos);

  const shoulderWorldPos = shoulder.getWorldPosition(_shoulderWorldPos);
  const poleWorld = _poleWorld.copy(ELBOW_POLE_HINT_LOCAL.Right).applyQuaternion(torsoWorldQuat).add(shoulderWorldPos);

  applyTwoBoneChain(shoulder, elbow, wrist, targetWorld, poleWorld);
}

const REACH_DURATION = 0.6; // seconds, a single out-and-back — see the envelope below

/** Called every frame by `HandInteractionSystem` while a light-switch
 *  reach is playing — bends the left arm out toward `targetWorld` and
 *  back over `REACH_DURATION` seconds, `elapsed` seconds into it. A
 *  cosmetic flourish, not a mechanical one: the switch itself already
 *  flipped the instant it was interacted with (see `LightingSystem.js`'s
 *  own `onInteract`), so this never needs to *reach* the target for
 *  anything to actually happen — only look like it did.
 *
 *  Blended, not snapped: `applyTwoBoneChain()` first solves and applies
 *  the *full* reach pose, then the two pivots it just set are eased back
 *  toward whatever the base pose already had them at (captured
 *  immediately before the solve) by `1 - envelope` — a sine-shaped
 *  envelope that's `0` at both ends and `1` at the midpoint, so the arm
 *  eases out, briefly reaches, and eases back, rather than snapping
 *  straight to full extension and holding it. Returns `true` while the
 *  reach is still playing, `false` once `elapsed` has run past
 *  `REACH_DURATION` — the caller's own cue to stop calling this and
 *  clear its own timer. */
export function applyReachPose(pivots, targetWorld, elapsed) {
  if (elapsed >= REACH_DURATION) return false;
  if (!pivots?.torso) return true; // still "active" — an imported-model rig just has nothing to visibly move
  const shoulder = pivots.upperArmLeft;
  const elbow = pivots.lowerArmLeft;
  const wrist = pivots.handLeft;
  if (!shoulder || !elbow || !wrist) return true;

  const envelope = Math.sin((elapsed / REACH_DURATION) * Math.PI);
  const baseShoulderQuat = shoulder.quaternion.clone();
  const baseElbowQuat = elbow.quaternion.clone();

  const torsoWorldQuat = pivots.torso.getWorldQuaternion(_torsoWorldQuat);
  const shoulderWorldPos = shoulder.getWorldPosition(_shoulderWorldPos);
  const poleWorld = _poleWorld.copy(ELBOW_POLE_HINT_LOCAL.Left).applyQuaternion(torsoWorldQuat).add(shoulderWorldPos);

  applyTwoBoneChain(shoulder, elbow, wrist, targetWorld, poleWorld);
  shoulder.quaternion.slerp(baseShoulderQuat, 1 - envelope);
  elbow.quaternion.slerp(baseElbowQuat, 1 - envelope);
  return true;
}
