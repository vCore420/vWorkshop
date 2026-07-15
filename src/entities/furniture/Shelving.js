import { box, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * Shelving
 * --------
 * "Shelves become documentation and project archives." This phase gives it
 * a believable placeholder look (frame + a scattering of book/box shapes)
 * and an interaction that opens an archive overlay with an honest empty
 * state — there is nothing to archive yet, and the overlay says so rather
 * than pretending otherwise.
 */
export const ShelvingDefinition = {
  id: "shelving",
  label: "Shelving",
  footprint: { width: 1.2, depth: 0.4 },

  build() {
    const g = group();
    const width = 1.1, height = 2.1, depth = 0.35, shelfCount = 4;

    const frameMat = Materials.wood("#4a3120");
    const sideL = box(0.04, height, depth, frameMat);
    sideL.position.set(-width / 2, height / 2, 0);
    g.add(sideL);
    const sideR = box(0.04, height, depth, frameMat);
    sideR.position.set(width / 2, height / 2, 0);
    g.add(sideR);
    const back = box(width, height, 0.02, Materials.wood("#3d2a1c"));
    back.position.set(0, height / 2, -depth / 2 + 0.01);
    g.add(back);

    const shelfColors = ["#7a5c3e", "#6b4a34", "#8d6a45", "#5a3d29"];
    const itemColors = ["#b8863b", "#3c5a53", "#8d8577", "#6b9c8e", "#a9764f", "#2a231d"];
    let colorIndex = 0;

    for (let i = 0; i < shelfCount; i++) {
      const y = 0.15 + i * ((height - 0.3) / (shelfCount - 1));
      // Each board a subtly different wood tone rather than one uniform
      // Materials.wood() call — a shelf assembled over time from whatever
      // timber was on hand rarely matches board-for-board.
      const shelf = box(width, 0.03, depth, Materials.wood(shelfColors[i % shelfColors.length]));
      shelf.position.set(0, y, 0);
      g.add(shelf);

      // A handful of book/box placeholders per shelf — enough to read as
      // "documentation lives here", stopping well short of decorative clutter.
      const itemCount = 3 + (i % 2);
      let cursor = -width / 2 + 0.1;
      for (let j = 0; j < itemCount; j++) {
        const w = 0.06 + ((i + j) % 3) * 0.02;
        const h = 0.18 + ((i * 3 + j) % 3) * 0.03;
        const d = depth * 0.7;
        const item = box(w, h, d, Materials.matte(itemColors[colorIndex % itemColors.length]));
        colorIndex++;
        item.position.set(cursor + w / 2, y + 0.015 + h / 2, 0);
        item.rotation.y = (Math.random() - 0.5) * 0.05;
        g.add(item);
        cursor += w + 0.03;
      }
    }

    return g;
  },

  interaction: {
    prompt: "Browse the archive",
    radius: 2.4, // large furniture — see docs/WORLD.md's interaction-distance pass
    overlayId: "archive",
  },
};
