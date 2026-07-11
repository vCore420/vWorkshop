import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * Wardrobe
 * ---------
 * "Please avoid creating a second wardrobe system" — this furniture piece
 * has no appearance/outfit logic of its own at all. Its `overlayId`
 * ("wardrobe") opens `WardrobeOverlay.js`, which mounts the exact same
 * `createWardrobeApp()` the computer's own Wardrobe app already uses —
 * see that file's own comment. This is the *fourth* time a piece of
 * furniture has opened an existing system through the standard overlay
 * pipeline rather than inventing its own (the music cabinet, the
 * archive shelving, and the computer desk all did this first) — a
 * physical wardrobe is simply one more entry point into functionality
 * that already exists.
 *
 * The mirror beside it is the first real payoff of the generic
 * reflection capability (see `ReflectionSystem.js`) — it isn't a special
 * "mirror object"; `object3D.userData.mirrorMesh` marks which mesh is the
 * reflective glass, and `ReflectionSystem` (see its own `init()`) reaches
 * into `FurnitureSystem`'s pieces to find that marker and register it,
 * exactly the same "a system reaches into furniture's own userData for a
 * marker it cares about" pattern `LightingSystem` already uses for the
 * workbench's lamp socket. A future Builder object gets the identical
 * capability through `ReflectiveBehaviour.js` instead — two callers of
 * one function, neither aware the other exists.
 */
export const WardrobeDefinition = {
  id: "wardrobe",
  label: "Wardrobe",
  // Covers the cabinet's own floor space plus the mirror stand beside it —
  // the mirror itself is thin enough not to need separate collision.
  footprint: { width: 1.5, depth: 0.6 },

  build() {
    const g = group();
    const wood = Materials.wood("#4a2f1f");
    const woodTrim = Materials.wood("#3a2415");
    const brass = Materials.brass();

    // --- Cabinet body, roughly centred at local x = -0.35 ---
    const cabinetX = -0.35;
    const cabinetWidth = 0.85;
    const cabinetDepth = 0.5;
    const cabinetHeight = 1.95;

    const body = box(cabinetWidth, cabinetHeight, cabinetDepth, wood);
    body.position.set(cabinetX, cabinetHeight / 2, 0);
    g.add(body);

    // A seam down the middle and two handles — just enough to read as
    // "a wardrobe with doors", not an unadorned box.
    const seam = box(0.015, cabinetHeight * 0.94, 0.01, woodTrim, { castShadow: false });
    seam.position.set(cabinetX, cabinetHeight / 2, cabinetDepth / 2 + 0.005);
    g.add(seam);

    for (const side of [-1, 1]) {
      const handle = cylinder(0.012, 0.012, 0.16, brass, 10);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(cabinetX + side * 0.16, cabinetHeight * 0.52, cabinetDepth / 2 + 0.02);
      g.add(handle);
    }

    const plinth = box(cabinetWidth + 0.04, 0.06, cabinetDepth + 0.04, woodTrim);
    plinth.position.set(cabinetX, 0.03, 0);
    g.add(plinth);

    // --- Full-height mirror, standing beside the cabinet at local x = 0.5 ---
    const mirrorX = 0.5;
    const mirrorWidth = 0.55;
    const mirrorHeight = 1.7;
    const frameThickness = 0.05;
    // A nudge toward the wall, on top of the whole ensemble's own
    // position — local -Z maps to world +Z (toward the south wall, at
    // this piece's placement) once the 180° rotation in layoutDefault.js
    // is applied. -0.25, not just a token amount: the mirror's own frame
    // is only 0.04m deep, far thinner than the cabinet's 0.5m, so a small
    // offset to its origin barely moves its actual back face — this is
    // sized so the mirror's back face ends up at least as close to the
    // wall as the cabinet's own back face does.
    const mirrorZ = -0.25;

    const stand = box(mirrorWidth + frameThickness * 2, 0.05, 0.22, woodTrim);
    stand.position.set(mirrorX, 0.025, mirrorZ);
    g.add(stand);

    const frame = box(mirrorWidth + frameThickness * 2, mirrorHeight + frameThickness * 2, 0.04, woodTrim);
    frame.position.set(mirrorX, mirrorHeight / 2 + 0.05, mirrorZ);
    g.add(frame);

    const mirrorMesh = box(mirrorWidth, mirrorHeight, 0.015, Materials.matte("#dfe3e6"));
    mirrorMesh.position.set(mirrorX, mirrorHeight / 2 + 0.05, mirrorZ + 0.02);
    g.add(mirrorMesh);

    // Markers for ReflectionSystem — see this file's own top comment.
    // mirrorAspect is explicit rather than derived from mesh.scale (which
    // box() leaves at the default 1,1,1, since it bakes real dimensions
    // directly into the geometry instead — see PlaceholderFactory.js).
    g.userData.mirrorMesh = mirrorMesh;
    g.userData.mirrorAspect = mirrorHeight / mirrorWidth;

    return g;
  },

  interaction: {
    prompt: "Open the wardrobe",
    // The interaction anchor is the whole compiled group, whose origin
    // sits at ground level (y=0) — but interaction distance is a real 3D
    // distance from the camera's eye height (1.65m), not a horizontal-only
    // one. 1.6 was already less than that fixed vertical distance alone,
    // making this completely unreachable from any position — the exact
    // same root cause an earlier pass found and fixed for the front
    // doors (see docs/REFINEMENT.md). 2.0 comfortably covers the vertical
    // offset with real horizontal reach left over.
    radius: 2.35, // slightly increased — was feeling a touch tight to reach comfortably
    overlayId: "wardrobe",
    focusPoseLocal: {
      // A few steps back from the mirror, facing the wardrobe/mirror
      // ensemble — close enough to see yourself, far enough to see the
      // whole mirror, not just your own face.
      position: [0.1, 1.55, 1.6],
      lookAt: [0.1, 1.2, 0],
    },
  },
};
