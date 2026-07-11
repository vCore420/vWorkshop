import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * SittingArea
 * -----------
 * An armchair, rug, and side table. Not every object needs a fully built
 * feature behind it on day one — this corner is comfortable *now* (a real
 * place to stop and look at the room) and is explicitly reserved for
 * something quieter later, like a local AI companion to sit and talk with.
 */
export const SittingAreaDefinition = {
  id: "sittingArea",
  label: "Sitting area",
  footprint: { width: 0.9, depth: 0.9 }, // just the armchair's bulk — the rug is walkable, the side table is small enough to allow minor overlap in this placeholder pass

  build() {
    const g = group();

    const rug = cylinder(0.9, 0.9, 0.01, Materials.fabric("#7a4a3a"), 24);
    rug.position.set(0.1, 0.005, 0.1);
    g.add(rug);

    const seat = box(0.62, 0.14, 0.6, Materials.fabric("#3c5a53"));
    seat.position.set(0, 0.38, 0);
    g.add(seat);
    const back = box(0.62, 0.55, 0.14, Materials.fabric("#33504a"));
    back.position.set(0, 0.66, -0.3);
    g.add(back);
    const armL = box(0.12, 0.32, 0.6, Materials.fabric("#33504a"));
    armL.position.set(-0.32, 0.46, 0);
    g.add(armL);
    const armR = box(0.12, 0.32, 0.6, Materials.fabric("#33504a"));
    armR.position.set(0.32, 0.46, 0);
    g.add(armR);
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      const leg = cylinder(0.02, 0.02, 0.28, Materials.wood("#3d2a1c"));
      leg.position.set(x, 0.14, z);
      g.add(leg);
    }

    const table = cylinder(0.22, 0.22, 0.03, Materials.wood("#6b4a34"));
    table.position.set(0.75, 0.45, -0.5);
    g.add(table);
    const tableLeg = cylinder(0.03, 0.03, 0.42, Materials.wood("#3d2a1c"));
    tableLeg.position.set(0.75, 0.23, -0.5);
    g.add(tableLeg);

    return g;
  },

  interaction: {
    prompt: "Sit for a while",
    radius: 2.2, // medium furniture — see docs/WORLD.md's interaction-distance pass
    overlayId: "restNook",
    focusPoseLocal: {
      position: [0, 1.1, 0.15],
      // The backrest sits at local z=-0.3 (see build() above) — sitting
      // normally means facing *away* from it, toward +Z, not back into
      // it. This used to point toward -1.2, aiming the camera back over
      // its own shoulder at the chair instead of out into the room —
      // "the sitting camera is rotated approximately 180 degrees,
      // causing the player to appear to sit backwards."
      lookAt: [0, 0.9, 1.2],
    },
  },
};
