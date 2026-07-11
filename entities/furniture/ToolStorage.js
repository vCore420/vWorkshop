import { box, cylinder, group, Materials, brassTag } from "../../utils/PlaceholderFactory.js";

/**
 * ToolStorage
 * -----------
 * A pegboard + cabinet. This phase does not implement an inventory system —
 * it exists here as an honest placeholder: interacting with it says exactly
 * that, rather than silently doing nothing or faking a feature that isn't
 * built yet. The brass tag on the cabinet is a small recurring visual cue
 * for "this object is reserved for something specific, later".
 */
export const ToolStorageDefinition = {
  id: "toolStorage",
  label: "Tool storage",
  footprint: { width: 0.9, depth: 0.4 },

  build() {
    const g = group();

    const board = box(0.85, 1.1, 0.03, Materials.wood("#7a5c3e"));
    board.position.set(0, 1.5, 0);
    g.add(board);

    // A few peg-hung tool silhouettes (simple primitives standing in for
    // hammer/wrench/screwdriver shapes).
    const toolMat = Materials.metal("#7d7a72");
    const hammerHead = box(0.02, 0.05, 0.14, toolMat);
    hammerHead.rotation.z = Math.PI / 2;
    hammerHead.position.set(-0.25, 1.75, 0.03);
    g.add(hammerHead);
    const hammerHandle = cylinder(0.012, 0.012, 0.22, Materials.wood("#a9764f"));
    hammerHandle.position.set(-0.25, 1.6, 0.03);
    g.add(hammerHandle);

    const wrench = box(0.03, 0.2, 0.015, toolMat);
    wrench.position.set(0.05, 1.65, 0.03);
    g.add(wrench);

    const screwdriver = cylinder(0.012, 0.012, 0.22, Materials.matte("#b8863b"));
    screwdriver.position.set(0.28, 1.65, 0.03);
    g.add(screwdriver);

    // Cabinet beneath the pegboard
    const cabinet = box(0.7, 0.85, 0.4, Materials.metal("#5f6259"));
    cabinet.position.set(0, 0.43, 0);
    g.add(cabinet);
    const drawerGap = 0.02;
    for (let i = 0; i < 3; i++) {
      const drawer = box(0.62, 0.24 - drawerGap, 0.02, Materials.metal("#4d5049"));
      drawer.position.set(0, 0.15 + i * 0.27, 0.2);
      g.add(drawer);
      const handle = box(0.14, 0.02, 0.02, Materials.brass());
      handle.position.set(0, 0.15 + i * 0.27, 0.22);
      g.add(handle);
    }

    const tag = brassTag(0.18, 0.05);
    tag.position.set(0.28, 0.86, 0.21);
    g.add(tag);

    return g;
  },

  interaction: {
    prompt: "Check tool storage",
    radius: 2.2, // medium furniture — see docs/WORLD.md's interaction-distance pass
    overlayId: "toolStorage",
  },
};
