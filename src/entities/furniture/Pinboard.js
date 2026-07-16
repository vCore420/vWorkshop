import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * Pinboard
 * --------
 * "Walking to the pinboard opens project planning." A wall-mounted corkboard
 * showing every project in ProjectsStore regardless of status — the full
 * backlog, as opposed to the workbench's narrower "active work" view.
 *
 * Furniture & Storage phase — the cork itself is genuinely
 * `Materials.cork()` now (see `docs/FURNITURE.md`), not a flat matte
 * tint standing in for it, and each note is actually held up by a small
 * push pin rather than floating against the board on its own.
 */
export const PinboardDefinition = {
  id: "pinboard",
  label: "Pinboard",
  footprint: { width: 1.1, depth: 0.15 },

  build() {
    const g = group();
    const frame = box(1.0, 0.7, 0.04, Materials.wood("#5a3d29"));
    g.add(frame);
    const cork = box(0.92, 0.62, 0.02, Materials.cork(), { castShadow: false });
    cork.position.set(0, 0, 0.025);
    g.add(cork);

    // A couple of pinned note placeholders, just enough to suggest use,
    // each with a small push pin actually holding it to the board.
    const pinColors = ["#c53d3d", "#2f5fa8", "#4a8f4a"];
    let pinIndex = 0;
    for (const [x, y, c] of [[-0.28, 0.15, "#fef6d8"], [0.1, -0.08, "#eaf0da"], [0.3, 0.18, "#fef6d8"]]) {
      const note = box(0.16, 0.12, 0.005, Materials.matte(c));
      note.position.set(x, y, 0.04);
      note.rotation.z = (Math.random() - 0.5) * 0.15;
      g.add(note);

      const pin = cylinder(0.006, 0.006, 0.012, Materials.plastic(pinColors[pinIndex % pinColors.length]), 8);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(x, y + 0.045, 0.045);
      g.add(pin);
      pinIndex++;
    }

    return g;
  },

  interaction: {
    prompt: "Look at the pinboard",
    radius: 2.0, // small/wall-mounted — see docs/WORLD.md's interaction-distance pass
    overlayId: "pinboard",
  },
};
