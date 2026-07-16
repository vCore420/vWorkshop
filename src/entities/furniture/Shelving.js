import { box, group, Materials, brassTag } from "../../utils/PlaceholderFactory.js";

/**
 * Shelving
 * --------
 * "Shelves become documentation and project archives." This phase gives it
 * a believable placeholder look (frame + a scattering of book/box shapes)
 * and an interaction that opens an archive overlay with an honest empty
 * state — there is nothing to archive yet, and the overlay says so rather
 * than pretending otherwise.
 *
 * **Furniture & Storage phase (Version 2, Phase 18) — "storage should
 * communicate organisation."** Two of the four shelves stayed a scatter
 * of book-shaped placeholders — genuinely fine for what they are, but a
 * real archive shelf almost always has *some* uniform storage on it too,
 * not just books. One shelf (the one at the easiest reach height, not
 * the top or bottom) now holds a run of matching labelled storage bins
 * instead — "logical grouping" made literal, one object type standing in
 * for "finished project archives get boxed up, not just shelved loose."
 * See `docs/FURNITURE.md` for the full account of this phase's reasoning,
 * including why this shelf specifically.
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

    // Furniture & Storage phase — "corners... nothing should feel left
    // behind." A plain overhanging cap, the same universal "this was
    // actually built, not just stacked boards" cue the Interior phase's
    // baseboards already established for the room itself, applied to the
    // one piece of fixed furniture still missing it.
    const cap = box(width + 0.06, 0.03, depth + 0.04, Materials.wood("#3d2a1c"));
    cap.position.set(0, height + 0.015, 0);
    g.add(cap);

    const shelfColors = ["#7a5c3e", "#6b4a34", "#8d6a45", "#5a3d29"];
    const itemColors = ["#b8863b", "#3c5a53", "#8d8577", "#6b9c8e", "#a9764f", "#2a231d"];
    const binColors = ["#3c5a53", "#6b9c8e", "#8d8577"];
    let colorIndex = 0;
    // Second shelf from the bottom — an easy, comfortable reach, the
    // shelf someone would actually use for something they expect to pull
    // down again, not the top shelf (a stretch) or the bottom (a crouch).
    const binShelfIndex = 1;

    for (let i = 0; i < shelfCount; i++) {
      const y = 0.15 + i * ((height - 0.3) / (shelfCount - 1));
      // Each board a subtly different wood tone rather than one uniform
      // Materials.wood() call — a shelf assembled over time from whatever
      // timber was on hand rarely matches board-for-board.
      const shelf = box(width, 0.03, depth, Materials.wood(shelfColors[i % shelfColors.length]));
      shelf.position.set(0, y, 0);
      g.add(shelf);

      if (i === binShelfIndex) {
        // A run of matching storage bins — genuinely plastic (a real
        // archive box almost always is), each carrying the same small
        // brass tag ToolStorage.js already uses for "reserved for
        // something specific" — here standing in for a real label,
        // since there's nothing yet to actually print one from.
        const binWidth = 0.24, binHeight = 0.2, binDepth = depth * 0.75;
        const binCount = 4;
        const totalWidth = binCount * binWidth + (binCount - 1) * 0.02;
        let binCursor = -totalWidth / 2;
        for (let b = 0; b < binCount; b++) {
          const bin = box(binWidth, binHeight, binDepth, Materials.plastic(binColors[b % binColors.length]));
          bin.position.set(binCursor + binWidth / 2, y + 0.015 + binHeight / 2, 0);
          g.add(bin);
          const tag = brassTag(0.09, 0.03);
          tag.position.set(binCursor + binWidth / 2, y + 0.015 + binHeight - 0.05, binDepth / 2 + 0.001);
          g.add(tag);
          binCursor += binWidth + 0.02;
        }
        continue;
      }

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
    // Sound & Presence phase — "object audio... material consistency."
    // Browsing a shelf of books and boxes is the same physical gesture
    // the Workbench's own clipboard sound already represents; reused
    // rather than a second, near-identical sound design.
    soundOnInteract: "paperShuffle",
  },
};
