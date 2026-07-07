import { box, cylinder, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Paperwork
 * ---------
 * `{ type: "paperwork" }`. A modest stack of papers or index cards with a
 * pen resting on top — the unglamorous administrative side of a project
 * (notes to self, a parts list, a half-written plan).
 */
export function buildPaperwork(_item) {
  const g = group();

  const stack = box(0.16, 0.025, 0.2, Materials.paper());
  stack.position.set(0, 0.0125, 0);
  stack.rotation.y = -0.05;
  g.add(stack);
  const topSheet = box(0.155, 0.004, 0.195, Materials.sketchPaper());
  topSheet.position.set(0.005, 0.027, -0.003);
  topSheet.rotation.y = 0.08;
  g.add(topSheet);

  const pen = cylinder(0.006, 0.006, 0.14, Materials.matte("#2a231d"), 8);
  pen.rotation.z = Math.PI / 2.3;
  pen.rotation.y = 0.3;
  pen.position.set(0.04, 0.035, 0.02);
  g.add(pen);

  return { object3D: g, size: "medium" };
}
