import { box, cylinder, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Measuring tools
 * ---------------
 * `{ type: "measuringTools" }`. A ruler and a small tape-measure roll —
 * no variants needed yet; this is deliberately one of the simpler
 * builders, a good template to copy for a new presence type.
 */
export function buildMeasuringTools(_item) {
  const g = group();

  const ruler = box(0.3, 0.008, 0.035, Materials.wood("#c9a96b"));
  ruler.rotation.y = 0.5;
  ruler.position.set(-0.02, 0.008, -0.02);
  g.add(ruler);

  const tapeBody = cylinder(0.035, 0.035, 0.03, Materials.metal("#c9772e"), 16);
  tapeBody.position.set(0.06, 0.02, 0.04);
  g.add(tapeBody);

  return { object3D: g, size: "small" };
}
