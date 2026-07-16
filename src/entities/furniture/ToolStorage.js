import { box, cylinder, group, Materials, brassTag } from "../../utils/PlaceholderFactory.js";

/**
 * ToolStorage
 * -----------
 * A pegboard + cabinet. This phase does not implement an inventory system —
 * it exists here as an honest placeholder: interacting with it says exactly
 * that, rather than silently doing nothing or faking a feature that isn't
 * built yet. The brass tag on the cabinet is a small recurring visual cue
 * for "this object is reserved for something specific, later".
 *
 * **Furniture & Storage phase (Version 2, Phase 18) — "storage should
 * communicate organisation... clear accessibility."** A real pegboard's
 * whole reason for existing is that you can tell at a glance whether
 * something's missing — a painted or foam-cut silhouette behind each
 * tool's actual resting spot, so an empty hook still reads as "the
 * wrench is out" rather than just an empty hook. Each tool now hangs in
 * front of its own shadow — the single addition that makes this read as
 * an organised tool wall rather than three tools that happen to be
 * mounted on a board. See `docs/FURNITURE.md` for the full account.
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

    // Furniture & Storage phase — shadow silhouettes, painted directly
    // onto the board's own front face (z=0.016, just proud of it — the
    // board's own front face sits at z=0.015), one per tool, each roughly
    // bounding the real shape hanging in front of it. Deliberately a flat
    // painted patch rather than real cut foam geometry — the same
    // "believable, not photoreal" standard every placeholder in this
    // project already holds itself to.
    const shadowMat = Materials.matte("#5a4530");
    const hammerShadow = box(0.08, 0.32, 0.015, shadowMat, { castShadow: false });
    hammerShadow.position.set(-0.25, 1.63, 0.016);
    g.add(hammerShadow);
    const wrenchShadow = box(0.06, 0.24, 0.015, shadowMat, { castShadow: false });
    wrenchShadow.position.set(0.05, 1.65, 0.016);
    g.add(wrenchShadow);
    const screwdriverShadow = box(0.05, 0.26, 0.015, shadowMat, { castShadow: false });
    screwdriverShadow.position.set(0.28, 1.65, 0.016);
    g.add(screwdriverShadow);

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

    const screwdriver = cylinder(0.012, 0.012, 0.22, Materials.plastic("#b8863b"));
    screwdriver.position.set(0.28, 1.65, 0.03);
    g.add(screwdriver);

    // Cabinet beneath the pegboard
    const cabinet = box(0.7, 0.85, 0.4, Materials.metal("#5f6259"));
    cabinet.position.set(0, 0.43, 0);
    g.add(cabinet);
    const drawerGap = 0.02;
    // Furniture & Storage phase — "environmental storytelling... frequently
    // opened drawers." The middle drawer sits pulled open by a few
    // centimetres, as if just used — the same restrained, single-detail
    // standard the Workbench's own pencil and the Desk's own pen holder
    // already set, rather than every drawer standing open at once.
    const ajarDrawerIndex = 1;
    const ajarDepth = 0.04;
    for (let i = 0; i < 3; i++) {
      const isAjar = i === ajarDrawerIndex;
      const drawerZ = 0.2 + (isAjar ? ajarDepth : 0);
      const drawer = box(0.62, 0.24 - drawerGap, 0.02, Materials.metal("#4d5049"));
      drawer.position.set(0, 0.15 + i * 0.27, drawerZ);
      g.add(drawer);
      const handle = box(0.14, 0.02, 0.02, Materials.brass());
      handle.position.set(0, 0.15 + i * 0.27, drawerZ + 0.02);
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
    // Sound & Presence phase — resolves the "Considered and deliberately
    // left out" drawer sound from Phase 18 (see docs/FURNITURE.md), now
    // that FurnitureSystem's own generic soundOnInteract exists.
    soundOnInteract: "drawerSlide",
  },
};
