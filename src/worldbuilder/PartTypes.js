/**
 * PartTypes
 * -----------
 * The curated set of primitive shapes a Builder part can be — "a sensible
 * curated set", not every shape that was suggested. Each entry's `id` is
 * the string stored in saved definitions (`part.type`); `label` is only
 * ever what the Builder's UI shows, so a label can read better ("Cube")
 * without ever touching what's already saved in someone's library
 * (`"box"`, unchanged since this was the only box-shaped option).
 *
 * Grouped into categories purely for the Builder's own toolbar — nothing
 * about `ObjectCompiler.js` cares which category a type is in.
 *
 * A few shapes suggested alongside these were deliberately left out:
 * - **Capsule** — *this entry's original reasoning is no longer true, and
 *   is corrected here rather than quietly left standing (Version 4, Phase
 *   10a).* It used to read: "`THREE.CapsuleGeometry` doesn't exist in the
 *   Three.js version this project loads (added in a later release than
 *   this project targets)." It does exist, and has for the entire life of
 *   this file's current claim — `CapsuleGeometry` landed in r142, this
 *   project pins r164 (see `index.html`'s import map), and three separate
 *   files already use it today: `BodyCompiler.js` offers it as one of the
 *   four Being body-part shapes, and both `ModelLoader.js` and
 *   `BeingSpawnerSystem.js` build fallback meshes from it. The comment
 *   predates a Three.js upgrade and was never revisited.
 *
 *   Capsule is still absent from the Builder's own set, but for a real
 *   reason rather than a stale one: nothing has actually needed it here.
 *   A capsule-like silhouette can be built from a Cylinder + two Half
 *   Spheres, and — unlike a Being's own limbs, where a capsule is the
 *   natural single primitive — Builder parts are overwhelmingly
 *   architectural. Adding it is one entry in `PART_CATEGORIES` plus one
 *   `unitCapsuleGeometry()` in `ObjectCompiler.js` if a future phase
 *   wants it; it is genuinely available, simply not chosen.
 * - **Rounded Cylinder** — a cylinder is already a fully round shape;
 *   there's no additional edge left to round without it becoming a
 *   different shape (a Pipe/Tube, or a Rounded Cube) entirely.
 * - **Corner Piece** / **Bevel Piece** — both are, geometrically, exactly
 *   what Quarter Cylinder and Wedge already are, used at a smaller scale
 *   as trim. Adding separate types for the same shape would be more
 *   choices without more capability.
 */

export const PART_CATEGORIES = [
  {
    category: "Basic",
    types: [
      { id: "box", label: "Cube" },
      { id: "cylinder", label: "Cylinder" },
      { id: "sphere", label: "Sphere" },
      { id: "cone", label: "Cone" },
      { id: "plane", label: "Plane" },
    ],
  },
  {
    category: "Angled",
    types: [
      { id: "pyramid", label: "Pyramid" },
      { id: "wedge", label: "Wedge / Ramp" },
    ],
  },
  {
    category: "Rounded & Partial",
    types: [
      { id: "roundedBox", label: "Rounded Cube" },
      { id: "halfSphere", label: "Half Sphere" },
      { id: "quarterCylinder", label: "Quarter Cylinder" },
    ],
  },
  {
    category: "Rings & Tubes",
    types: [
      { id: "tube", label: "Pipe / Tube" },
      { id: "ring", label: "Ring" },
      { id: "arch", label: "Arch" },
    ],
  },
];

/** Every part type id, flattened — a convenience export with no external
 *  caller today (v2.2.3d review checked directly); kept because it's the
 *  natural "is this a valid part type?" companion to PART_CATEGORIES and
 *  costs one line, not because anything currently imports it. */
export const ALL_PART_TYPES = PART_CATEGORIES.flatMap((c) => c.types.map((t) => t.id));

/** Types whose geometry resolution depends on a segment count, and so show the "Segments" field in the part editor. */
export const SEGMENTED_PART_TYPES = new Set(["cylinder", "cone", "sphere", "pyramid", "tube", "ring", "arch", "halfSphere", "quarterCylinder"]);

export function partLabel(typeId) {
  for (const group of PART_CATEGORIES) {
    const match = group.types.find((t) => t.id === typeId);
    if (match) return match.label;
  }
  return typeId;
}
