import * as THREE from "three";
import { box, cylinder, multiFaceBox, group, Materials } from "../../utils/PlaceholderFactory.js";
import { concreteTexture } from "../../utils/ProceduralTexture.js";

// Above this height, a wall segment can't physically intersect the player
// (see CameraSystem's 2D, Y-agnostic collision) — a door/window header is
// real geometry, but it's above head height, so it must never appear as a
// collision obstacle. Matches FurnitureSystem's own footprint height
// convention for the same reason.
export const COLLISION_HEIGHT_LIMIT = 2.2;

// The wall was 0.12 thick before this pass, and every piece of furniture
// that sits close to one (the pinboard, tool storage, the workbench) was
// placed against *that* interior face. Growing the wall to a believable
// exterior-shell thickness by centring it on the same line would have
// pushed the new interior face into that furniture. Instead, walls grow
// **outward only** — the interior face stays exactly where it's always
// been, and the extra thickness (the exterior shell) is added beyond the
// original boundary. See buildRoom()'s centre-offset math below.
const OLD_WALL_THICKNESS = 0.12;
const WALL_THICKNESS = 0.3;
const WALL_GROWTH = (WALL_THICKNESS - OLD_WALL_THICKNESS) / 2;

/**
 * buildWallWithOpenings
 * -----------------------
 * The fix at the heart of this pass: earlier, the north and south walls
 * were each a single solid box spanning the *entire* wall, with the door
 * and window meshes simply layered in front of it — there was never an
 * actual opening. That's what was reported as "a large object blocking the
 * doors": it was the wall itself, uncut, sitting exactly where the doorway
 * should have been open.
 *
 * This builds a wall as a strip of box segments with real gaps left where
 * `openings` says there should be one (a door reaches the floor —
 * `bottomHeight: 0`; a window has both a sill below and a header above).
 * It works generically for zero, one, or two openings in the same wall by
 * slicing left-to-right and adding a header/sill around each one — no
 * special-casing per wall.
 *
 * Each wall segment gets *two* materials (`multiFaceBox`) — one for the
 * face pointing outward (the exterior shell) and one for the face pointing
 * into the room — because the same wall now has to look correct from both
 * sides now that you can walk around outside it.
 *
 * Returns both the visual `group` and the raw local-space `segments`
 * (`{u0,u1,v0,v1}`), which the caller turns into world-space collision
 * boxes — the collision shape is derived from the exact same slicing that
 * produced the visuals, so an opening is guaranteed to be walkable and a
 * solid segment is guaranteed to be solid; there's no second, hand-tuned
 * collision layout to drift out of sync with the geometry.
 */
function buildWallWithOpenings({ length, height, thickness, openings, exteriorFacesPositiveZ, interiorMaterial, exteriorMaterial }) {
  const wallGroup = new THREE.Group();
  const segments = [];

  const pzMaterial = exteriorFacesPositiveZ ? exteriorMaterial : interiorMaterial;
  const nzMaterial = exteriorFacesPositiveZ ? interiorMaterial : exteriorMaterial;

  const addSegment = (u0, u1, v0, v1) => {
    const w = u1 - u0;
    const h = v1 - v0;
    if (w <= 0.01 || h <= 0.01) return;
    const mesh = multiFaceBox(w, h, thickness, { pz: pzMaterial, nz: nzMaterial }, exteriorMaterial);
    mesh.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0);
    wallGroup.add(mesh);
    segments.push({ u0, u1, v0, v1 });
  };

  const sorted = [...openings].sort((a, b) => a.center - b.center);
  let cursor = -length / 2;
  for (const op of sorted) {
    const opLeft = op.center - op.width / 2;
    const opRight = op.center + op.width / 2;
    addSegment(cursor, opLeft, 0, height); // solid run up to this opening
    if (op.topHeight < height) addSegment(opLeft, opRight, op.topHeight, height); // header above it
    if (op.bottomHeight > 0) addSegment(opLeft, opRight, 0, op.bottomHeight); // sill below it (windows only)
    cursor = opRight;
  }
  addSegment(cursor, length / 2, 0, height); // solid run after the last opening

  return { group: wallGroup, segments };
}

/**
 * buildRoom
 * ---------
 * Builds the workshop as a real, walk-through-able structure: floor,
 * ceiling, four walls (two of them with genuine openings — see
 * buildWallWithOpenings above), a set of French doors, two windows glazed
 * with real transparent glass, and an exterior shell (the same walls, seen
 * from the outside, plus a simple roof) and a list of wall collision
 * boxes.
 *
 * Returns everything RoomLayoutSystem/CameraSystem/EnvironmentSystem need:
 *   - windowPanes: real glass (Materials.glass), not an opaque tint — the
 *     actual sky/exterior is what you see through them.
 *   - doorFrame: the (fixed, never-moving) door casing — used as the
 *     interaction anchor for proximity checks, since it's already
 *     positioned exactly at the doorway.
 *   - doorPanels: { left, right } — each a THREE.Group pivoted at its own
 *     hinge (the outer jamb), rotated by RoomLayoutSystem to swing the
 *     doors open/closed. See buildDoorPanel's own comment above for why a
 *     separate pivot, not the mesh's own centre.
 *   - doorOpenAngle: how far open (radians) counts as "fully open" — the
 *     left panel rotates to -doorOpenAngle, the right to +doorOpenAngle,
 *     both swinging outward.
 *   - wallColliders: THREE.Box3 list for CameraSystem's walk-collision —
 *     derived directly from the same segments used to build the walls.
 *   - floorMesh: unchanged, used by BuildModeSystem's placement raycast.
 */
export function buildRoom(dimensions, windowDefs, doorDef) {
  const { width, depth, height } = dimensions;
  const root = group();

  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTexture("#7d766a"), roughness: 0.95 });
  const floor = box(width, 0.1, depth, floorMat);
  floor.position.set(0, -0.05, 0);
  root.add(floor);

  const ceilingMat = Materials.matte("#e7e2d6");
  const ceiling = box(width, 0.1, depth, ceilingMat);
  ceiling.position.set(0, height + 0.05, 0);
  root.add(ceiling);

  const interiorWallMat = Materials.matte("#cfc4ad");
  const exteriorWallMat = Materials.siding("#5a4a3d");

  // Wall centrelines, shifted outward by WALL_GROWTH so each wall's interior
  // face lands exactly where the thinner phase-1 wall's did (see the
  // WALL_GROWTH comment above) — existing furniture never needs to move.
  const northCenterZ = -depth / 2 - WALL_GROWTH;
  const southCenterZ = depth / 2 + WALL_GROWTH;
  const eastCenterX = width / 2 + WALL_GROWTH;
  const westCenterX = -width / 2 - WALL_GROWTH;
  const northInteriorZ = northCenterZ + WALL_THICKNESS / 2;
  const southInteriorZ = southCenterZ - WALL_THICKNESS / 2;
  const northOuterZ = northCenterZ - WALL_THICKNESS / 2;
  const southOuterZ = southCenterZ + WALL_THICKNESS / 2;
  const eastOuterX = eastCenterX + WALL_THICKNESS / 2;
  const westOuterX = westCenterX - WALL_THICKNESS / 2;

  const wallColliders = [];
  const addColliderFromSegments = (segments, zMin, zMax) => {
    for (const seg of segments) {
      if (seg.v0 >= COLLISION_HEIGHT_LIMIT) continue; // purely a header/lintel above head height — not an obstacle
      wallColliders.push(
        new THREE.Box3(
          new THREE.Vector3(Math.min(seg.u0, seg.u1), seg.v0, zMin),
          new THREE.Vector3(Math.max(seg.u0, seg.u1), seg.v1, zMax)
        )
      );
    }
  };

  // --- North wall (windows) ---
  const windowOpenings = windowDefs.map((w) => ({
    center: w.position[0],
    width: w.width,
    bottomHeight: w.position[1] - w.height / 2,
    topHeight: w.position[1] + w.height / 2,
  }));
  const northWall = buildWallWithOpenings({
    length: width,
    height,
    thickness: WALL_THICKNESS,
    openings: windowOpenings,
    exteriorFacesPositiveZ: false, // north wall's exterior is further -z (away from room centre)
    interiorMaterial: interiorWallMat,
    exteriorMaterial: exteriorWallMat,
  });
  northWall.group.position.set(0, 0, northCenterZ);
  root.add(northWall.group);
  addColliderFromSegments(northWall.segments, northCenterZ - WALL_THICKNESS / 2, northCenterZ + WALL_THICKNESS / 2);

  // --- South wall (the workshop door) ---
  const southWall = buildWallWithOpenings({
    length: width,
    height,
    thickness: WALL_THICKNESS,
    openings: [{ center: doorDef.position[0], width: doorDef.width, bottomHeight: 0, topHeight: doorDef.height }],
    exteriorFacesPositiveZ: true, // south wall's exterior is further +z
    interiorMaterial: interiorWallMat,
    exteriorMaterial: exteriorWallMat,
  });
  southWall.group.position.set(0, 0, southCenterZ);
  root.add(southWall.group);
  addColliderFromSegments(southWall.segments, southCenterZ - WALL_THICKNESS / 2, southCenterZ + WALL_THICKNESS / 2);

  // --- East / West walls: solid, no openings, but still two-sided.
  // Extended slightly beyond the original depth so they meet the now-
  // thicker north/south walls flush at the exterior corners, rather than
  // leaving a small seam where those walls grew outward and these didn't.
  const sideWallDepth = southOuterZ - northOuterZ;
  const eastWall = multiFaceBox(WALL_THICKNESS, height, sideWallDepth, { px: exteriorWallMat, nx: interiorWallMat }, exteriorWallMat);
  eastWall.position.set(eastCenterX, height / 2, 0);
  root.add(eastWall);
  wallColliders.push(new THREE.Box3(
    new THREE.Vector3(eastCenterX - WALL_THICKNESS / 2, 0, -sideWallDepth / 2),
    new THREE.Vector3(eastCenterX + WALL_THICKNESS / 2, height, sideWallDepth / 2)
  ));

  const westWall = multiFaceBox(WALL_THICKNESS, height, sideWallDepth, { px: interiorWallMat, nx: exteriorWallMat }, exteriorWallMat);
  westWall.position.set(westCenterX, height / 2, 0);
  root.add(westWall);
  wallColliders.push(new THREE.Box3(
    new THREE.Vector3(westCenterX - WALL_THICKNESS / 2, 0, -sideWallDepth / 2),
    new THREE.Vector3(westCenterX + WALL_THICKNESS / 2, height, sideWallDepth / 2)
  ));

  // --- Windows: real glass in the real opening, flush with the (unchanged) interior face ---
  //
  // The frame here used to be a single solid slab, sized *slightly larger*
  // than the window opening, sitting just behind the glass. That's the
  // actual cause of "a thin dark surface still covers the opening" — the
  // wall itself had a real hole, but this "trim" piece was never cut with
  // one, so it opaquely plugged the exact area the glass was supposed to
  // reveal. The fix reuses `buildWallWithOpenings` (the same slicing that
  // makes the wall's own opening real) to build the frame as a genuine
  // hollow ring — left jamb, right jamb, header, sill — around a real gap.
  const windowPanes = [];
  for (const w of windowDefs) {
    const frameOuterW = w.width + 0.08;
    const frameOuterH = w.height + 0.08;
    const frameThickness = 0.05;
    const frameMat = Materials.wood("#6b4a34");
    const frameMargin = (frameOuterH - w.height) / 2;
    const frame = buildWallWithOpenings({
      length: frameOuterW,
      height: frameOuterH,
      thickness: frameThickness,
      openings: [{ center: 0, width: w.width, bottomHeight: frameMargin, topHeight: frameMargin + w.height }],
      exteriorFacesPositiveZ: false, // a thin trim piece — one material is enough, both sides use it
      interiorMaterial: frameMat,
      exteriorMaterial: frameMat,
    }).group;
    frame.position.set(w.position[0], w.position[1] - frameOuterH / 2, northInteriorZ - 0.01);
    root.add(frame);

    const paneMat = Materials.glass("#dff3ff");
    const pane = box(w.width, w.height, 0.02, paneMat, { castShadow: false, receiveShadow: false });
    pane.position.set(w.position[0], w.position[1], northInteriorZ);
    root.add(pane);

    const muntin = box(0.03, w.height, 0.03, Materials.wood("#4a3120"));
    muntin.position.copy(pane.position);
    root.add(muntin);

    windowPanes.push({ mesh: pane, material: paneMat, def: w });
  }

  // --- Workshop door: same fix as the windows above — the frame is a real
  // hollow casing (jambs + header, no sill since the door reaches the
  // floor) instead of a solid slab plugging the opening.
  const doorFrameOuterW = doorDef.width + 0.12;
  const doorFrameOuterH = doorDef.height + 0.1;
  const doorFrame = buildWallWithOpenings({
    length: doorFrameOuterW,
    height: doorFrameOuterH,
    thickness: 0.1,
    openings: [{ center: 0, width: doorDef.width, bottomHeight: 0, topHeight: doorDef.height }],
    exteriorFacesPositiveZ: true,
    interiorMaterial: Materials.wood("#3d2a1c"),
    exteriorMaterial: Materials.wood("#3d2a1c"),
  }).group;
  doorFrame.position.set(doorDef.position[0], 0, southInteriorZ);
  root.add(doorFrame);

  const doorMat = new THREE.MeshStandardMaterial({ color: "#8d8577", roughness: 0.6, metalness: 0.5 });

  // --- French doors: two outward-opening panels, hinged at the OUTER
  // jambs, replacing the old single slab that slid straight up. Each
  // panel's pivot sits at its hinge edge, not its own centre — the same
  // "a pivot the mesh is offset from, not centred on" idea the player
  // rig's joints already use — so rotating the pivot swings the whole
  // panel around that edge like a real hinged door. See
  // RoomLayoutSystem.js for the actual open/close animation.
  const panelWidth = doorDef.width / 2;
  const stileWidth = 0.09; // the solid frame strip around each panel's glass
  const lowerPanelHeight = doorDef.height * 0.32; // solid wood kick panel at the bottom, divided-lite glass above — the classic French door look
  const paneGlass = Materials.glass("#dceffc");

  function buildDoorPanel(hingeSide) {
    // hingeSide: -1 for the left panel (hinge on the left/outer jamb),
    // +1 for the right panel (hinge on the right/outer jamb). Either way
    // the panel mesh is offset from its own pivot toward the doorway's
    // centre, so together the two panels meet in the middle when closed.
    const pivot = new THREE.Group();
    const mesh = box(panelWidth, doorDef.height, 0.06, doorMat);
    mesh.position.set(-hingeSide * (panelWidth / 2), doorDef.height / 2, 0);
    pivot.add(mesh);

    const glassAreaHeight = doorDef.height - lowerPanelHeight - stileWidth * 2;
    const glassAreaWidth = panelWidth - stileWidth * 2;
    const paneRows = 4, paneCols = 2;
    const paneCellW = glassAreaWidth / paneCols;
    const paneCellH = glassAreaHeight / paneRows;
    for (let row = 0; row < paneRows; row++) {
      for (let col = 0; col < paneCols; col++) {
        const pane = box(paneCellW - 0.02, paneCellH - 0.02, 0.015, paneGlass);
        pane.position.set(
          -panelWidth / 2 + stileWidth + paneCellW * col + paneCellW / 2,
          doorDef.height / 2 - stileWidth - paneCellH * row - paneCellH / 2,
          0.025
        );
        mesh.add(pane);
      }
    }

    // A simple lever handle near the meeting edge (opposite the hinge).
    // The handle's position is relative to `mesh`, which is itself
    // already offset from `pivot` toward the doorway's centre (see
    // `mesh.position.set()` above) — so the *mesh's own* local edge
    // nearest the hinge is the one closest to zero in mesh-local space,
    // and the one furthest from the hinge (the meeting edge) is the one
    // signed the *same* as that same offset, not the opposite of
    // `hingeSide` the way the mesh's own offset is. Using `hingeSide`
    // directly (without negating it, unlike the mesh's own offset above)
    // is what actually lands the handle near the meeting edge.
    // Z is negative — "door handles should appear on the correct inner
    // sides of the French doors." This wall's own `exteriorFacesPositiveZ:
    // true` (above) means the interior is -Z, not +Z; a positive Z here
    // was putting the handle on the outward-facing side instead.
    const handle = cylinder(0.012, 0.012, 0.14, Materials.brass(), 10);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(-hingeSide * (panelWidth / 2 - 0.12), 0, -0.05);
    mesh.add(handle);

    return pivot;
  }

  const doorPanelLeft = buildDoorPanel(-1);
  const doorPanelRight = buildDoorPanel(1);
  doorPanelLeft.position.set(doorDef.position[0] - doorDef.width / 2, 0, southInteriorZ);
  doorPanelRight.position.set(doorDef.position[0] + doorDef.width / 2, 0, southInteriorZ);
  root.add(doorPanelLeft);
  root.add(doorPanelRight);
  const doorOpenAngle = 1.9; // ~109° — flung outward, past perpendicular, the way a real French door rests open rather than stopping exactly at 90°

  // --- Roof: a simple flat shell with a slight overhang — "believable", not "beautiful" ---
  const roofOverhang = 0.45;
  const roofThickness = 0.16;
  const roofMat = Materials.siding("#33302b");
  const roofY = height + 0.1 + roofThickness / 2;
  const roofWidth = (eastOuterX - westOuterX) + roofOverhang * 2;
  const roofDepth = (southOuterZ - northOuterZ) + roofOverhang * 2;
  const roof = box(roofWidth, roofThickness, roofDepth, roofMat);
  roof.position.set(0, roofY, 0);
  root.add(roof);

  const fasciaMat = Materials.wood("#2c2419");
  const fasciaDrop = 0.16;
  const fasciaY = roofY - roofThickness / 2 - fasciaDrop / 2;
  const fasciaEdgeZ = southOuterZ + roofOverhang;
  const fasciaEdgeX = eastOuterX + roofOverhang;
  const fasciaNS = box(roofWidth, fasciaDrop, 0.04, fasciaMat, { castShadow: false });
  fasciaNS.position.set(0, fasciaY, -fasciaEdgeZ);
  root.add(fasciaNS);
  const fasciaNS2 = fasciaNS.clone();
  fasciaNS2.position.z = fasciaEdgeZ;
  root.add(fasciaNS2);
  const fasciaEW = box(0.04, fasciaDrop, roofDepth, fasciaMat, { castShadow: false });
  fasciaEW.position.set(fasciaEdgeX, fasciaY, 0);
  root.add(fasciaEW);
  const fasciaEW2 = fasciaEW.clone();
  fasciaEW2.position.x = -fasciaEdgeX;
  root.add(fasciaEW2);

  // --- Ceiling pendant light fixtures (geometry only; LightingSystem adds the actual lights) ---
  const ceilingLightSockets = [];
  const socketOffsets = [[-1.8, -0.5], [1.8, 0.8]];
  for (const [x, z] of socketOffsets) {
    const cord = cylinder(0.01, 0.01, 0.5, Materials.matte("#1c1a17"), 6);
    cord.position.set(x, height - 0.25, z);
    root.add(cord);
    const shade = cylinder(0.16, 0.2, 0.14, Materials.metal("#4a4844"), 16);
    shade.position.set(x, height - 0.55, z);
    root.add(shade);
    ceilingLightSockets.push(new THREE.Vector3(x, height - 0.6, z));
  }

  // "Collision geometry should accurately match the visible doors" — one
  // box spanning the full doorway opening (the wall's own gap left for
  // it), at the wall's actual thickness — see RoomLayoutSystem.js's own
  // getDoorCollider() for when this is actually used (only while the
  // door is substantially closed).
  const doorColliderBox = new THREE.Box3(
    new THREE.Vector3(doorDef.position[0] - doorDef.width / 2, 0, southInteriorZ),
    new THREE.Vector3(doorDef.position[0] + doorDef.width / 2, doorDef.height, southOuterZ)
  );

  return {
    group: root,
    windowPanes,
    doorFrame, // used as the interaction anchor — it's already positioned at the doorway itself, and never moves
    doorPanels: { left: doorPanelLeft, right: doorPanelRight },
    doorOpenAngle,
    doorColliderBox,
    ceilingLightSockets,
    bounds: { width, depth, height },
    floorMesh: floor,
    wallColliders,
  };
}
