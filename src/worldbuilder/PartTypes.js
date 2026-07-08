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
 * - **Capsule** — `THREE.CapsuleGeometry` doesn't exist in the Three.js
 *   version this project loads (added in a later release than this
 *   project targets); approximating one well needs a compound shape
 *   (a cylinder plus two hemisphere caps), which breaks the "one part is
 *   one mesh" assumption everything else here relies on. A capsule-like
 *   silhouette can still be built from a Cylinder + two Half Spheres.
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
