import { box, group, Materials, brassTag, cylinder, sphere } from "../../utils/PlaceholderFactory.js";

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
    const width = 1.1, depth = 0.35, shelfCount = 4;
    // Version 3, Phase 3 ("The Reading Chair") — the frame's overall
    // height used to be a fixed constant that shelf spacing was derived
    // from, which happened to size it to just clear the top shelf's own
    // boards with the cap sitting directly above — not to preserve the
    // same headroom every other shelf gets. That left the top shelf with
    // only ~0.135m of clearance to the cap versus ~0.57m everywhere else,
    // and even the shortest book placeholder (0.18m) already overshot it.
    // Spacing (`shelfSpacing`) is now the fixed, independent quantity —
    // unchanged at 0.6, exactly as every shelf already used — and `height`
    // is derived from it instead, sized so the top shelf gets that same
    // ~0.57m (`shelfSpacing - boardThickness`) clearance to the cap's own
    // underside that every other shelf already gets to the board above it.
    // See docs/FURNITURE.md for the full account and the worked numbers.
    const shelfSpacing = 0.6;
    const boardThickness = 0.03;
    const bottomShelfY = 0.15;
    const topShelfY = bottomShelfY + (shelfCount - 1) * shelfSpacing;
    const height = topShelfY + boardThickness / 2 + (shelfSpacing - boardThickness);

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
      const y = bottomShelfY + i * shelfSpacing;
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
      //
      // Living Spaces phase — "bookshelf proportions." The gap between
      // items used to be a fixed 0.03m regardless of the shelf's own
      // width, so the whole cluster only ever spanned the first
      // ~0.3-0.4m from the left edge on every shelf, leaving well over
      // half of each one visibly bare. Spreading the same items across
      // the shelf's own usable width (mirroring the original 0.1m left
      // inset on the right too) keeps the restrained item count exactly
      // as it was — this was a placement bug, not a "too few items" one.
      const itemCount = 3 + (i % 2);
      const itemWidths = [];
      for (let j = 0; j < itemCount; j++) itemWidths.push(0.06 + ((i + j) % 3) * 0.02);
      const usableWidth = width - 0.2;
      const totalItemWidth = itemWidths.reduce((sum, w) => sum + w, 0);
      // Phase 3 planning — the fix above correctly filled each shelf's own
      // usable width, but with one perfectly even, mechanically-computed
      // gap between every item, which reads as assembled-by-formula rather
      // than shelved by hand over time. Squared-random weights per gap
      // (skewing toward small gaps, with the occasional much larger one)
      // redistribute the exact same leftover space instead of splitting it
      // evenly, so items bunch into a few natural-looking clusters rather
      // than a comb — same item count, same overall width coverage.
      const leftoverWidth = usableWidth - totalItemWidth;
      const gapWeights = [];
      for (let j = 0; j < itemCount - 1; j++) gapWeights.push(Math.random() ** 2 + 0.0001);
      const weightTotal = gapWeights.reduce((sum, w) => sum + w, 0);
      const gaps = gapWeights.map((w) => (w / weightTotal) * leftoverWidth);
      let cursor = -width / 2 + 0.1;
      for (let j = 0; j < itemCount; j++) {
        const w = itemWidths[j];
        const h = 0.18 + ((i * 3 + j) % 3) * 0.03;
        const d = depth * 0.7;
        const item = box(w, h, d, Materials.matte(itemColors[colorIndex % itemColors.length]));
        colorIndex++;
        item.position.set(cursor + w / 2, y + 0.015 + h / 2, 0);
        item.rotation.y = (Math.random() - 0.5) * 0.05;
        g.add(item);
        cursor += w + (gaps[j] ?? 0);
      }
    }

    // Version 3, Phase 11 ("Workshop Character") — "one of our small pot
    // plants on the book shelf somewhere where it doesn't interfere with
    // the books." The book cluster on every non-bin shelf always spans
    // exactly `usableWidth` (±0.45, deterministic regardless of the
    // randomised gap distribution above — see that loop's own final
    // `cursor`), and the frame posts' own inner face sits at ±0.53 —
    // leaving a genuinely fixed, empty 0.08m corridor on each end of every
    // book shelf, never touched by books or bins. Smaller than
    // MusicCabinet.js's own cabinet-top plant (the reference this reuses
    // the pot+radial-leaves shape from) specifically to fit that corridor
    // with real clearance on both sides. Top shelf, right end — visible,
    // catching whatever light the window gives it, and nowhere near the
    // bin shelf's own already-tight edges.
    const plantShelfY = topShelfY;
    const plantX = 0.48; // centre-ish of the 0.45–0.53 corridor, biased slightly off the frame's own inner face
    const potMat = Materials.ceramic("#8d6a45");
    const pot = cylinder(0.026, 0.022, 0.045, potMat, 12);
    pot.position.set(plantX, plantShelfY + 0.015 + 0.0225, 0);
    g.add(pot);
    for (let i = 0; i < 5; i++) {
      const leaf = sphere(Materials.fabric("#4a6b4a"), 8, 6);
      const angle = (i / 5) * Math.PI * 2;
      leaf.scale.set(0.028, 0.07, 0.028);
      leaf.position.set(plantX + Math.cos(angle) * 0.008, plantShelfY + 0.015 + 0.065, Math.sin(angle) * 0.008);
      leaf.rotation.z = Math.cos(angle) * 0.3;
      leaf.rotation.x = Math.sin(angle) * 0.3;
      g.add(leaf);
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
