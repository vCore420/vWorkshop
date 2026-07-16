import * as THREE from "three";

const _euler = new THREE.Euler();
const _delta = new THREE.Quaternion();

/**
 * AnimationRetargeting
 * ----------------------
 * "The Workshop should be capable of applying compatible animations
 * across different humanoid models... the goal is not perfection. The
 * goal is flexibility." `PlayerCharacter.applyPose()` works because the
 * Player rig's own pivots all start at an identity rotation — a clip's
 * own authored Euler values can simply overwrite `.rotation` outright.
 * An imported rig's own bones almost never start at identity — a bind
 * pose commonly has each bone already rotated to match the model's own
 * natural resting stance. Blindly copying a clip's own values onto a
 * bone like that wouldn't animate it from its natural pose; it would
 * snap it to a completely different, likely broken-looking one.
 *
 * The fix is the standard, well-understood one: capture each bone's own
 * rest rotation once (`WorkshopSkeleton.autoMapSkeleton()`'s own `rest`
 * map, taken at the moment a skeleton is first mapped), then apply a
 * clip's own rotation as a *delta* on top of that rest rotation, in the
 * bone's own local space (`rest.multiply(delta)`), rather than replacing
 * it outright. A clip authored against the Player rig's own clean,
 * zero-rotation pivots still reads as "the same gesture, expressed
 * relative to wherever this particular rig naturally rests" — genuinely
 * more correct than naive value-copying, though still an approximation
 * for rigs with very different proportions or bind conventions, which is
 * exactly the honest limit "not perfection, flexibility" describes.
 *
 * **The same X/Z negation `PlayerCharacter.applyPose()`'s own comment
 * explains** applies here too, for the identical reason — clips are
 * authored against the Player rig's own root orientation, and this
 * function is the second (now only other) place that orientation
 * convention needs to be honoured.
 */
export function applyPoseToMappedSkeleton(pose, skeletonMap, restQuaternions) {
  for (const jointId of Object.keys(skeletonMap)) {
    const bone = skeletonMap[jointId];
    const rest = restQuaternions[jointId];
    if (!bone || !rest) continue;
    const rotation = pose[jointId];
    if (rotation) {
      _euler.set(-rotation[0], rotation[1], -rotation[2]);
      _delta.setFromEuler(_euler);
      bone.quaternion.copy(rest).multiply(_delta);
    } else {
      bone.quaternion.copy(rest); // no rotation authored for this joint this frame — hold rest, the retargeted equivalent of PlayerCharacter.applyPose()'s own "reset to [0,0,0]"
    }
  }
}
