import { box, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Sketch
 * ------
 * `{ type: "sketch" }`. A single loose sheet, slightly askew — an idea
 * caught mid-thought rather than a finished document (that's more what
 * `paperwork` or an unfolded `blueprint` suggest).
 */
export function buildSketch(_item) {
  const g = group();
  const sheet = box(0.22, 0.004, 0.28, Materials.sketchPaper());
  sheet.rotation.y = 0.35;
  sheet.position.set(0, 0.004, 0);
  g.add(sheet);
  return { object3D: g, size: "medium" };
}
