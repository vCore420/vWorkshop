import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * SittingArea
 * -----------
 * An armchair, rug, and side table. Not every object needs a fully built
 * feature behind it on day one — this corner is comfortable *now* (a real
 * place to stop and look at the room) and is explicitly reserved for
 * something quieter later, like a local AI companion to sit and talk with.
 *
 * Furniture & Storage phase — a cushion tier, a proper table foot, and
 * one closed book resting on the table (see `docs/FURNITURE.md`). The
 * existing sit-down focus pose was reviewed against the slightly taller
 * cushion and found to still read naturally — 8cm is a small enough
 * change for a first-person camera fixed well above it.
 */
export const SittingAreaDefinition = {
  id: "sittingArea",
  label: "Sitting area",
  // Living Spaces phase — "furniture alignment." This used to cover only
  // the armchair's own bulk, with an honestly-labelled gap for the side
  // table ("small enough to allow minor overlap") — checking the actual
  // numbers found the table isn't a minor overlap at all, it sits
  // entirely outside the old footprint, meaning it had no collision at
  // all. The chair (x:[-0.38,0.38], z:[-0.37,0.3]) and the table group
  // (x:[0.53,0.97], z:[-0.72,-0.28], including its leg/foot/book) don't
  // share a natural centre, so `offset` (see FurnitureSystem.js's own
  // comment) recentres the footprint on the midpoint of their combined
  // bounds instead — a tight fit around both, not a symmetric box nearly
  // double the size just to reach the table from the chair's own centre.
  // The rug stays deliberately outside this footprint too — it's still
  // meant to be walkable, not part of the "don't walk through this"
  // volume.
  footprint: { width: 1.35, depth: 1.02, offset: [0.295, -0.21] },

  build() {
    const g = group();

    const rug = cylinder(0.9, 0.9, 0.01, Materials.fabric("#7a4a3a"), 24);
    rug.position.set(0.1, 0.005, 0.1);
    g.add(rug);

    const seat = box(0.62, 0.14, 0.6, Materials.fabric("#3c5a53"));
    seat.position.set(0, 0.38, 0);
    g.add(seat);
    // Furniture & Storage phase — "chairs... comfort." A separate,
    // slightly smaller cushion on top of the seat's own frame, rather
    // than one flat slab standing in for both — the same "an upholstered
    // base plus a real cushion reads as padded" idea the Desk phase's own
    // office chair seat already established.
    const cushion = box(0.56, 0.08, 0.54, Materials.fabric("#436b62"));
    cushion.position.set(0, 0.49, 0);
    g.add(cushion);
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
    // Furniture & Storage phase — "side tables." A bare pedestal leg
    // floating at floor level never quite reads as stable; a real round
    // side table almost always has a foot wider than the leg itself.
    const tableFoot = cylinder(0.09, 0.11, 0.02, Materials.wood("#3d2a1c"));
    tableFoot.position.set(0.75, 0.01, -0.5);
    g.add(tableFoot);

    // Furniture & Storage phase — "environmental storytelling... a
    // reading corner someone actually uses." One closed book resting on
    // the table, near its own edge rather than dead centre — the single,
    // deliberately restrained addition here, the same standard the
    // Workbench's pencil and the Desk's pen holder already set.
    const book = box(0.14, 0.03, 0.1, Materials.fabric("#7a3b3b"));
    book.position.set(0.75, 0.48, -0.55);
    book.rotation.y = 0.15;
    g.add(book);

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
      // "Mouse look should remain available. Walking should remain
      // disabled until standing normally." Unlike sitting at the
      // Computer or Workbench — where the camera stays fixed on a
      // screen because looking away would defeat the point — the Quiet
      // Corner is just a comfortable place to sit and look around.
      // Position still never moves again once seated (see
      // CameraSystem.js's own _updateFocus() comment on why); only
      // yaw/pitch respond to the mouse.
      allowLookAround: true,
    },
  },
};
