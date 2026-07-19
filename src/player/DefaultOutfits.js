import { MATERIAL_PRESETS } from "./PlayerCharacter.js";
import { getBodyModel } from "./BodyModels.js";

/**
 * DefaultOutfits
 * ----------------
 * Version 3, Phase 10 ("Real Assets, Honestly Introduced") — the same
 * "give the player ideas on what is capable" reasoning
 * `DefaultBlueprints.js` already established for the Builder Library,
 * applied to the Wardrobe: six starter outfits so a fresh Workshop's
 * wardrobe rail isn't empty until a player builds their own from
 * scratch. Every entry is ordinary `OutfitStore` data — no new field,
 * no special-cased "default outfit" concept the Wardrobe has to know
 * about — built the same way "Save" already captures a real appearance:
 * a `{width,height,depth,color,material,textureId}` per body part,
 * where width/height/depth are *multipliers* on the body model's own
 * `baseDimensions` (`BodyModels.js`), 1 meaning "unmodified," not an
 * absolute size.
 *
 * **What "clothing" means on this rig, honestly**: there's no separate
 * garment layer or mesh — an outfit only ever recolours/resizes/
 * re-materials the same eight body-part boxes `PlayerCharacter.js`
 * already builds. A "rolled sleeve" here is a bare-skin-coloured
 * `lowerArm`; a "dress" is `torso` and `upperLeg` sharing one fabric
 * colour with bare `lowerLeg` beneath it — a colour-coordination
 * approximation of a dress silhouette, not an actual skirt shape, since
 * this rig has no geometry that could be one. `head`/`hand` in every
 * entry below reuse that outfit's own body model's stock skin tone
 * (`getBodyModel(id).defaultAppearance()`) rather than inventing a new
 * one — wearing an outfit changes clothing, not who's wearing it.
 *
 * **The Pride Jumpsuit** uses the trans pride flag's three colours
 * (#5BCEFA, #F5A9B8, #F5F5F5) as plain solid part colours — light blue,
 * pink, and white blocked across torso/arms/legs. Not literal stripes
 * (this rig has no texture-per-part, only one flat colour each), but a
 * deliberate, soft nod using exactly that palette, per the brief this
 * phase shipped under: real content, kept small, only where it
 * genuinely adds something.
 *
 * See `OutfitStore.js`'s own constructor for how these get seeded —
 * once, directly in the array, the same "a brand-new session never even
 * reaches `load()` at all" timing `DefaultBlueprints.js` already uses —
 * and that file's own comment for why its `load()` deliberately does
 * *not* reseed these the way `BlueprintStore.load()` reseeds blueprints.
 */

function skinOf(bodyModelId) {
  const skin = getBodyModel(bodyModelId).defaultAppearance().parts;
  return { head: skin.head.color, hand: skin.hand.color };
}

function part(color, material, width = 1, height = 1, depth = 1) {
  if (!MATERIAL_PRESETS[material]) throw new Error(`Unknown material preset: ${material}`);
  return { width, height, depth, color, material, textureId: null };
}

function outfit(id, name, bodyModelId, garment) {
  const skin = skinOf(bodyModelId);
  return {
    id,
    name,
    bodyModelId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    appearance: {
      parts: {
        head: part(skin.head, "matte"),
        hand: part(skin.hand, "matte"),
        ...garment,
      },
    },
  };
}

export const DEFAULT_OUTFITS = [
  outfit("default-outfit-overalls", "Work Overalls", "masculine", {
    torso: part("#8a6b3f", "fabric", 1.15, 1, 1.1),
    upperArm: part("#8a6b3f", "fabric", 1.1, 1, 1.1),
    lowerArm: part("#d9a878", "matte"), // sleeves rolled up, bare forearm
    upperLeg: part("#6b5533", "fabric", 1.15, 1, 1.15),
    lowerLeg: part("#6b5533", "fabric", 1.1, 1, 1.1),
    foot: part("#2c2419", "matte", 1.05, 1, 1.1),
  }),

  outfit("default-outfit-pinstripe-vest", "Pinstripe Vest", "masculine", {
    torso: part("#2e2e33", "fabric", 1.1, 1, 1.05),
    upperArm: part("#e8e2d6", "fabric"),
    lowerArm: part("#e8e2d6", "fabric"),
    upperLeg: part("#2e2e33", "fabric", 1.05, 1, 1.05),
    lowerLeg: part("#2e2e33", "fabric", 1.05, 1, 1.05),
    foot: part("#1c1712", "glossy", 1, 1, 1.05),
  }),

  outfit("default-outfit-rose-blouse", "Rose Blouse", "feminine", {
    torso: part("#d98a9c", "fabric", 1.05, 1, 1),
    upperArm: part("#d98a9c", "fabric"),
    lowerArm: part("#e0ab84", "matte"), // 3/4 sleeve, bare forearm
    upperLeg: part("#3c3038", "fabric", 1.05, 1, 1.05),
    lowerLeg: part("#3c3038", "fabric", 1.05, 1, 1.05),
    foot: part("#2c2419", "matte", 1, 1, 1.05),
  }),

  outfit("default-outfit-sundress", "Sundress", "feminine", {
    torso: part("#e8935f", "fabric", 1.05, 1, 1),
    upperArm: part("#e8935f", "fabric"),
    lowerArm: part("#e0ab84", "matte"),
    upperLeg: part("#e8935f", "fabric", 1.1, 1, 1.1), // dress hem, colour-matched to torso rather than true skirt geometry — see this file's own header
    lowerLeg: part("#e0ab84", "matte"), // bare legs below the hem
    foot: part("#f2ede4", "matte"),
  }),

  outfit("default-outfit-pride-jumpsuit", "Pride Jumpsuit", "masculine", {
    torso: part("#f5f5f5", "fabric", 1.1, 1, 1.05),
    upperArm: part("#5bcefa", "fabric", 1.05, 1, 1.05),
    lowerArm: part("#f5a9b8", "fabric"),
    upperLeg: part("#f5a9b8", "fabric", 1.05, 1, 1.05),
    lowerLeg: part("#5bcefa", "fabric"),
    foot: part("#2c2419", "matte"),
  }),

  outfit("default-outfit-field-jacket", "Field Jacket", "feminine", {
    torso: part("#5c6b52", "fabric", 1.1, 1, 1.05),
    upperArm: part("#5c6b52", "fabric", 1.05, 1, 1.05),
    lowerArm: part("#5c6b52", "fabric"),
    upperLeg: part("#4a4a45", "fabric", 1.05, 1, 1.05),
    lowerLeg: part("#4a4a45", "fabric"),
    foot: part("#2c2419", "matte", 1, 1, 1.05),
  }),
];
