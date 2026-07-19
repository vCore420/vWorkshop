/**
 * AnimationClips
 * ----------------
 * The default animation set every Workshop starts with — seeded into
 * `AnimationLibraryStore` exactly the way `ConstructionLibrary.js` seeds
 * the Builder's own library: permanent, hand-authored data in the same
 * shape a player-created animation has, not a different kind of thing.
 * `AnimationLibraryStore.getClip()` doesn't know or care whether a clip
 * came from here, from the Animation Editor, or from an imported file.
 *
 * **The data shape** (a "clip"):
 *   { id, name, description, category, loop, speed,
 *     frames: [ { duration, pose: { pivotName: [x,y,z], ... } }, ... ] }
 *
 * `pose` is a plain Euler-angle (radians) rotation per pivot name — the
 * exact same names `PlayerCharacter.js`'s rig produces
 * (`upperLegLeft`/`lowerArmRight`/etc). A pivot the pose doesn't mention
 * is simply left at its rest rotation. Linear interpolation between two
 * frames' Euler angles (not quaternion slerp) is a deliberate
 * simplification — see `PlayerAnimationSystem.js`'s own comment — that
 * holds up fine for the modest rotation ranges ordinary locomotion
 * actually needs, without needing a heavier interpolation scheme to stay
 * "believable, not physically perfect."
 *
 * Every clip here works identically regardless of which body model is
 * currently active, because every body model produces the exact same
 * pivot names (see `BodyModels.js`) — nothing about authoring these had
 * to know or care that more than one model exists.
 */

function frame(duration, pose) {
  return { duration, pose };
}

const IDLE_CLIP = {
  id: "default-idle",
  name: "Idle",
  description: "A quiet, subtle sway — the resting state between everything else.",
  category: "movement",
  loop: true,
  speed: 1,
  frames: [
    frame(2.2, { torso: [0.012, 0, 0], head: [-0.01, 0.03, 0] }),
    frame(2.2, { torso: [-0.008, 0, 0], head: [-0.01, -0.03, 0] }),
  ],
};

const WALK_CLIP = {
  id: "default-walk",
  name: "Walk",
  description: "An ordinary walking cycle — legs and arms alternating naturally.",
  category: "movement",
  loop: true,
  speed: 1,
  frames: [
    frame(0.28, {
      upperLegLeft: [-0.5, 0, 0], lowerLegLeft: [0.15, 0, 0],
      upperLegRight: [0.42, 0, 0], lowerLegRight: [0.55, 0, 0],
      upperArmLeft: [0.4, 0, 0], upperArmRight: [-0.45, 0, 0],
      torso: [0, 0.03, 0.015],
    }),
    frame(0.14, {
      upperLegLeft: [-0.1, 0, 0], lowerLegLeft: [0.35, 0, 0],
      upperLegRight: [0.1, 0, 0], lowerLegRight: [0.1, 0, 0],
      upperArmLeft: [0.05, 0, 0], upperArmRight: [-0.05, 0, 0],
      torso: [0, 0, 0],
    }),
    frame(0.28, {
      upperLegLeft: [0.42, 0, 0], lowerLegLeft: [0.55, 0, 0],
      upperLegRight: [-0.5, 0, 0], lowerLegRight: [0.15, 0, 0],
      upperArmLeft: [-0.45, 0, 0], upperArmRight: [0.4, 0, 0],
      torso: [0, -0.03, -0.015],
    }),
    frame(0.14, {
      upperLegLeft: [0.1, 0, 0], lowerLegLeft: [0.1, 0, 0],
      upperLegRight: [-0.1, 0, 0], lowerLegRight: [0.35, 0, 0],
      upperArmLeft: [-0.05, 0, 0], upperArmRight: [0.05, 0, 0],
      torso: [0, 0, 0],
    }),
  ],
};

const RUN_CLIP = {
  id: "default-run",
  name: "Run",
  description: "A faster, more exaggerated cycle with a forward lean.",
  category: "movement",
  loop: true,
  speed: 1,
  frames: [
    frame(0.16, {
      upperLegLeft: [-0.9, 0, 0], lowerLegLeft: [1.1, 0, 0],
      upperLegRight: [0.75, 0, 0], lowerLegRight: [0.2, 0, 0],
      upperArmLeft: [0.75, 0, 0], upperArmRight: [-0.8, 0, 0],
      lowerArmLeft: [0.9, 0, 0], lowerArmRight: [0.9, 0, 0],
      torso: [0.12, 0.05, 0.02],
    }),
    frame(0.08, {
      upperLegLeft: [-0.2, 0, 0], lowerLegLeft: [0.7, 0, 0],
      upperLegRight: [0.15, 0, 0], lowerLegRight: [0.15, 0, 0],
      upperArmLeft: [0.2, 0, 0], upperArmRight: [-0.2, 0, 0],
      lowerArmLeft: [0.9, 0, 0], lowerArmRight: [0.9, 0, 0],
      torso: [0.12, 0, 0],
    }),
    frame(0.16, {
      upperLegLeft: [0.75, 0, 0], lowerLegLeft: [0.2, 0, 0],
      upperLegRight: [-0.9, 0, 0], lowerLegRight: [1.1, 0, 0],
      upperArmLeft: [-0.8, 0, 0], upperArmRight: [0.75, 0, 0],
      lowerArmLeft: [0.9, 0, 0], lowerArmRight: [0.9, 0, 0],
      torso: [0.12, -0.05, -0.02],
    }),
    frame(0.08, {
      upperLegLeft: [0.15, 0, 0], lowerLegLeft: [0.15, 0, 0],
      upperLegRight: [-0.2, 0, 0], lowerLegRight: [0.7, 0, 0],
      upperArmLeft: [-0.2, 0, 0], upperArmRight: [0.2, 0, 0],
      lowerArmLeft: [0.9, 0, 0], lowerArmRight: [0.9, 0, 0],
      torso: [0.12, 0, 0],
    }),
  ],
};

const JUMP_CLIP = {
  id: "default-jump",
  name: "Jump",
  description: "A brief launch pose — legs tuck, arms rise.",
  category: "movement",
  loop: false,
  speed: 1,
  frames: [
    frame(0.1, {
      upperLegLeft: [0.3, 0, 0], upperLegRight: [0.3, 0, 0],
      lowerLegLeft: [-0.6, 0, 0], lowerLegRight: [-0.6, 0, 0],
      upperArmLeft: [0.9, 0, -0.15], upperArmRight: [0.9, 0, 0.15],
    }),
    frame(0.5, {
      upperLegLeft: [0.15, 0, 0], upperLegRight: [0.15, 0, 0],
      lowerLegLeft: [-0.35, 0, 0], lowerLegRight: [-0.35, 0, 0],
      upperArmLeft: [0.5, 0, -0.1], upperArmRight: [0.5, 0, 0.1],
    }),
  ],
};

const FALL_CLIP = {
  id: "default-fall",
  name: "Fall",
  description: "Legs relaxed, arms slightly out for balance while airborne.",
  category: "movement",
  loop: true,
  speed: 1,
  frames: [
    frame(0.6, {
      upperLegLeft: [0.1, 0, 0], upperLegRight: [0.1, 0, 0],
      lowerLegLeft: [-0.25, 0, 0], lowerLegRight: [-0.25, 0, 0],
      upperArmLeft: [0.25, 0, -0.2], upperArmRight: [0.25, 0, 0.2],
    }),
    frame(0.6, {
      upperLegLeft: [0.15, 0, 0], upperLegRight: [0.15, 0, 0],
      lowerLegLeft: [-0.3, 0, 0], lowerLegRight: [-0.3, 0, 0],
      upperArmLeft: [0.3, 0, -0.22], upperArmRight: [0.3, 0, 0.22],
    }),
  ],
};

const LAND_CLIP = {
  id: "default-land",
  name: "Land",
  description: "A brief knee-bend absorbing the impact before returning to normal.",
  category: "movement",
  loop: false,
  speed: 1,
  frames: [
    frame(0.08, {
      upperLegLeft: [0.55, 0, 0], upperLegRight: [0.55, 0, 0],
      lowerLegLeft: [-1.0, 0, 0], lowerLegRight: [-1.0, 0, 0],
      torso: [-0.15, 0, 0],
    }),
    frame(0.16, {
      upperLegLeft: [0.1, 0, 0], upperLegRight: [0.1, 0, 0],
      lowerLegLeft: [-0.2, 0, 0], lowerLegRight: [-0.2, 0, 0],
      torso: [-0.02, 0, 0],
    }),
  ],
};

// "The current crouch animation appears inverted and pushes the player
// downward into the floor... feet remain planted, player lowers
// naturally." Root cause: this clip (like JUMP/FALL/LAND above) is a
// symmetric, non-alternating pose — unlike WALK/RUN's alternating gait,
// which stays a valid-looking cycle under a global sign flip (swapping
// which leg is "forward" is invisible to the eye), a symmetric knee-bend
// flipped the same way in both legs bends the *wrong direction*, which
// reads as sinking into the ground rather than settling into a crouch.
// These values are renegated from their original authoring (see
// PlayerCharacter.js's own applyPose() comment for the full root-cause
// account) to compensate for applyPose()'s own X/Z negation, restoring
// the originally-intended, correct-looking pose.
const CROUCH_CLIP = {
  id: "default-crouch",
  name: "Crouch",
  description: "A held, lowered stance.",
  category: "movement",
  loop: true,
  speed: 1,
  frames: [
    frame(1.6, {
      upperLegLeft: [0.85, 0, 0], upperLegRight: [0.85, 0, 0],
      lowerLegLeft: [-1.5, 0, 0], lowerLegRight: [-1.5, 0, 0],
      torso: [-0.28, 0, 0],
      upperArmLeft: [-0.1, 0, -0.05], upperArmRight: [-0.1, 0, 0.05],
    }),
    frame(1.6, {
      upperLegLeft: [0.82, 0, 0], upperLegRight: [0.82, 0, 0],
      lowerLegLeft: [-1.45, 0, 0], lowerLegRight: [-1.45, 0, 0],
      torso: [-0.26, 0, 0],
      upperArmLeft: [-0.08, 0, -0.05], upperArmRight: [-0.08, 0, 0.05],
    }),
  ],
};

const LADDER_CLIMB_CLIP = {
  id: "default-ladderClimb",
  name: "Ladder Climb",
  description: "Alternating reach-and-step, hands and feet trading off.",
  category: "movement",
  loop: true,
  speed: 1,
  frames: [
    frame(0.24, {
      upperArmLeft: [-1.3, 0, 0.1], upperArmRight: [-0.5, 0, -0.1],
      upperLegLeft: [0.3, 0, 0], upperLegRight: [-0.35, 0, 0],
      lowerLegLeft: [0.5, 0, 0], lowerLegRight: [0.7, 0, 0],
    }),
    frame(0.24, {
      upperArmLeft: [-0.5, 0, 0.1], upperArmRight: [-1.3, 0, -0.1],
      upperLegLeft: [-0.35, 0, 0], upperLegRight: [0.3, 0, 0],
      lowerLegLeft: [0.7, 0, 0], lowerLegRight: [0.5, 0, 0],
    }),
  ],
};

// Version 3, Phase 10 ("Real Assets, Honestly Introduced") — until now the
// Emote Wheel (`EmoteWheelSystem.js`, `docs/PLAYER.md`'s own "plays
// assets, decides nothing" section) was genuinely empty on a fresh
// Workshop: it lists every clip whose `category !== "movement"`, and
// none existed until a player built one by hand in the Animation
// Editor. These four are the same kind of thing `DefaultBlueprints.js`
// already is for the Builder Library — permanent, hand-authored content
// seeded once, in the exact shape a player-made clip already has, not a
// different code path the Emote Wheel has to special-case. Every pose
// below uses the same pre-negation authoring convention `applyPose()`'s
// own comment documents (X and Z are what get negated on the live rig;
// Y is applied as authored), following `CROUCH_CLIP`'s own confirmed
// sign for a forward torso lean, and `JUMP_CLIP`'s own confirmed sign
// for a mirrored outward arm spread, rather than guessing a new one.
const WAVE_CLIP = {
  id: "default-wave",
  name: "Wave",
  description: "A friendly raised-hand wave, three beats before lowering.",
  category: "emote",
  loop: false,
  speed: 1,
  frames: [
    frame(0.3, { upperArmRight: [1.5, 0, 0.5], lowerArmRight: [1.1, 0, 0], handRight: [0, 0.4, 0] }),
    frame(0.25, { upperArmRight: [1.5, 0, 0.5], lowerArmRight: [1.1, 0, 0], handRight: [0, -0.5, 0] }),
    frame(0.25, { upperArmRight: [1.5, 0, 0.5], lowerArmRight: [1.1, 0, 0], handRight: [0, 0.5, 0] }),
    frame(0.25, { upperArmRight: [1.5, 0, 0.5], lowerArmRight: [1.1, 0, 0], handRight: [0, -0.5, 0] }),
    frame(0.3, { upperArmRight: [0, 0, 0], lowerArmRight: [0, 0, 0], handRight: [0, 0, 0] }),
  ],
};

const CLAP_CLIP = {
  id: "default-clap",
  name: "Clap",
  description: "Three quick claps, hands meeting and parting in front of the chest.",
  category: "emote",
  loop: false,
  speed: 1,
  frames: [
    frame(0.12, { upperArmLeft: [1.0, 0, -0.5], upperArmRight: [1.0, 0, 0.5], lowerArmLeft: [1.3, 0, 0], lowerArmRight: [1.3, 0, 0] }),
    frame(0.12, { upperArmLeft: [1.0, 0, -0.35], upperArmRight: [1.0, 0, 0.35], lowerArmLeft: [1.2, 0, 0], lowerArmRight: [1.2, 0, 0] }),
    frame(0.12, { upperArmLeft: [1.0, 0, -0.5], upperArmRight: [1.0, 0, 0.5], lowerArmLeft: [1.3, 0, 0], lowerArmRight: [1.3, 0, 0] }),
    frame(0.12, { upperArmLeft: [1.0, 0, -0.35], upperArmRight: [1.0, 0, 0.35], lowerArmLeft: [1.2, 0, 0], lowerArmRight: [1.2, 0, 0] }),
    frame(0.12, { upperArmLeft: [1.0, 0, -0.5], upperArmRight: [1.0, 0, 0.5], lowerArmLeft: [1.3, 0, 0], lowerArmRight: [1.3, 0, 0] }),
    frame(0.3, { upperArmLeft: [0, 0, 0], upperArmRight: [0, 0, 0], lowerArmLeft: [0, 0, 0], lowerArmRight: [0, 0, 0] }),
  ],
};

const BOW_CLIP = {
  id: "default-bow",
  name: "Bow",
  description: "A courteous forward bow, held a moment before rising back up.",
  category: "emote",
  loop: false,
  speed: 1,
  frames: [
    frame(0.35, { torso: [-0.9, 0, 0], head: [-0.25, 0, 0] }),
    frame(0.5, { torso: [-0.9, 0, 0], head: [-0.25, 0, 0] }),
    frame(0.35, { torso: [0, 0, 0], head: [0, 0, 0] }),
  ],
};

const DANCE_CLIP = {
  id: "default-dance",
  name: "Dance",
  description: "A loose, bouncy side-to-side step — keeps going until movement or another gesture interrupts it.",
  category: "emote",
  loop: true,
  speed: 1,
  frames: [
    frame(0.3, {
      torso: [0, 0.2, 0.18], head: [0, 0.15, 0],
      upperArmLeft: [0.7, 0, -0.4], upperArmRight: [0.2, 0, 0.15],
      upperLegLeft: [-0.25, 0, 0], upperLegRight: [0.15, 0, 0],
    }),
    frame(0.25, {
      torso: [0, 0, 0], head: [0, 0, 0],
      upperArmLeft: [0.4, 0, 0], upperArmRight: [0.4, 0, 0],
      upperLegLeft: [0, 0, 0], upperLegRight: [0, 0, 0],
    }),
    frame(0.3, {
      torso: [0, -0.2, -0.18], head: [0, -0.15, 0],
      upperArmLeft: [0.2, 0, -0.15], upperArmRight: [0.7, 0, 0.4],
      upperLegLeft: [0.15, 0, 0], upperLegRight: [-0.25, 0, 0],
    }),
    frame(0.25, {
      torso: [0, 0, 0], head: [0, 0, 0],
      upperArmLeft: [0.4, 0, 0], upperArmRight: [0.4, 0, 0],
      upperLegLeft: [0, 0, 0], upperLegRight: [0, 0, 0],
    }),
  ],
};

export const DEFAULT_ANIMATION_CLIPS = [
  IDLE_CLIP,
  WALK_CLIP,
  RUN_CLIP,
  JUMP_CLIP,
  FALL_CLIP,
  LAND_CLIP,
  CROUCH_CLIP,
  LADDER_CLIMB_CLIP,
  WAVE_CLIP,
  CLAP_CLIP,
  BOW_CLIP,
  DANCE_CLIP,
];

/** Movement state (from CameraSystem) -> the default clip id played for
 *  it. `PlayerAnimationSystem` uses this only when nothing else (an
 *  emote, say) is currently overriding playback — see its own comment. */
export const MOVEMENT_STATE_TO_CLIP_ID = {
  idle: "default-idle",
  walk: "default-walk",
  run: "default-run",
  jump: "default-jump",
  fall: "default-fall",
  land: "default-land",
  crouch: "default-crouch",
  ladderClimb: "default-ladderClimb",
};
