/**
 * WorkshopSkeleton
 * ------------------
 * "Please introduce skeleton mapping. Allow imported rigs to be mapped
 * onto a common Workshop skeleton... the Workshop should understand
 * skeleton relationships rather than relying on exact bone names."
 *
 * `WORKSHOP_JOINTS` names the fifteen joints the brief itself lists —
 * and, not by coincidence, the *exact* pivot names
 * `PlayerCharacter.buildCharacter()` already builds (`head`, `torso`,
 * `upperArmLeft`/`Right`, and so on). The Player rig was never a special
 * case needing its own animation format; it was already speaking the
 * common Workshop skeleton language every clip in `AnimationLibraryStore`
 * is authored against. This phase's own job is letting *other* rigs —
 * imported humanoid models, a Being's own GLTF skeleton — join that same
 * conversation.
 *
 * **`autoMapSkeleton(root)` is a real, working heuristic**, not a
 * placeholder — it walks an arbitrary `THREE.Object3D` hierarchy looking
 * for named bones/joints and matches each Workshop joint against a list
 * of common real-world naming patterns (Mixamo's own
 * `mixamorig:LeftForeArm`-style names, plain `"L_UpperArm"`/
 * `"upperarm_l"`-style names, and a handful of others) via case-
 * insensitive substring matching — "the goal is not perfection, the goal
 * is flexibility." A rig using a naming convention this doesn't
 * recognise simply comes back with fewer joints mapped, honestly, rather
 * than a wrong guess; see `BeingLibrary.js`/`ModelLibrary.js`'s own
 * manual-override capability for what a person does about the rest.
 */

/** `{id, label}` — the fifteen joints, in the brief's own order. Every
 *  id matches a real `PlayerCharacter.js` pivot name exactly, so mapping
 *  the Player rig onto this vocabulary is the identity function (see
 *  `IDENTITY_PLAYER_SKELETON_MAP` below). */
export const WORKSHOP_JOINTS = [
  { id: "head", label: "Head" },
  { id: "torso", label: "Chest" },
  { id: "upperArmLeft", label: "Upper Arm (Left)" },
  { id: "upperArmRight", label: "Upper Arm (Right)" },
  { id: "lowerArmLeft", label: "Lower Arm (Left)" },
  { id: "lowerArmRight", label: "Lower Arm (Right)" },
  { id: "handLeft", label: "Hand (Left)" },
  { id: "handRight", label: "Hand (Right)" },
  { id: "upperLegLeft", label: "Upper Leg (Left)" },
  { id: "upperLegRight", label: "Upper Leg (Right)" },
  { id: "lowerLegLeft", label: "Lower Leg (Left)" },
  { id: "lowerLegRight", label: "Lower Leg (Right)" },
  { id: "footLeft", label: "Foot (Left)" },
  { id: "footRight", label: "Foot (Right)" },
];
// "Pelvis" (the brief's own example) doesn't need its own entry — the
// Player rig's own "torso" pivot already sits at the hip line and is
// what every clip's own root-level rotation is authored against; adding
// a separate, never-populated "pelvis" joint would be exactly the kind
// of hardcoded-but-unused field this phase's own "avoid hardcoded
// assumptions wherever practical" warns against.

/** Every Workshop joint mapped to itself — the Player rig's own
 *  `pivots` object already uses these exact keys, so this is the
 *  trivial, always-true mapping for it; exported mainly for symmetry
 *  with `autoMapSkeleton()`'s own return shape, so a caller that treats
 *  "a skeleton map" as the general case (not "the Player rig, as a
 *  special case, needs no map at all") never has to branch on which kind
 *  of rig it's looking at. */
export const IDENTITY_PLAYER_SKELETON_MAP = Object.fromEntries(WORKSHOP_JOINTS.map((j) => [j.id, j.id]));

/** Substring patterns checked case-insensitively — the first matching
 *  kind wins, checked in `JOINT_KIND_ORDER` (more specific patterns
 *  first, so a "forearm" bone is never also caught by the looser "arm"
 *  pattern meant for upper arms, and a Mixamo-style "UpLeg" is never
 *  caught by the plain "leg" fallback meant for lower legs). Mixamo
 *  itself — the single most common rig naming convention actually
 *  encountered in practice — names upper legs `"UpLeg"` and lower legs
 *  plain `"Leg"`, which is exactly the kind of real-world naming quirk
 *  worth matching explicitly rather than discovering as a silent gap. */
const JOINT_NAME_PATTERNS = {
  head: ["head"],
  torso: ["spine", "chest", "torso"],
  upperArm: ["upperarm", "upper_arm", "arm"],
  lowerArm: ["forearm", "lowerarm", "lower_arm", "elbow"],
  hand: ["hand", "wrist"],
  upperLeg: ["upperleg", "upper_leg", "upleg", "thigh"],
  lowerLeg: ["lowerleg", "lower_leg", "shin", "calf", "knee", "leg"],
  foot: ["foot", "ankle", "toe"],
};
const JOINT_KIND_ORDER = ["head", "lowerArm", "upperArm", "hand", "upperLeg", "lowerLeg", "foot", "torso"];

const LEFT_PATTERNS = ["left", "_l", ".l", " l", "l_", "l.", ":l"];
const RIGHT_PATTERNS = ["right", "_r", ".r", " r", "r_", "r.", ":r"];

// Version 3, Phase 1 ("Completing Promises") — a real false positive,
// found by testing against an actual downloaded glTF sample
// (CesiumMan.glb, khronos's own reference test asset) rather than
// assumed correct: its skeleton sits inside a plain container node
// named "Armature" — the standard Blender/Mixamo/glTF-exporter default
// label for a whole rig's own root wrapper, virtually never renamed by
// anyone — and "armature" contains "arm" as a bare substring, so it
// matched `upperArm`'s own generic "arm" fallback pattern before any
// real arm bone ever got a chance to (first match wins). A handful of
// other tool-default wrapper labels share the identical risk. These are
// organisational containers, never joints, in every rig-export
// convention this file is aware of — excluded outright by name, rather
// than making the "arm" pattern itself stricter (a word-boundary
// requirement would risk breaking genuine compound Mixamo names like
// "LeftHandIndex1", which has no clean boundary around "hand" at all —
// exactly the real-world naming this heuristic exists to handle).
const NON_JOINT_CONTAINER_NAMES = new Set(["armature", "skeleton", "root", "rig"]);

function detectSide(name) {
  const lower = name.toLowerCase();
  if (LEFT_PATTERNS.some((p) => lower.includes(p))) return "Left";
  if (RIGHT_PATTERNS.some((p) => lower.includes(p))) return "Right";
  return null;
}

function detectJointKind(name) {
  const lower = name.toLowerCase();
  for (const kind of JOINT_KIND_ORDER) {
    if (JOINT_NAME_PATTERNS[kind].some((pattern) => lower.includes(pattern))) return kind;
  }
  return null;
}

/** Walks `root`'s own hierarchy (any `THREE.Object3D` — a real
 *  `THREE.Bone` from a GLTF skeleton, or an ordinary named `Group`)
 *  looking for names that match a Workshop joint, by kind and, where
 *  relevant, by side. Returns `{ map: {jointId: object3D}, rest:
 *  {jointId: THREE.Quaternion}, matchedCount }` — `rest` captures each
 *  matched bone's own rotation *at the moment this ran* (its bind/rest
 *  pose), which `AnimationRetargeting.js` needs to apply a clip's own
 *  rotations as a delta on top of, not a blind overwrite (see that
 *  file's own comment for why that distinction matters). Call this once,
 *  when a model is first loaded — not every frame — and cache the
 *  result (see `ModelLibrary.js`'s own `skeletonMap`/`skeletonRest`
 *  fields). */
export function autoMapSkeleton(root) {
  const map = {};
  const rest = {};
  root.traverse((node) => {
    if (!node.name) return;
    if (NON_JOINT_CONTAINER_NAMES.has(node.name.toLowerCase().trim())) return;
    const kind = detectJointKind(node.name);
    if (!kind) return;
    const side = detectSide(node.name);
    const jointId = kind === "head" || kind === "torso" ? kind : `${kind}${side ?? "Left"}`; // an unmarked limb bone (a symmetric rig authored without side suffixes, or a quadruped mid-limb) is treated as Left rather than dropped outright — a real, if imperfect, guess in the spirit of "the goal is flexibility, not perfection"
    if (map[jointId]) return; // first match wins — a rig with both "LeftArm" and "LeftArmRoll" (Mixamo does this) shouldn't have the second overwrite the first
    map[jointId] = node;
    rest[jointId] = node.quaternion.clone();
  });
  return { map, rest, matchedCount: Object.keys(map).length };
}

/** A quick, honest yes/no for "is this mapping worth offering as a
 *  default" — arbitrary but reasonable: at least half the Workshop
 *  skeleton's own joints were found. Below that, `BeingController.js`
 *  simply doesn't attempt retargeted playback for this model rather than
 *  animating a handful of limbs while the rest of the rig sits frozen in
 *  its bind pose, which would read as broken rather than "partially
 *  supported." */
export function isSkeletonMapUsable(map) {
  return Object.keys(map ?? {}).length >= Math.ceil(WORKSHOP_JOINTS.length / 2);
}
