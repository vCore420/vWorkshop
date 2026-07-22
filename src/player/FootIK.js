import * as THREE from "three";
import { solveTwoBoneIK } from "./TwoBoneIK.js";

/**
 * FootIK
 * -------
 * Version 3, Phase 1 ("Completing Promises") — "believable contact with
 * the world... foot placement on terrain" was the concrete Player-facing
 * payoff `TwoBoneIK.js` was built ahead of and never wired to anything
 * (see that file's own header). This is that wiring, scoped tightly per
 * the phase's own warning that IK tuning is "feel-work, easy to
 * over-run — scope it to two concrete contacts... and stop":
 *
 * - Only while standing still (`PlayerAnimationSystem` only calls this
 *   for movement state `"idle"`, which is only ever reached while
 *   grounded). Foot placement *during* a walk cycle was a genuinely
 *   different, animation-phase-aware problem (which foot is currently
 *   planted, when) — not attempted here at the time; see
 *   `applyWalkFootIK()`, below, for Version 4 Phase 8a's own answer to
 *   exactly that question.
 * - Only where `TerrainSystem` actually has height data. Indoors, on a
 *   Builder structure, or anywhere off the sculpted outdoor patch, this
 *   is a silent no-op and the ordinary flat-ground idle pose plays
 *   exactly as it always has.
 * - A *relative* correction, not an absolute one: each foot's target is
 *   the terrain height under that foot, offset by the same amount the
 *   terrain height differs from the terrain height under the
 *   character's own overall reference point (the torso's world X/Z —
 *   the same point `CameraSystem._computeGroundHeight()` effectively
 *   grounds the whole rig against). Where the terrain agrees with what
 *   the base idle pose already assumed (ordinary flat ground), the
 *   solved leg direction reproduces that same pose almost exactly. This
 *   is deliberate: it means the fix needs no knowledge of the rig's own
 *   foot geometry (sole thickness, ankle-to-floor offset) at all — only
 *   how far the ground moved relative to what the animation assumed.
 *
 * Mutates `hipPivot`/`kneePivot` directly (quaternions, which Three.js
 * keeps in sync with `.rotation` automatically) *after*
 * `PlayerCharacter.applyPose()` has already applied the base pose for
 * this frame — this runs as a correction on top of it, not a
 * replacement; `footLeft`/`footRight` themselves are left exactly as
 * the base pose set them, since a two-bone solve has no opinion on
 * ankle/foot orientation (see `TwoBoneIK.js`'s own header) — keeping
 * the foot sole flat against a slope is a distinct problem this phase
 * doesn't attempt either.
 *
 * **An honest, verified asymmetry, found by testing against real
 * sculpted terrain rather than assumed:** the default idle clip stands
 * with the leg already at ~99.99% of its own maximum reach (a nearly
 * straight, not bent, knee) — confirmed by comparing hip-to-ankle
 * distance against `upperLength + lowerLength` directly. That leaves
 * real slack for a foot that needs to rise (bending the knee further),
 * so a bump under one foot is corrected exactly. It leaves almost no
 * slack for a foot that needs to drop — reaching *further* than an
 * already-near-straight leg's own length is a genuine kinematic
 * impossibility, not a bug this file could fix — so `solveTwoBoneIK()`
 * honestly clamps to its own maximum reach (see that file's own
 * comment) and the correction is barely perceptible for a real dip or
 * downward slope. Properly fixing the downward case would mean either
 * retuning the idle clip's own authored knee bend (an animation-content
 * change, not a foot-placement-wiring one) or lowering the character's
 * own overall root height when the ground drops away (a `CameraSystem`
 * change, a materially bigger scope) — named here rather than
 * silently shipped as if the asymmetry didn't exist.
 */

const SIDES = ["Left", "Right"];

// Roughly where a bent knee points — forward and very slightly outward
// from the hip — expressed relative to the torso's own current world
// orientation, not the leg's own (whose rotation is exactly what this
// file is about to change, and whose base-pose value may itself be
// subtly swaying during idle). A fixed, honest approximation rather
// than anything derived from the currently-playing clip — see this
// file's own header for why per-frame walking contact is out of scope.
const POLE_HINT_LOCAL = {
  Left: new THREE.Vector3(-0.08, -0.3, 0.35),
  Right: new THREE.Vector3(0.08, -0.3, 0.35),
};

const REST_DOWN = new THREE.Vector3(0, -1, 0);

/** Rotates one leg's hip/knee pivots in place so the ankle reaches
 *  `targetWorld`, given the chain already sitting wherever the base
 *  pose just put it (hip's own world position is the IK chain's own
 *  root, and never moves — only its rotation, and its child's, do). */
function applyLegIK(hipPivot, kneePivot, anklePivot, targetWorld, poleWorld) {
  const rootWorldPos = hipPivot.getWorldPosition(new THREE.Vector3());
  const upperLength = kneePivot.position.length();
  const lowerLength = anklePivot.position.length();
  const solved = solveTwoBoneIK(rootWorldPos, upperLength, lowerLength, targetWorld, poleWorld);

  // A world-space direction becomes a local rotation via
  // Quaternion.setFromUnitVectors() — exactly what TwoBoneIK.js's own
  // header names as "whichever system owns that concern"'s job. The
  // parent's *current* world quaternion is what "local" means here;
  // hipPivot's parent is the torso, kneePivot's parent is hipPivot
  // itself — read *after* hipPivot's own quaternion is set below, so it
  // reflects this frame's new value, not last frame's.
  const hipParentWorldQuat = hipPivot.parent.getWorldQuaternion(new THREE.Quaternion());
  const hipLocalDir = solved.upperDirection.clone().applyQuaternion(hipParentWorldQuat.invert()).normalize();
  hipPivot.quaternion.setFromUnitVectors(REST_DOWN, hipLocalDir);

  const kneeParentWorldQuat = hipPivot.getWorldQuaternion(new THREE.Quaternion());
  const kneeLocalDir = solved.lowerDirection.clone().applyQuaternion(kneeParentWorldQuat.invert()).normalize();
  kneePivot.quaternion.setFromUnitVectors(REST_DOWN, kneeLocalDir);
}

/** Called once per frame by PlayerAnimationSystem, only while idle.
 *  `pivots` is PlayerCharacterSystem.getPivots()'s own return value —
 *  a safe no-op if the current rig is an imported model (`pivots: {}`,
 *  no leg pivots to find), the same convention every other pivot
 *  consumer in this project already relies on. */
/** Called once per frame by PlayerAnimationSystem, only while crouching.
 *  Version 4, Phase 4 — Vi's own field report: "the player model doesn't
 *  lower when crouching, it animates, the camera moves, but the players
 *  feet leave the ground instead of the whole body moving down." Root
 *  cause, confirmed live against the real rig before writing this fix:
 *  `CROUCH_CLIP`'s authored hip/knee bend is pure forward kinematics
 *  with nothing correcting it, and folds each leg *up* rather than
 *  settling it down — with `torsoPivot` never translating (`docs/
 *  PLAYER.md`'s own "no vertical translation at all" account), that
 *  shortfall shows up as the foot lifting into the air (measured 0.216m
 *  for the default body), not the body lowering. A foot-planting gap,
 *  not a missing capability — reuses the exact same `applyLegIK()`/
 *  `solveTwoBoneIK()` machinery `applyTerrainFootIK()` above already
 *  proved correct, just targeting straight down from each hip by the
 *  *standing* leg span (read live from the rig's own rest-pose segment
 *  lengths, so this is correct for every body proportion the Wardrobe
 *  can produce, not tuned for one default).
 *
 *  **An honest limit, discovered while implementing this, not
 *  papered over:** the standing pose already sits at ~99.99% of the
 *  leg's own maximum reach (see this file's own header, above) — which
 *  means there is no real slack left to *also* bend the knee forward
 *  while keeping the ankle at exactly the same height. Any target
 *  noticeably closer than full extension (enough to produce a visibly
 *  bent knee) necessarily reintroduces some of the same vertical float
 *  this fix exists to remove. Given the actual reported bug was the
 *  foot floating 21.6cm off the ground, not "the knee doesn't bend
 *  enough," this targets *exact* height correctness over a dramatic
 *  bend — the resulting crouch reads as the torso's own already-authored
 *  forward lean over straightened legs, not a deep knee-bent squat.
 *  Making the hip/torso genuinely drop in world space — the real fix for
 *  a proper bent-knee crouch — is the deeper, already-named "foot IK's
 *  own job, a later milestone" limitation (`docs/PLAYER.md`), squarely
 *  `docs/ROADMAP_V4.md`'s own future "Rest of IK" phase, not this one's. */
export function applyCrouchFootIK(pivots) {
  if (!pivots?.torso) return;
  const torsoWorldQuat = pivots.torso.getWorldQuaternion(new THREE.Quaternion());

  for (const side of SIDES) {
    const hip = pivots[`upperLeg${side}`];
    const knee = pivots[`lowerLeg${side}`];
    const ankle = pivots[`foot${side}`];
    if (!hip || !knee || !ankle) continue;

    const hipWorldPos = hip.getWorldPosition(new THREE.Vector3());
    const standingSpan = knee.position.length() + ankle.position.length();
    const target = hipWorldPos.clone();
    target.y -= standingSpan;

    const poleOffset = POLE_HINT_LOCAL[side].clone().applyQuaternion(torsoWorldQuat);
    const poleWorld = hipWorldPos.clone().add(poleOffset);

    applyLegIK(hip, knee, ankle, target, poleWorld);
  }
}

// Version 4, Phase 8a — which leg is in stance (foot planted, bearing
// weight) for each of `WALK_CLIP`'s own four frames
// (`AnimationClips.js`), read directly from that clip's own authored
// angles: frame 0 has the left leg back and nearly straight
// (`upperLegLeft: -0.5, lowerLegLeft: 0.15`) while the right leg swings
// forward, bent; frame 2 is the mirror. Frames 1/3 are brief (0.14s)
// passing poses with no single clear stance leg — omitted here, read as
// "no correction this frame" by `applyWalkFootIK()` below. Safe to
// hardcode against: `AnimationLibraryStore.isDefault()` keeps every
// seeded clip, this one included, read-only — a player can't reshape
// `WALK_CLIP` into something this mapping would no longer describe.
const WALK_STANCE_SIDE_BY_FRAME = { 0: "Left", 2: "Right" };

/** Version 4, Phase 8a ("The Rest of IK") — the walk-cycle counterpart
 *  to `applyTerrainFootIK()` above, closing the gap this file's own
 *  header used to name: "foot placement during a walk cycle is a
 *  genuinely different, animation-phase-aware problem... not attempted
 *  here." The problem was never the correction math — `applyLegIK()`
 *  already generalises to either foot — it was knowing *which* foot to
 *  correct at any instant, since correcting the swinging leg would flatten
 *  its own intentional lift. `WALK_STANCE_SIDE_BY_FRAME` above is that
 *  answer, read directly from the clip `PlayerAnimationSystem` is already
 *  playing — `frameIndex` is simply forwarded from its own
 *  `this._frameIndex`, already current for this frame by the time
 *  `update()` calls this (see that file's own comment).
 *
 *  Deliberately narrower than `applyTerrainFootIK()` in one way: only
 *  ever touches the single stance leg's own pivots, never both — the
 *  swing leg's authored pose is untouched, exactly as the walk cycle
 *  intended. A frame with no listed stance side (the brief passing poses)
 *  is a silent no-op, the same "leave the authored pose alone rather than
 *  guess" choice `applyTerrainFootIK()` already makes for a foot that
 *  straddles off the sculpted terrain patch. */
export function applyWalkFootIK(pivots, terrainSystem, frameIndex) {
  const side = WALK_STANCE_SIDE_BY_FRAME[frameIndex];
  if (!side || !terrainSystem || !pivots?.torso) return;

  const torsoWorldPos = pivots.torso.getWorldPosition(new THREE.Vector3());
  const referenceHeight = terrainSystem.getHeightAt(torsoWorldPos.x, torsoWorldPos.z);
  if (referenceHeight === null) return; // not standing on the sculpted terrain at all

  const hip = pivots[`upperLeg${side}`];
  const knee = pivots[`lowerLeg${side}`];
  const ankle = pivots[`foot${side}`];
  if (!hip || !knee || !ankle) return; // imported model, or a rig missing this pivot — same convention every other consumer here already follows

  const ankleWorldPos = ankle.getWorldPosition(new THREE.Vector3());
  const footHeight = terrainSystem.getHeightAt(ankleWorldPos.x, ankleWorldPos.z);
  if (footHeight === null) return; // the stance foot itself straddles off the sculpted patch

  const target = ankleWorldPos.clone();
  target.y += footHeight - referenceHeight;

  const torsoWorldQuat = pivots.torso.getWorldQuaternion(new THREE.Quaternion());
  const hipWorldPos = hip.getWorldPosition(new THREE.Vector3());
  const poleOffset = POLE_HINT_LOCAL[side].clone().applyQuaternion(torsoWorldQuat);
  const poleWorld = hipWorldPos.add(poleOffset);

  applyLegIK(hip, knee, ankle, target, poleWorld);
}

export function applyTerrainFootIK(pivots, terrainSystem) {
  if (!terrainSystem || !pivots?.torso) return;
  const torsoWorldPos = pivots.torso.getWorldPosition(new THREE.Vector3());
  const referenceHeight = terrainSystem.getHeightAt(torsoWorldPos.x, torsoWorldPos.z);
  if (referenceHeight === null) return; // not standing on the sculpted terrain at all

  const torsoWorldQuat = pivots.torso.getWorldQuaternion(new THREE.Quaternion());

  for (const side of SIDES) {
    const hip = pivots[`upperLeg${side}`];
    const knee = pivots[`lowerLeg${side}`];
    const ankle = pivots[`foot${side}`];
    if (!hip || !knee || !ankle) continue;

    const ankleWorldPos = ankle.getWorldPosition(new THREE.Vector3());
    const footHeight = terrainSystem.getHeightAt(ankleWorldPos.x, ankleWorldPos.z);
    if (footHeight === null) continue; // this one foot straddles off the sculpted patch — leave it as the base pose already had it

    const target = ankleWorldPos.clone();
    target.y += footHeight - referenceHeight;

    const hipWorldPos = hip.getWorldPosition(new THREE.Vector3());
    const poleOffset = POLE_HINT_LOCAL[side].clone().applyQuaternion(torsoWorldQuat);
    const poleWorld = hipWorldPos.add(poleOffset);

    applyLegIK(hip, knee, ankle, target, poleWorld);
  }
}
