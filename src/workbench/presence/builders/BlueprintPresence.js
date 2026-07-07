import { box, cylinder, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Blueprint
 * ---------
 * `{ type: "blueprint", variant: "unfolded" | "rolled" }`. Unfolded claims
 * a large slot (it's the biggest flat thing that can go on a bench);
 * rolled claims a small one, leaning to one side.
 */
export function buildBlueprint(item) {
  const variant = item.variant ?? "unfolded";
  const g = group();

  if (variant === "rolled") {
    const roll = cylinder(0.035, 0.035, 0.42, Materials.paper("#e4d7b8"), 14);
    roll.rotation.z = Math.PI / 2;
    roll.rotation.y = 0.3;
    roll.position.set(0, 0.035, 0);
    g.add(roll);
    const band = box(0.045, 0.005, 0.075, Materials.matte("#7a4a3a"));
    band.rotation.y = 0.3;
    band.position.set(0.05, 0.07, 0.02);
    g.add(band);
    return { object3D: g, size: "small" };
  }

  const sheet = box(0.46, 0.006, 0.32, Materials.blueprint());
  sheet.position.set(0, 0.006, 0);
  g.add(sheet);
  // Small weights holding the corners flat.
  for (const [x, z] of [[-0.2, -0.13], [0.2, 0.13]]) {
    const weight = box(0.03, 0.02, 0.03, Materials.matte("#2a231d"));
    weight.position.set(x, 0.015, z);
    g.add(weight);
  }
  return { object3D: g, size: "large" };
}
