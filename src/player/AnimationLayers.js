/**
 * AnimationLayers
 * -----------------
 * "Please begin preparing procedural animation layers. Rather than
 * creating hundreds of separate animations, the Workshop should
 * eventually combine animations together... walking while waving,
 * walking while carrying... the architecture should support layered
 * animation rather than replacing base animations."
 *
 * A real, working mechanism, not only a preparation for one — every pose
 * in this Workshop's own animation system is already a plain
 * `{jointName: [x,y,z]}` object (see `AnimationPlayback.
 * computeBlendedPose()`), which means "layer one animation over another"
 * is genuinely just "merge two plain objects, letting one win for a
 * chosen subset of keys" — no new pose representation, no blend-tree
 * engine, nothing that didn't already exist.
 *
 * `JOINT_GROUPS` names the two halves of the Workshop skeleton a layered
 * animation most commonly wants to split along — "walking while waving"
 * needs the overlay (Wave) to own the arms and head while the base
 * (Walk) keeps the legs; `upperBody`/`lowerBody` is that split, expressed
 * once here rather than as a hardcoded joint list wherever it's needed.
 * A caller wanting a different split (a future "just the head, for
 * looking at something" layer) passes its own explicit joint list
 * instead — `mergePoses()` itself has no opinion on what a sensible split
 * looks like, only how to apply one.
 */
export const JOINT_GROUPS = {
  upperBody: ["head", "torso", "upperArmLeft", "upperArmRight", "lowerArmLeft", "lowerArmRight", "handLeft", "handRight"],
  lowerBody: ["upperLegLeft", "upperLegRight", "lowerLegLeft", "lowerLegRight", "footLeft", "footRight"],
  armsOnly: ["upperArmLeft", "upperArmRight", "lowerArmLeft", "lowerArmRight", "handLeft", "handRight"],
  headOnly: ["head"],
};

/** Merges `overlayPose` on top of `basePose` — only the joints listed in
 *  `jointNames` are taken from `overlayPose`; every other joint keeps
 *  `basePose`'s own value untouched. Neither input is mutated. A joint
 *  present in `jointNames` but missing from `overlayPose` falls back to
 *  `basePose`'s own value for it (an overlay clip that doesn't bother
 *  animating every upper-body joint every frame — the Wave clip has
 *  nothing to say about the head, say — shouldn't blank that joint out
 *  to rest just because it's in the requested group). */
export function mergePoses(basePose, overlayPose, jointNames) {
  const merged = { ...basePose };
  for (const joint of jointNames) {
    if (overlayPose[joint]) merged[joint] = overlayPose[joint];
  }
  return merged;
}
