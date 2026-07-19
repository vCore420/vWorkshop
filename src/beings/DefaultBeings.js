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
 * **Person is fully rigged; Cat and Dog are not, honestly.**
 * `WorkshopSkeleton.WORKSHOP_JOINTS` only names biped joints (head,
 * torso, and six left/right limb pairs) — there is no vocabulary for a
 * quadruped's own four legs and tail, so tagging a cat or dog's parts
 * with `jointName` would mean either lying about which joint a foreleg
 * "is," or inventing new joint ids no animation clip could ever target
 * anyway. Left `null` on every Cat/Dog part instead: real geometry,
 * genuinely posed by hand, simply not animatable through the shared
 * Workshop skeleton — a genuinely new gap this content is the first to
 * surface, now named in `docs/BEINGS.md`'s own "Known simplifications"
 * section rather than left implicit.
 *
 * **Person's own left side is hand-placed; the right side is
 * `mirrorSubtree()`,** the exact tool the Being Creator's own "Mirror"
 * button already uses — reusing it here means the two sides are
 * *guaranteed* symmetric by construction, not just eyeballed to match.
 * Every part position follows one convention throughout: a part's
 * `position` is that part's own *segment midpoint*, not a joint —
 * `BodyCompiler.compileBody()` has no separate pivot-then-mesh split the
 * way `PlayerCharacter.js`'s rig does (one node *is* both the joint and
 * the visible box), so a part positioned at a joint would render
 * centred on and straddling it rather than hanging cleanly from it. A
 * segment-midpoint placement, with each child offset to meet its
 * parent's own far end, gives clean abutting limbs at rest — the
 * honest tradeoff is that any *future* animation rotating one of these
 * parts pivots around that segment's own centre rather than a true
 * joint, a structural property of `BodyCompiler.js` itself this file
 * doesn't attempt to work around. Every dimension reuses
 * `BodyModels.js`'s own masculine base measurements directly, so Person
 * stands at the same real-world scale the player already does.
 */

function part(id, name, parentId, shape, position, scale, color, jointName = null) {
  return { id, name, parentId, jointName, shape, position, rotation: [0, 0, 0], scale, color };
}

// ---- Person (fully rigged) ----------------------------------------

const SHIRT = "#5a7a8a";
const SKIN = "#d9a878";
const TROUSERS = "#3c3a38";
const SHOES = "#2c2419";

const personLeftAndRoot = [
  part("person-torso", "Torso", null, "box", [0, 1.23, 0], [0.52, 0.72, 0.32], SHIRT, "torso"),
  part("person-head", "Head", "person-torso", "box", [0, 0.53, 0], [0.34, 0.34, 0.34], SKIN, "head"),
  part("person-upperArmLeft", "Upper Arm (Left)", "person-torso", "box", [-0.32, 0.185, 0], [0.16, 0.35, 0.16], SHIRT, "upperArmLeft"),
  part("person-lowerArmLeft", "Lower Arm (Left)", "person-upperArmLeft", "box", [0, -0.325, 0], [0.14, 0.3, 0.14], SKIN, "lowerArmLeft"),
  part("person-handLeft", "Hand (Left)", "person-lowerArmLeft", "box", [0, -0.23, 0], [0.14, 0.16, 0.07], SKIN, "handLeft"),
  part("person-upperLegLeft", "Upper Leg (Left)", "person-torso", "box", [-0.15, -0.56, 0], [0.2, 0.4, 0.2], TROUSERS, "upperLegLeft"),
  part("person-lowerLegLeft", "Lower Leg (Left)", "person-upperLegLeft", "box", [0, -0.39, 0], [0.17, 0.38, 0.17], TROUSERS, "lowerLegLeft"),
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
  part("cat-body", "Body", null, "box", [0, 0.33, 0], [0.22, 0.22, 0.48], CAT_FUR),
  part("cat-head", "Head", "cat-body", "sphere", [0, 0.09, 0.26], [0.16, 0.16, 0.16], CAT_FUR),
  part("cat-earLeft", "Ear (Left)", "cat-head", "box", [-0.06, 0.09, -0.02], [0.04, 0.07, 0.02], CAT_FUR_DARK),
  part("cat-earRight", "Ear (Right)", "cat-head", "box", [0.06, 0.09, -0.02], [0.04, 0.07, 0.02], CAT_FUR_DARK),
  part("cat-tail", "Tail", "cat-body", "capsule", [0, 0.1, -0.3], [0.05, 0.28, 0.05], CAT_FUR),
  part("cat-legFrontLeft", "Front Leg (Left)", "cat-body", "cylinder", [-0.09, -0.22, 0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK),
  part("cat-legFrontRight", "Front Leg (Right)", "cat-body", "cylinder", [0.09, -0.22, 0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK),
  part("cat-legBackLeft", "Back Leg (Left)", "cat-body", "cylinder", [-0.09, -0.22, -0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK),
  part("cat-legBackRight", "Back Leg (Right)", "cat-body", "cylinder", [0.09, -0.22, -0.18], [0.05, 0.22, 0.05], CAT_FUR_DARK),
];
CAT_BODY_PARTS[4].rotation = [-0.6, 0, 0]; // tail, tipped up and back

// ---- Dog (unrigged) --------------------------------------------------

const DOG_FUR = "#b98a4f";
const DOG_FUR_DARK = "#8a6339";

const DOG_BODY_PARTS = [
  part("dog-body", "Body", null, "box", [0, 0.41, 0], [0.26, 0.26, 0.58], DOG_FUR),
  part("dog-head", "Head", "dog-body", "box", [0, 0.11, 0.35], [0.2, 0.2, 0.2], DOG_FUR),
  part("dog-snout", "Snout", "dog-head", "box", [0, -0.03, 0.15], [0.1, 0.09, 0.14], DOG_FUR),
  part("dog-earLeft", "Ear (Left)", "dog-head", "box", [-0.11, 0.02, -0.02], [0.05, 0.13, 0.03], DOG_FUR_DARK),
  part("dog-earRight", "Ear (Right)", "dog-head", "box", [0.11, 0.02, -0.02], [0.05, 0.13, 0.03], DOG_FUR_DARK),
  part("dog-tail", "Tail", "dog-body", "capsule", [0, 0.12, -0.35], [0.05, 0.24, 0.05], DOG_FUR),
  part("dog-legFrontLeft", "Front Leg (Left)", "dog-body", "cylinder", [-0.11, -0.27, 0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK),
  part("dog-legFrontRight", "Front Leg (Right)", "dog-body", "cylinder", [0.11, -0.27, 0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK),
  part("dog-legBackLeft", "Back Leg (Left)", "dog-body", "cylinder", [-0.11, -0.27, -0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK),
  part("dog-legBackRight", "Back Leg (Right)", "dog-body", "cylinder", [0.11, -0.27, -0.22], [0.06, 0.28, 0.06], DOG_FUR_DARK),
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

export const DEFAULT_BEINGS = [
  being("default-being-person", "Person", "A friendly, fully-rigged figure — built from primitives, animated through the same clips the player uses.", "person", PERSON_BODY_PARTS, {
    movementStyle: "wander",
    idleBehaviour: "stand",
    awarenessMode: "lookAtPlayer",
    interactionBehaviour: "talk",
    idleAnimationClipId: "default-idle",
    walkAnimationClipId: "default-walk",
  }),
  being("default-being-cat", "Cat", "A small, unrigged cat, built from primitives — content to sit and watch.", "animal", CAT_BODY_PARTS, {
    movementStyle: "wander",
    idleBehaviour: "sit",
    awarenessMode: "lookAtPlayer",
    interactionBehaviour: "inspect",
    homeRadius: 3,
  }),
  being("default-being-dog", "Dog", "A friendly, unrigged dog, built from primitives — sticks close and looks up often.", "animal", DOG_BODY_PARTS, {
    movementStyle: "follow",
    idleBehaviour: "lookAround",
    awarenessMode: "followPlayerWithEyes",
    interactionBehaviour: "wave",
    homeRadius: 4,
  }),
];
