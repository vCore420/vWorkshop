import { box, cylinder, sphere, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * MusicCabinet
 * ------------
 * The old stereo was a stand-in — two speaker shapes and a dial, built to
 * prove the interaction pipeline worked, never meant to be the final
 * object. This is what it becomes: a low wooden cabinet with a turntable
 * and amplifier on top, records stored in the open shelf below, a pair of
 * bookshelf speakers on simple stands either side, and a few small signs
 * of actual use (a plant, a loose stack of records leaning against the
 * cabinet) — something built and lived with, not a showroom piece.
 *
 * Interaction is unchanged from the stereo it replaces: `overlayId:
 * "music"` opens the exact same real library — see docs/MUSIC.md. This
 * file only ever describes what the object looks like and where you stand
 * to use it; it doesn't know or care what's actually playing. A future
 * Builder object with a `musicPlayer` behaviour opens the identical
 * overlay the identical way, so there's deliberately nothing here for the
 * music system itself to reach back into (no spinning-platter-while-
 * playing animation, for instance — that would mean this furniture and
 * MusicSystem knowing about each other, which the architecture is built
 * specifically to avoid).
 */
export const MusicCabinetDefinition = {
  id: "musicCabinet",
  label: "Music cabinet",
  // Wide enough to include the flanking speakers in the walk-collision
  // footprint, not just the cabinet body itself.
  footprint: { width: 1.3, depth: 0.55 },

  build() {
    const g = group();
    const cabinetWidth = 0.85;
    const cabinetDepth = 0.4;
    const legHeight = 0.08;
    const bottomY = legHeight;
    const shelfY = legHeight + 0.24;
    const topY = legHeight + 0.44;
    const woodMain = Materials.wood("#4a3120");
    const woodTrim = Materials.wood("#6b4a34");

    // --- Cabinet carcass: legs, bottom, mid-shelf, top, back, sides ---
    for (const [x, z] of [
      [-cabinetWidth / 2 + 0.03, -cabinetDepth / 2 + 0.03],
      [cabinetWidth / 2 - 0.03, -cabinetDepth / 2 + 0.03],
      [-cabinetWidth / 2 + 0.03, cabinetDepth / 2 - 0.03],
      [cabinetWidth / 2 - 0.03, cabinetDepth / 2 - 0.03],
    ]) {
      const leg = box(0.035, legHeight, 0.035, Materials.wood("#3d2a1c"));
      leg.position.set(x, legHeight / 2, z);
      g.add(leg);
    }
    const bottom = box(cabinetWidth, 0.025, cabinetDepth, woodMain);
    bottom.position.set(0, bottomY, 0);
    g.add(bottom);
    const midShelf = box(cabinetWidth, 0.025, cabinetDepth, woodMain);
    midShelf.position.set(0, shelfY, 0);
    g.add(midShelf);
    const top = box(cabinetWidth, 0.03, cabinetDepth, woodTrim);
    top.position.set(0, topY, 0);
    g.add(top);
    const back = box(cabinetWidth, topY - bottomY, 0.02, Materials.wood("#3d2a1c"));
    back.position.set(0, (topY + bottomY) / 2, -cabinetDepth / 2 + 0.01);
    g.add(back);
    const sideL = box(0.025, topY - bottomY, cabinetDepth, woodMain);
    sideL.position.set(-cabinetWidth / 2, (topY + bottomY) / 2, 0);
    g.add(sideL);
    const sideR = sideL.clone();
    sideR.position.x = cabinetWidth / 2;
    g.add(sideR);
    // The upper compartment (between the mid-shelf and the top) is left
    // visually open too, rather than boxed in behind doors — simpler
    // geometry, and it reads as "everything within reach", which suits a
    // listening corner better than a cabinet with things hidden away.

    // --- Vinyl storage: records standing on edge in the lower compartment ---
    const recordColors = ["#2a231d", "#3c5a53", "#6b4a34", "#232323", "#4a3120"];
    let cursor = -cabinetWidth / 2 + 0.08;
    let colorIndex = 0;
    while (cursor < cabinetWidth / 2 - 0.08) {
      const record = box(0.014, 0.18, cabinetDepth - 0.08, Materials.matte(recordColors[colorIndex % recordColors.length]));
      record.position.set(cursor, shelfY - (shelfY - bottomY) / 2 + 0.02, 0);
      record.rotation.y = (Math.random() - 0.5) * 0.08;
      g.add(record);
      colorIndex++;
      cursor += 0.024;
    }

    // --- Turntable, offset to one side of the cabinet top ---
    const turntableX = -0.19;
    const plinth = box(0.34, 0.035, 0.27, Materials.wood("#2c2015"));
    plinth.position.set(turntableX, topY + 0.0175, 0.01);
    g.add(plinth);
    const platter = cylinder(0.105, 0.105, 0.012, Materials.matte("#1c1a17"), 28);
    platter.position.set(turntableX, topY + 0.035 + 0.006, 0.01);
    g.add(platter);
    const record = cylinder(0.1, 0.1, 0.003, Materials.matte("#232323"), 28);
    record.position.set(turntableX, topY + 0.041 + 0.0015 + 0.006, 0.01);
    g.add(record);
    const recordLabel = cylinder(0.028, 0.028, 0.004, Materials.matte("#8d6a45"), 20);
    recordLabel.position.set(turntableX, topY + 0.041 + 0.0015 + 0.006 + 0.0005, 0.01);
    g.add(recordLabel);
    const tonearmBase = cylinder(0.018, 0.018, 0.03, Materials.metal("#8a8580"), 16);
    tonearmBase.position.set(turntableX + 0.13, topY + 0.05, -0.09);
    g.add(tonearmBase);
    const tonearm = box(0.16, 0.008, 0.008, Materials.metal("#8a8580"));
    tonearm.position.set(turntableX + 0.07, topY + 0.06, -0.03);
    tonearm.rotation.y = 0.9;
    g.add(tonearm);

    // --- Amplifier, beside the turntable ---
    const ampX = 0.2;
    const amp = box(0.24, 0.09, 0.2, Materials.wood("#3d2a1c"));
    amp.position.set(ampX, topY + 0.045, 0);
    g.add(amp);
    const ampFace = box(0.22, 0.03, 0.01, Materials.matte("#1c1a17"));
    ampFace.position.set(ampX, topY + 0.06, 0.1);
    g.add(ampFace);
    for (const kx of [-0.07, 0, 0.07]) {
      const knob = cylinder(0.014, 0.014, 0.012, Materials.brass(), 12);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(ampX + kx, topY + 0.06, 0.105);
      g.add(knob);
    }

    // --- Bookshelf speakers on simple stands, flanking the cabinet ---
    const speakerOffsetX = cabinetWidth / 2 + 0.24;
    for (const sx of [-speakerOffsetX, speakerOffsetX]) {
      const standHeight = 0.4;
      const stand = box(0.09, standHeight, 0.09, Materials.wood("#3d2a1c"));
      stand.position.set(sx, standHeight / 2, 0);
      g.add(stand);
      const speaker = box(0.19, 0.28, 0.17, Materials.wood("#4a3120"));
      speaker.position.set(sx, standHeight + 0.14, 0);
      g.add(speaker);
      const cone = cylinder(0.055, 0.055, 0.015, Materials.matte("#232323"), 20);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(sx, standHeight + 0.16, 0.09);
      g.add(cone);
      const coneCenter = cylinder(0.018, 0.018, 0.018, Materials.matte("#111"), 16);
      coneCenter.rotation.x = Math.PI / 2;
      coneCenter.position.set(sx, standHeight + 0.16, 0.098);
      g.add(coneCenter);
    }

    // --- A few small signs of use ---
    // A plant on the cabinet top, opposite the amp.
    const potX = 0;
    const pot = cylinder(0.045, 0.035, 0.06, Materials.matte("#8d6a45"), 16);
    pot.position.set(potX, topY + 0.03, -0.1);
    g.add(pot);
    for (let i = 0; i < 5; i++) {
      const leaf = sphere(Materials.fabric("#4a6b4a"), 8, 6);
      const angle = (i / 5) * Math.PI * 2;
      leaf.scale.set(0.05, 0.13, 0.05);
      leaf.position.set(potX + Math.cos(angle) * 0.02, topY + 0.11, -0.1 + Math.sin(angle) * 0.02);
      leaf.rotation.z = Math.cos(angle) * 0.3;
      leaf.rotation.x = Math.sin(angle) * 0.3;
      g.add(leaf);
    }

    // A loose stack of records leaning against the near-side speaker stand.
    const leanX = -speakerOffsetX + 0.16;
    for (let i = 0; i < 4; i++) {
      const sleeve = box(0.315, 0.315, 0.008, Materials.matte(recordColors[i % recordColors.length]));
      sleeve.position.set(leanX + i * 0.012, 0.16, 0.16 + i * 0.012);
      sleeve.rotation.x = -0.32;
      g.add(sleeve);
    }

    return g;
  },

  interaction: {
    prompt: "Put on a record",
    radius: 2.4, // large furniture — see docs/WORLD.md's interaction-distance pass
    overlayId: "music",
  },
};
