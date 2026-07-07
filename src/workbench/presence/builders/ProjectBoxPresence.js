import { box, cylinder, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Project box
 * -----------
 * `{ type: "projectBox" }`. An open cardboard-ish box with a few small
 * parts inside — the "parts and pieces waiting to be used" signal.
 */
export function buildProjectBox(_item) {
  const g = group();

  const floor = box(0.16, 0.02, 0.12, Materials.matte("#a9764f"));
  floor.position.set(0, 0.01, 0);
  g.add(floor);
  for (const [x, z, rot] of [[-0.07, 0, 0], [0.07, 0, 0], [0, -0.05, Math.PI / 2], [0, 0.05, Math.PI / 2]]) {
    const wall = box(0.02, 0.04, 0.12, Materials.matte("#a9764f"));
    wall.position.set(x, 0.03, z);
    wall.rotation.y = rot;
    g.add(wall);
  }
  for (const [x, z, c] of [[-0.03, 0.02, "#3c5a53"], [0.02, -0.01, "#b8863b"], [0.04, 0.03, "#8d8577"]]) {
    const part = cylinder(0.012, 0.012, 0.02, Materials.matte(c), 8);
    part.position.set(x, 0.03, z);
    g.add(part);
  }

  return { object3D: g, size: "medium" };
}
