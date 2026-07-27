import { mirrorSubtree } from "./BodyCompiler.js";

/**
 * DefaultBeings
 * ---------------
 * Version 3, Phase 10 ("Real Assets, Honestly Introduced") — three
 * starter Beings, built entirely from primitive body parts, the same
 * "give the player ideas on what is capable" reasoning
 * `DefaultBlueprints.js` already established for the Builder Library.
 * Every part below is ordinary `BodyCompiler.js` data — a flat array of
 * `{id, name, parentId, jointName, shape, position, rotation, scale,
 * color}` — hand-placed the same way `DefaultBlueprints.js`'s own pieces
 * are, not generated.
 *
 * **All three are fully rigged.** Person uses the original biped
 * `WorkshopSkeleton.WORKSHOP_JOINTS` (head, torso, six left/right limb
 * pairs). Cat and Dog shipped unrigged in Phase 10 — the biped-only
 * joint vocabulary had nowhere honest for a quadruped's own legs and
 * tail to map to, a gap `docs/BEINGS.md`'s own "Known simplifications"
 * section named plainly rather than leaving implicit. Version 3, Phase
 * 10d ("Being Creator, Beyond the Prototype, Wave 3") closed it: five
 * new joints (`legFrontLeft`/`Right`, `legBackLeft`/`Right`, `tailBase`
 * — see `WorkshopSkeleton.js`'s own comment) let Cat and Dog tag their
 * existing body/head/legs/tail parts for real, driven by two new
 * clips (`AnimationClips.js`'s `default-quadruped-idle`/`-walk`)
 * authored specifically against that vocabulary — their own ears/snout
 * stay untagged, genuinely decorative, the same as a human Being's own
 * hair or jewellery would be.
 *
 * **Person's own left side is hand-placed; the right side is
 * `mirrorSubtree()`,** the exact tool the Being Creator's own "Mirror"
 * button already uses — reusing it here means the two sides are
 * *guaranteed* symmetric by construction, not just eyeballed to match.
 * Every dimension reuses `BodyModels.js`'s own masculine base
 * measurements directly, so Person stands at the same real-world scale
 * the player already does.
 *
 * **Every part's `position` names its own pivot — where it attaches to
 * its parent, and what a Workshop animation actually rotates** (see
 * `BodyCompiler.js`'s own module comment for the full pivot/mesh
 * architecture, added Version 3, Phase 10b). Every part below relies on
 * the default `meshOffset` of `[0, 0, 0]` — the visible shape centred
 * directly on its own pivot — rather than the "Hang Below Pivot" offset
 * the Being Creator's own editor can compute for a new part; these
 * were placed by hand, one segment's own end meeting the next
 * segment's own centre, the same clean-abutting-limbs result either
 * approach reaches.
 */

/**
 * Version 4, Phase 10d ("The Visual Upgrade — Player and Beings") —
 * `material` is new and optional, defaulting to the `"matte"` every part
 * here previously got implicitly from `BodyCompiler.js`'s own fallback.
 * `BODY_PART_MATERIALS` has offered six real choices since Version 3
 * Phase 10c and the Being Creator's own dropdown exposes all of them,
 * but not one of the Workshop's own starter Beings had ever used
 * anything but the default — so the shipped examples quietly
 * demonstrated less than the tool can do.
 */
function part(id, name, parentId, shape, position, scale, color, jointName = null, material = "matte") {
  return { id, name, parentId, jointName, shape, position, rotation: [0, 0, 0], scale, color, material };
}

// ---- Person (fully rigged) ----------------------------------------

const SHIRT = "#5a7a8a";
const SKIN = "#d9a878";
const TROUSERS = "#3c3a38";
const SHOES = "#2c2419";

/**
 * Version 4, Phase 10d — Person's silhouette, reconsidered.
 *
 * **Every `position` and every `jointName` below is byte-identical to
 * what it was.** That is the load-bearing constraint of this whole wave:
 * `compileBody()` derives `skeletonMap`/`skeletonRest` straight from
 * these parts' *pivots*, and `default-idle`/`default-walk` are authored
 * against exactly this rest pose. Move a pivot and every clip, plus
 * `FootIK`/`HandIK`/`LookAtIK`, silently mis-target. `scale` is the one
 * field that is safe to touch, and only because it applies to the mesh
 * and never to the pivot — the skeleton cannot see it.
 *
 * **The four capsule limbs' X and Z are divided by 0.6, and that is not
 * a proportion change.** A unit capsule measures 0.6 × 1.0 × 0.6 where a
 * unit box measures 1 × 1 × 1 (measured, not assumed — see
 * `BodyCompiler.js`'s own corrected comment, which used to claim they
 * matched). Swapping shape at the same scale would have made every limb
 * 40% thinner by accident. `0.16 / 0.6 = 0.2667` and so on restores
 * exactly the width the box had; Y is untouched, since the capsule's own
 * Y already measures a full unit, so limb lengths are unchanged too.
 *
 * What changed is therefore only which *primitive* fills each unchanged
 * volume. Person was eight boxes, which is the right vocabulary for the
 * *player* (see `PlayerCharacter.js` — that boxiness is the brief, and
 * its texture pipeline depends on it) but not for a Being: a Being is
 * authored through the Being Creator, which has offered capsules and
 * cylinders since Version 3 Phase 10c precisely so a creature needn't be
 * a stack of cubes. Limbs become capsules — a capsule is exactly the
 * shape a limb is, round in section with domed ends where a joint sits —
 * and the torso keeps its box, since a clothed chest genuinely does read
 * as a slab rather than a tube. Head stays a box too: it carries the
 * face, and a rounded head would make the boxy player standing next to
 * it look like the odd one out rather than the deliberate one.
 *
 * **Cat and Dog's bodies deliberately stay boxes**, for a structural
 * reason rather than a stylistic one: their long axis runs along Z, and a
 * capsule's length only ever runs along Y. `scale` can't lie one on its
 * side (scaling Z widens the round section rather than lengthening it),
 * and `rotation` would move the *pivot* — which for `cat-body`/`dog-body`
 * is the rigged `torso` joint the quadruped clips are authored against.
 * A capsule barrel would need either an unrigged part or a mesh-only
 * rotation this compiler doesn't offer. Tried, measured, reverted.
 *
 * Person is meant to *demonstrate* the Being Creator to someone opening
 * it for the first time. Shipping it as the one shape the tool makes
 * easiest undersold both.
 */
const personLeftAndRoot = [
  part("person-torso", "Torso", null, "box", [0, 1.23, 0], [0.52, 0.72, 0.32], SHIRT, "torso", "fabric"),
  part("person-head", "Head", "person-torso", "box", [0, 0.53, 0], [0.34, 0.34, 0.34], SKIN, "head"),
  part("person-upperArmLeft", "Upper Arm (Left)", "person-torso", "capsule", [-0.32, 0.185, 0], [0.2667, 0.35, 0.2667], SHIRT, "upperArmLeft", "fabric"),
  part("person-lowerArmLeft", "Lower Arm (Left)", "person-upperArmLeft", "capsule", [0, -0.325, 0], [0.2333, 0.3, 0.2333], SKIN, "lowerArmLeft"),
  part("person-handLeft", "Hand (Left)", "person-lowerArmLeft", "box", [0, -0.23, 0], [0.14, 0.16, 0.07], SKIN, "handLeft"),
  part("person-upperLegLeft", "Upper Leg (Left)", "person-torso", "capsule", [-0.15, -0.56, 0], [0.3333, 0.4, 0.3333], TROUSERS, "upperLegLeft", "fabric"),
  part("person-lowerLegLeft", "Lower Leg (Left)", "person-upperLegLeft", "capsule", [0, -0.39, 0], [0.2833, 0.38, 0.2833], TROUSERS, "lowerLegLeft", "fabric"),
  part("person-footLeft", "Foot (Left)", "person-lowerLegLeft", "box", [0, -0.235, 0.02], [0.18, 0.09, 0.26], SHOES, "footLeft"),
];

const PERSON_BODY_PARTS = [
  ...personLeftAndRoot,
  ...mirrorSubtree(personLeftAndRoot, "person-upperArmLeft"),
  ...mirrorSubtree(personLeftAndRoot, "person-upperLegLeft"),
];

// ---- Cat (unrigged) --------------------------------------------------

const CAT_FUR = "#c97b3e";
const CAT_FUR_DARK = "#a8663a";

const CAT_BODY_PARTS = [
  part("cat-body", "Body", null, "box", [0, 0.33, 0], [0.22, 0.22, 0.48], CAT_FUR, "torso", "fabric"),
  part("cat-head", "Head", "cat-body", "sphere", [0, 0.09, 0.26], [0.16, 0.16, 0.16], CAT_FUR, "head", "fabric"),
  part("cat-earLeft", "Ear (Left)", "cat-head", "box", [-0.06, 0.09, -0.02], [0.04, 0.07, 0.02], CAT_FUR_DARK),
  part("cat-earRight", "Ear (Right)", "cat-head", "box", [0.06, 0.09, -0.02], [0.04, 0.07, 0.02], CAT_FUR_DARK),
  part("cat-tail", "Tail", "cat-body", "capsule", [0, 0.1, -0.3], [0.05, 0.28, 0.05], CAT_FUR, "tailBase", "fabric"),
  part("cat-legFrontLeft", "Front Leg (Left)", "cat-body", "cylinder", [-0.09, -0.22, 0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK, "legFrontLeft", "fabric"),
  part("cat-legFrontRight", "Front Leg (Right)", "cat-body", "cylinder", [0.09, -0.22, 0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK, "legFrontRight", "fabric"),
  part("cat-legBackLeft", "Back Leg (Left)", "cat-body", "cylinder", [-0.09, -0.22, -0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK, "legBackLeft", "fabric"),
  part("cat-legBackRight", "Back Leg (Right)", "cat-body", "cylinder", [0.09, -0.22, -0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK, "legBackRight", "fabric"),
];
CAT_BODY_PARTS[4].rotation = [-0.6, 0, 0]; // tail, tipped up and back

// ---- Dog (unrigged) --------------------------------------------------

const DOG_FUR = "#b98a4f";
const DOG_FUR_DARK = "#8a6339";

const DOG_BODY_PARTS = [
  part("dog-body", "Body", null, "box", [0, 0.41, 0], [0.26, 0.26, 0.58], DOG_FUR, "torso", "fabric"),
  part("dog-head", "Head", "dog-body", "box", [0, 0.11, 0.35], [0.2, 0.2, 0.2], DOG_FUR, "head", "fabric"),
  part("dog-snout", "Snout", "dog-head", "box", [0, -0.03, 0.15], [0.1, 0.09, 0.14], DOG_FUR, null, "fabric"),
  part("dog-earLeft", "Ear (Left)", "dog-head", "box", [-0.11, 0.02, -0.02], [0.05, 0.13, 0.03], DOG_FUR_DARK),
  part("dog-earRight", "Ear (Right)", "dog-head", "box", [0.11, 0.02, -0.02], [0.05, 0.13, 0.03], DOG_FUR_DARK),
  part("dog-tail", "Tail", "dog-body", "capsule", [0, 0.12, -0.35], [0.05, 0.24, 0.05], DOG_FUR, "tailBase", "fabric"),
  part("dog-legFrontLeft", "Front Leg (Left)", "dog-body", "cylinder", [-0.11, -0.27, 0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK, "legFrontLeft", "fabric"),
  part("dog-legFrontRight", "Front Leg (Right)", "dog-body", "cylinder", [0.11, -0.27, 0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK, "legFrontRight", "fabric"),
  part("dog-legBackLeft", "Back Leg (Left)", "dog-body", "cylinder", [-0.11, -0.27, -0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK, "legBackLeft", "fabric"),
  part("dog-legBackRight", "Back Leg (Right)", "dog-body", "cylinder", [0.11, -0.27, -0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK, "legBackRight", "fabric"),
];
DOG_BODY_PARTS[3].rotation = [0, 0, -0.3]; // ear left, tilted outward/down
DOG_BODY_PARTS[4].rotation = [0, 0, 0.3]; // ear right, tilted outward/down
DOG_BODY_PARTS[5].rotation = [0.5, 0, 0]; // tail, wag-up angle

function being(id, name, description, beingType, bodyParts, overrides) {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id,
    name,
    description,
    beingType,
    tags: [],
    modelId: null,
    bodySource: "primitives",
    bodyParts,
    scale: 1,
    movementStyle: "static",
    idleBehaviour: "stand",
    walkSpeed: 1.2,
    turnSpeed: 2.5,
    homeRadius: 2.5,
    awarenessMode: "ignorePlayer",
    interactionBehaviour: "none",
    idleAnimationClipId: null,
    walkAnimationClipId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Version 4, Phase 7 — the Workshop's own seeded resident. A fixed,
// well-known id (never regenerated) so main.js/BubblePhoneApp.js/
// AIApp.js can find her own specific instance directly, the same way
// SaveMigrations.js's own v5→v6 migration relies on it existing.
export const BUBBLE_DEFINITION_ID = "default-being-bubble";

export const DEFAULT_BEINGS = [
  being("default-being-person", "Person", "A friendly, fully-rigged figure — built from primitives, animated through the same clips the player uses.", "person", PERSON_BODY_PARTS, {
    movementStyle: "wander",
    idleBehaviour: "stand",
    awarenessMode: "lookAtPlayer",
    interactionBehaviour: "talk",
    idleAnimationClipId: "default-idle",
    walkAnimationClipId: "default-walk",
  }),
  being("default-being-cat", "Cat", "A small cat, built from primitives and rigged through the Workshop's own quadruped joints — content to sit and watch.", "animal", CAT_BODY_PARTS, {
    movementStyle: "wander",
    idleBehaviour: "sit",
    awarenessMode: "lookAtPlayer",
    interactionBehaviour: "inspect",
    homeRadius: 3,
    idleAnimationClipId: "default-quadruped-idle",
    walkAnimationClipId: "default-quadruped-walk",
  }),
  being("default-being-dog", "Dog", "A friendly dog, built from primitives and rigged through the Workshop's own quadruped joints — sticks close and looks up often.", "animal", DOG_BODY_PARTS, {
    movementStyle: "follow",
    idleBehaviour: "lookAround",
    awarenessMode: "followPlayerWithEyes",
    interactionBehaviour: "wave",
    homeRadius: 4,
    idleAnimationClipId: "default-quadruped-idle",
    walkAnimationClipId: "default-quadruped-walk",
  }),
  being(BUBBLE_DEFINITION_ID, "Bubble", "The Workshop's own resident — a real conversation, real memory, genuinely aware of the world around it.", "resident", [], {
    movementStyle: "residentTravel",
    idleBehaviour: "stand",
    awarenessMode: "lookAtPlayer",
    interactionBehaviour: "aiResident",
    // Version 4, Phase 7b — restored, not a compiled body at all. Bubble
    // is the Workshop's own built-in resident, not a player design, so
    // she keeps her own original ResidentRenderer.js embodiment (shape,
    // colour, glow, and a genuinely editable/importable pixel-art face,
    // all configurable in Mission Control) — a third, real
    // `bodySource` value, deliberately never offered as a Being Creator
    // UI choice (the same "valid, reserved" precedent `beingType:
    // "resident"` already set), not a body-source a player would ever
    // pick for their own design. See BeingController.js's own
    // `_spawnRuntime()`/`_updateResidentTravel()` for how this renders.
    bodySource: "residentEmbodiment",
    // Resolved at boot (see main.js) to whichever profile is currently
    // the Workshop's own default the first time this is ever seeded —
    // profile ids are minted at runtime, never known ahead of time the
    // way a clip id already is (see this file's own being() calls above).
    residentProfileId: null,
    // No skeleton exists for a resident-embodiment body — nothing to
    // animate a clip onto.
    idleAnimationClipId: null,
    walkAnimationClipId: null,
  }),
];
