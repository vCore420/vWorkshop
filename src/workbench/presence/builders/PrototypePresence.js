import { box, cylinder, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Prototype
 * ---------
 * `{ type: "prototype", variant: "circuit" | "mechanical" }`. A small
 * half-built assembly — the clearest single signal on the bench that
 * something is genuinely in progress, not just planned.
 */
export function buildPrototype(item) {
  const variant = item.variant ?? "mechanical";
  const g = group();

  if (variant === "circuit") {
    const board = box(0.14, 0.006, 0.1, Materials.matte("#234a2e"));
    board.position.set(0, 0.003, 0);
    g.add(board);
    for (const [x, z] of [[-0.04, -0.02], [0.02, 0.01], [0.05, -0.02]]) {
      const chip = box(0.02, 0.01, 0.015, Materials.matte("#1a1a1a"));
      chip.position.set(x, 0.011, z);
      g.add(chip);
    }
    for (let i = 0; i < 3; i++) {
      const wire = cylinder(0.003, 0.003, 0.06, Materials.matte(["#b8863b", "#3c5a53", "#8d8577"][i]));
      wire.rotation.z = Math.PI / 2;
      wire.rotation.y = i * 0.4;
      wire.position.set(-0.04 + i * 0.03, 0.02, 0.03);
      g.add(wire);
    }
    return { object3D: g, size: "medium" };
  }

  // mechanical: a half-assembled little block-and-rod construction
  const base = box(0.1, 0.02, 0.1, Materials.wood("#8d6a45"));
  base.position.set(0, 0.01, 0);
  g.add(base);
  const rod = cylinder(0.012, 0.012, 0.12, Materials.metal("#9a978f"));
  rod.position.set(0, 0.08, 0);
  g.add(rod);
  const armature = box(0.08, 0.015, 0.02, Materials.metal("#6f6c64"));
  armature.position.set(0, 0.14, 0);
  armature.rotation.y = 0.5;
  g.add(armature);
  return { object3D: g, size: "medium" };
}
