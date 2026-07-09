/**
 * BodyModels
 * ------------
 * "Expand the existing player identity system to support multiple
 * procedural base body models... preserve the procedural player
 * architecture so additional body models can easily be added in future."
 *
 * Every body model shares the exact same `PART_IDS`/joint hierarchy
 * (`PlayerCharacter.js`'s own structural concern, unchanged) — that's not
 * a limitation, it's what makes "the same animation library should work
 * across every supported body model" true by construction. A clip stores
 * rotations keyed by pivot name; a pivot of that name exists on every
 * body model, always, so nothing about playback needs to know or care
 * which model is currently active. What actually varies between models is
 * data, not structure: their own base dimensions (proportions before a
 * part's own width/height/depth multipliers apply) and their own default
 * appearance. Adding a third model later is one more entry here, nothing
 * else.
 *
 * A body model's own `baseDimensions` completely replaces
 * `PlayerCharacter.js`'s old single hardcoded set — there's no merging or
 * fallback between models, since each one is a complete, self-contained
 * starting proportion set a player then customises independently (see
 * `PlayerAppearanceStore.js`'s `appearanceByModel`).
 */

export const DEFAULT_BODY_MODEL = "masculine";

export const BODY_MODELS = {
  masculine: {
    id: "masculine",
    label: "Masculine",
    baseDimensions: {
      torso: { width: 0.52, height: 0.72, depth: 0.32 },
      head: { width: 0.34, height: 0.34, depth: 0.34 },
      upperArm: { width: 0.16, height: 0.35, depth: 0.16 },
      lowerArm: { width: 0.14, height: 0.3, depth: 0.14 },
      hand: { width: 0.14, height: 0.16, depth: 0.07 },
      upperLeg: { width: 0.2, height: 0.4, depth: 0.2 },
      lowerLeg: { width: 0.17, height: 0.38, depth: 0.17 },
      foot: { width: 0.18, height: 0.09, depth: 0.26 },
    },
    defaultAppearance() {
      return {
        parts: {
          head: makePart("#d9a878"),
          torso: makePart("#3c5a53"),
          upperArm: makePart("#3c5a53"),
          lowerArm: makePart("#d9a878"),
          hand: makePart("#d9a878"),
          upperLeg: makePart("#4a4038"),
          lowerLeg: makePart("#4a4038"),
          foot: makePart("#2c2419"),
        },
      };
    },
  },
  feminine: {
    id: "feminine",
    label: "Feminine",
    baseDimensions: {
      // Narrower shoulders/torso, proportionally fuller hips, slightly
      // smaller hands — a different starting silhouette, not a different
      // rig. Every one of these is still just a width/height/depth on the
      // exact same part, adjustable afterward exactly like the
      // masculine model's own.
      torso: { width: 0.44, height: 0.68, depth: 0.28 },
      head: { width: 0.32, height: 0.32, depth: 0.32 },
      upperArm: { width: 0.13, height: 0.32, depth: 0.13 },
      lowerArm: { width: 0.115, height: 0.28, depth: 0.115 },
      hand: { width: 0.115, height: 0.14, depth: 0.06 },
      upperLeg: { width: 0.21, height: 0.4, depth: 0.21 },
      lowerLeg: { width: 0.15, height: 0.38, depth: 0.15 },
      foot: { width: 0.16, height: 0.085, depth: 0.24 },
    },
    defaultAppearance() {
      return {
        parts: {
          head: makePart("#e0ab84"),
          torso: makePart("#5a3f52"),
          upperArm: makePart("#5a3f52"),
          lowerArm: makePart("#e0ab84"),
          hand: makePart("#e0ab84"),
          upperLeg: makePart("#463a4a"),
          lowerLeg: makePart("#463a4a"),
          foot: makePart("#2c2419"),
        },
      };
    },
  },
};

function makePart(color) {
  return { width: 1, height: 1, depth: 1, color, material: "matte", textureId: null };
}

export function getBodyModel(id) {
  return BODY_MODELS[id] ?? BODY_MODELS[DEFAULT_BODY_MODEL];
}

export function getBodyModelList() {
  return Object.values(BODY_MODELS);
}
