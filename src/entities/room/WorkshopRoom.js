import * as THREE from "three";
import { box, cylinder, sphere, multiFaceBox, group, Materials } from "../../utils/PlaceholderFactory.js";
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
/** Phase 14 ("Further Environmental Polish") — every wall segment shared
 *  one cached siding material with a fixed 0-1 UV span regardless of the
 *  segment's own physical size, so a short header/sill segment (above/
 *  below a window, say) showed the exact same board pattern squeezed
 *  into far less height than the full-height segments beside it —
 *  "compresses differently at a smaller height... doesn't line up." A
 *  per-segment texture clone (cheap — no canvas redraw, just a new
 *  Texture referencing the same image) with `repeat.y`/`offset.y` set
 *  from this segment's own absolute position within the *whole* wall
 *  keeps board density consistent and makes boards genuinely continuous
 *  across every segment boundary, not just density-matched. Only ever
 *  applied to the one face that's actually exterior siding —
 *  `Materials.siding()`'s own shared, cached material is untouched for
 *  every other caller in the project. */
function wallSegmentMaterial(material, isExteriorFace, v0, v1, wallHeight) {
  if (!isExteriorFace || !material.map) return material;
  const clone = material.clone();
  clone.map = material.map.clone();
  clone.map.offset.y = v0 / wallHeight;
  clone.map.repeat.y = (v1 - v0) / wallHeight;
  clone.map.needsUpdate = true;
  return clone;
}

function buildWallWithOpenings({ length, height, thickness, openings, exteriorFacesPositiveZ, interiorMaterial, exteriorMaterial }) {
  const wallGroup = new THREE.Group();
  const segments = [];

  const pzMaterial = exteriorFacesPositiveZ ? exteriorMaterial : interiorMaterial;
  const nzMaterial = exteriorFacesPositiveZ ? interiorMaterial : exteriorMaterial;

  const addSegment = (u0, u1, v0, v1) => {
    const w = u1 - u0;
    const h = v1 - v0;
    if (w <= 0.01 || h <= 0.01) return;
    const segPz = wallSegmentMaterial(pzMaterial, exteriorFacesPositiveZ, v0, v1, height);
    const segNz = wallSegmentMaterial(nzMaterial, !exteriorFacesPositiveZ, v0, v1, height);
    const mesh = multiFaceBox(w, h, thickness, { pz: segPz, nz: segNz }, exteriorMaterial);
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
 * buildBaseboard
 * --------------
 * Workshop Interior phase — "trim... corners... nothing should feel left
 * behind." A skirting board along a wall's interior base is one of the
 * most universal signs of "a real, finished room," and the Workshop had
 * none anywhere — walls simply met the floor at a bare edge. Reuses
 * `buildWallWithOpenings`'s own slicing rather than a second, hand-rolled
 * way to leave a gap: given the exact same `openings` a wall was already
 * built with, a baseboard skips them automatically (a door reaches the
 * floor and must have a real gap in its own trim too; a window's sill
 * sits well above baseboard height, so in practice only the door ever
 * actually needs one). Single material — a baseboard is only ever seen
 * from the room side, unlike a wall itself.
 */
function buildBaseboard({ length, openings, height, depth, material }) {
  return buildWallWithOpenings({
    length,
    height,
    thickness: depth,
    openings,
    exteriorFacesPositiveZ: true,
    interiorMaterial: material,
    exteriorMaterial: material,
  }).group;
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
  for (let windowIndex = 0; windowIndex < windowDefs.length; windowIndex++) {
    const w = windowDefs[windowIndex];
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

    // Workshop Interior phase — "window frame materials... trim." The
    // frame's own sill segment (built by buildWallWithOpenings above) sits
    // flush with the wall, the same thickness as the jambs either side of
    // it — real windows almost always have a sill that actually protrudes
    // a little into the room, the one surface of a window you could
    // plausibly set something on. A separate, slightly wider, slightly
    // deeper ledge, sitting just below the glass and proud of the wall.
    const sillLedge = box(w.width + 0.14, 0.03, 0.12, Materials.wood("#6b4a34"));
    sillLedge.position.set(w.position[0], w.position[1] - w.height / 2 - 0.015, northInteriorZ + 0.06);
    root.add(sillLedge);

    // Decorative Details phase — "surface details... window sills...
    // plants." One small plant, on one sill, not both — a matching pair
    // would read as decorated; a single one reads as somebody actually
    // put it there. A compact succulent, deliberately different from the
    // music cabinet's own leafier plant, for a little natural variety
    // rather than the same pot repeated around the room.
    if (windowIndex === 0) {
      const potX = w.position[0] + w.width / 2 - 0.12;
      const potY = w.position[1] - w.height / 2 + 0.03;
      const potZ = northInteriorZ + 0.1;
      const pot = cylinder(0.045, 0.035, 0.06, Materials.ceramic("#a9764f"));
      pot.position.set(potX, potY, potZ);
      root.add(pot);
      for (let i = 0; i < 6; i++) {
        const leaf = sphere(Materials.fabric("#5c8f5c"), 6, 5);
        const angle = (i / 6) * Math.PI * 2;
        leaf.scale.set(0.028, 0.05, 0.028);
        leaf.position.set(potX + Math.cos(angle) * 0.018, potY + 0.04, potZ + Math.sin(angle) * 0.018);
        root.add(leaf);
      }
    }

    windowPanes.push({ mesh: pane, material: paneMat, def: w });
  }

  // --- A wall clock, in the open wall segment between the two windows —
  // Decorative Details phase. The Workshop's first genuinely time-driven
  // decoration: the hour and minute hands are real pivot groups,
  // exposed here as `clockHourHand`/`clockMinuteHand` and rotated by
  // `LightingSystem` from the same `timeofday:changed` event it already
  // reacts to for the sun — the exact same "a system reaches into the
  // room's own userData for a marker it cares about" pattern LightingSystem
  // already uses for the ceiling sockets, the wall sconces, and the
  // workbench lamp. No new system, no new event — one more consumer of
  // a value (`hour`) `TimeOfDaySystem` was already broadcasting.
  const clockGroup = new THREE.Group();
  const clockFrame = cylinder(0.19, 0.19, 0.03, Materials.metal("#2b2b2b"), 24);
  clockFrame.rotation.x = Math.PI / 2;
  clockGroup.add(clockFrame);
  const clockFace = cylinder(0.16, 0.16, 0.01, Materials.matte("#ede3d0"), 24);
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.z = 0.02;
  clockGroup.add(clockFace);
  // Four ticks (12/3/6/9) — enough to read as a clock face at a normal
  // walking distance, short of the clutter twelve individual ticks would
  // risk for an object this small and this far from the camera.
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const tick = box(0.012, 0.03, 0.005, Materials.matte("#2b2b2b"), { castShadow: false });
    tick.position.set(Math.sin(angle) * 0.13, Math.cos(angle) * 0.13, 0.026);
    tick.rotation.z = -angle;
    clockGroup.add(tick);
  }
  // Each hand is its own pivot group (the same "a mesh offset from its
  // own local origin, inside a group whose origin is the real pivot"
  // shape the front doors' own panels already use) — rotating the group
  // sweeps the hand around the clock's centre, not around its own middle.
  const clockHourHand = new THREE.Group();
  const hourHandMesh = box(0.014, 0.09, 0.006, Materials.matte("#2b2b2b"), { castShadow: false });
  hourHandMesh.position.set(0, 0.045, 0);
  clockHourHand.add(hourHandMesh);
  clockHourHand.position.z = 0.028;
  clockGroup.add(clockHourHand);
  const clockMinuteHand = new THREE.Group();
  const minuteHandMesh = box(0.01, 0.13, 0.006, Materials.matte("#2b2b2b"), { castShadow: false });
  minuteHandMesh.position.set(0, 0.065, 0);
  clockMinuteHand.add(minuteHandMesh);
  clockMinuteHand.position.z = 0.03;
  clockGroup.add(clockMinuteHand);
  const clockPin = cylinder(0.01, 0.01, 0.01, Materials.metal("#2b2b2b"), 10);
  clockPin.rotation.x = Math.PI / 2;
  clockPin.position.z = 0.032;
  clockGroup.add(clockPin);
  // Centred in the open wall segment between the two windows (see
  // WINDOWS in layoutDefault.js: they span -2.65..-1.35 and 0.75..2.05,
  // leaving -1.35..0.75 open) — a spot with no existing furniture or
  // opening anywhere near it.
  clockGroup.position.set(-0.3, 1.85, northInteriorZ + 0.02);
  root.add(clockGroup);

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
    const panelDepth = 0.06;
    const mesh = box(panelWidth, doorDef.height, panelDepth, doorMat);
    // Phase 14 ("Further Environmental Polish") — the pivot itself sits
    // at the wall's true *outer* face (see its own `.position.set()`
    // below), not the inner one. Version 4, Phase 2 ("Playtesting Notes,
    // Continued") — Phase 14's own fix moved the *pivot* correctly but
    // left the *mesh* offset at the full wall thickness (`-WALL_THICKNESS`,
    // 0.3m) specifically so the closed door's world position wouldn't
    // shift — which quietly re-created the same problem one level down:
    // a door's hinge line has to be coincident with the leaf's own edge
    // to swing like a hinge at all, and a leaf sitting 0.3m away from its
    // own rotation axis instead sweeps its whole width through open air
    // around a point that isn't on it — confirmed numerically (traced the
    // hinge-side point's own world position at closed vs. fully-open
    // angles: ~0.5m of drift, reading exactly like "swings outward, away
    // from the house," not a clean hinge). The mesh's own local Z now
    // offsets by half its own physical depth instead — its hinge-side
    // face lands exactly on the pivot (local z = 0), the same way a real
    // door's hinge pin sits right at the leaf's own edge, not floating
    // inside the wall cavity behind it. The closed door's world position
    // does shift as a result (now sitting near the *outer* face, embedded
    // in the wall's own opening, rather than flush with the interior
    // face) — a real, visible, and correct change: a leaf hinged at the
    // outer face has to actually live near the outer face, not the inner
    // one, for "hinge" to mean anything geometrically.
    mesh.position.set(-hingeSide * (panelWidth / 2), doorDef.height / 2, -panelDepth / 2);
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

    // Workshop Interior phase — "door materials... visual consistency."
    // Three small hinge plates on the actual hinge edge (the opposite
    // edge from the handle above) — a real French door's hinges are
    // visible hardware, not an implied, invisible pivot. Purely cosmetic:
    // the panel's actual rotation still happens around `pivot`, exactly as
    // before, unaffected by these being attached to `mesh`.
    const hingeMat = Materials.metal("#6f6c64");
    for (const hy of [-doorDef.height * 0.36, 0, doorDef.height * 0.36]) {
      const hinge = box(0.03, 0.1, 0.012, hingeMat, { castShadow: false });
      hinge.position.set(hingeSide * (panelWidth / 2 - 0.015), hy, -0.036);
      mesh.add(hinge);
    }

    return pivot;
  }

  const doorPanelLeft = buildDoorPanel(-1);
  const doorPanelRight = buildDoorPanel(1);
  // Phase 14 — hinged from the wall's own true outer edge (southOuterZ),
  // not the inner one; see buildDoorPanel()'s own comment on why the
  // closed door's visual position is unaffected by this change.
  doorPanelLeft.position.set(doorDef.position[0] - doorDef.width / 2, 0, southOuterZ);
  doorPanelRight.position.set(doorDef.position[0] + doorDef.width / 2, 0, southOuterZ);
  root.add(doorPanelLeft);
  root.add(doorPanelRight);
  const doorOpenAngle = 1.9; // ~109° — flung outward, past perpendicular, the way a real French door rests open rather than stopping exactly at 90°

  // --- Baseboard trim, all four walls. Windows never reach low enough to
  // need slicing around (their sill sits at 0.9m, well above baseboard
  // height) — only the south wall's door genuinely needs its own gap,
  // built the same way the wall itself already was.
  const baseboardMat = Materials.wood("#3d2a1c"); // the same dark trim tone the door frame already established
  const BASEBOARD_HEIGHT = 0.1;
  const BASEBOARD_DEPTH = 0.03;

  const northBaseboard = box(width, BASEBOARD_HEIGHT, BASEBOARD_DEPTH, baseboardMat);
  northBaseboard.position.set(0, BASEBOARD_HEIGHT / 2, northInteriorZ + BASEBOARD_DEPTH / 2);
  root.add(northBaseboard);

  const southBaseboard = buildBaseboard({
    length: width,
    openings: [{ center: doorDef.position[0], width: doorDef.width, bottomHeight: 0, topHeight: BASEBOARD_HEIGHT }],
    height: BASEBOARD_HEIGHT,
    depth: BASEBOARD_DEPTH,
    material: baseboardMat,
  });
  southBaseboard.position.set(0, 0, southInteriorZ - BASEBOARD_DEPTH / 2);
  root.add(southBaseboard);

  const eastBaseboard = box(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, sideWallDepth, baseboardMat);
  eastBaseboard.position.set(eastCenterX - WALL_THICKNESS / 2 - BASEBOARD_DEPTH / 2, BASEBOARD_HEIGHT / 2, 0);
  root.add(eastBaseboard);

  const westBaseboard = box(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, sideWallDepth, baseboardMat);
  westBaseboard.position.set(westCenterX + WALL_THICKNESS / 2 + BASEBOARD_DEPTH / 2, BASEBOARD_HEIGHT / 2, 0);
  root.add(westBaseboard);

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

  // Living Spaces phase — "wall texture continuity." A distinct dark
  // tone from the door frame/baseboard/sketch frame's own shared
  // "#3d2a1c" (see the baseboard's own comment below: "the same dark
  // trim tone the door frame already established"), close enough to
  // read as a near-duplicate rather than a deliberate second trim
  // colour — nothing anywhere explained the difference. Unified to the
  // one dark trim tone the rest of the room's woodwork already commits
  // to, rather than leaving an unexplained near-miss.
  const fasciaMat = Materials.wood("#3d2a1c");
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
    // Workshop Interior phase — "ceiling lights... fixture appearance."
    // The cord used to simply emerge from the ceiling plane with nothing
    // marking where it actually mounts — a small canopy plate is the
    // universal real-world detail that was missing.
    const canopy = cylinder(0.06, 0.07, 0.02, Materials.matte("#1c1a17"), 16);
    canopy.position.set(x, height - 0.01, z);
    root.add(canopy);
    const cord = cylinder(0.01, 0.01, 0.5, Materials.matte("#1c1a17"), 6);
    cord.position.set(x, height - 0.25, z);
    root.add(cord);
    const shade = cylinder(0.16, 0.2, 0.14, Materials.metal("#4a4844"), 16);
    shade.position.set(x, height - 0.55, z);
    root.add(shade);
    ceilingLightSockets.push(new THREE.Vector3(x, height - 0.6, z));
  }

  // --- Wall sconces, flanking the front doors. Workshop Interior phase —
  // "wall lights... the Workshop should feel welcoming." The Workshop had
  // ceiling pendants and a handful of task lamps, but nothing at all on a
  // wall — an entryway is the one place a real building almost always
  // lights from the wall rather than the ceiling. Built exactly like the
  // ceiling sockets above: geometry only here, with LightingSystem
  // attaching the real PointLight through the same registerPracticalLight
  // path every other practical fixture already goes through — no new
  // lighting mechanism, just one more pair of fixtures using it.
  const wallLightSockets = [];
  const sconceMat = Materials.metal("#6f6c64");
  for (const sx of [-1, 1]) {
    const bracketX = doorDef.position[0] + sx * (doorDef.width / 2 + 0.6);
    const bracket = box(0.05, 0.08, 0.1, sconceMat);
    // Back face flush with the wall's own interior plane (southInteriorZ),
    // extending into the room from there — not centred on it, which would
    // leave half the bracket floating in front of the wall with a gap.
    bracket.position.set(bracketX, 1.75, southInteriorZ - 0.05);
    root.add(bracket);
    const shade = cylinder(0.06, 0.08, 0.14, Materials.glass("#fbe8c2"));
    shade.rotation.x = Math.PI / 2;
    shade.position.set(bracketX, 1.75, southInteriorZ - 0.15);
    root.add(shade);
    wallLightSockets.push(new THREE.Vector3(bracketX, 1.75, southInteriorZ - 0.15));
  }

  // --- Exterior light, above the front doors — Phase 14 ("Further
  // Environmental Polish") — "the workshop could use exterior lighting
  // by the front door, spreading a bit of light outward." Built exactly
  // like the interior wall sconces just above (geometry only here,
  // LightingSystem attaches the real PointLight through the same
  // registerPracticalLight path), just mounted on the outer face of the
  // south wall instead, centred above the doorway rather than flanking
  // it — a single fixture lighting the entrance, not a matched pair.
  const exteriorLightSockets = [];
  {
    const bracket = box(0.06, 0.09, 0.08, sconceMat);
    bracket.position.set(doorDef.position[0], doorDef.height + 0.35, southOuterZ + 0.05);
    root.add(bracket);
    const shade = cylinder(0.07, 0.09, 0.15, Materials.glass("#fbe8c2"));
    shade.rotation.x = Math.PI / 2;
    shade.position.set(doorDef.position[0], doorDef.height + 0.35, southOuterZ + 0.14);
    root.add(shade);
    exteriorLightSockets.push(new THREE.Vector3(doorDef.position[0], doorDef.height + 0.35, southOuterZ + 0.14));
  }

  // --- Outdoor details, right against the exterior walls — Phase 14
  // ("Further Environmental Polish") — "a handful of small outdoor
  // details... a bench seat, planter boxes under the windows — making
  // the workshop itself feel more lived-in from outside." Purely
  // decorative (no FurnitureSystem/interaction entry — a small detail,
  // not a new interactable), sitting outside the room's own walkable
  // interior, so neither needs its own collision footprint.
  //
  // A planter box under each window — the pot+radial-leaves technique
  // is Shelving.js's own (see its "one pot plant on the book shelf"
  // comment), reused here rather than inventing a second way to build
  // foliage, just sized up for an outdoor box instead of a shelf-top pot.
  const planterMat = Materials.wood("#4a3120");
  const soilMat = Materials.matte("#2c1f14");
  const foliageMat = Materials.fabric("#4a6b4a");
  for (const w of windowDefs) {
    const planterWidth = w.width + 0.1;
    const planterDepth = 0.28;
    const planterZ = northOuterZ - 0.18;
    const planterBox = box(planterWidth, 0.3, planterDepth, planterMat);
    planterBox.position.set(w.position[0], 0.15, planterZ);
    root.add(planterBox);
    const soil = box(planterWidth - 0.05, 0.03, planterDepth - 0.06, soilMat, { castShadow: false });
    soil.position.set(w.position[0], 0.3 + 0.015, planterZ);
    root.add(soil);
    for (const clusterOffset of [-planterWidth / 3.4, 0, planterWidth / 3.4]) {
      const clusterX = w.position[0] + clusterOffset;
      for (let i = 0; i < 5; i++) {
        const leaf = sphere(foliageMat, 8, 6);
        const angle = (i / 5) * Math.PI * 2;
        leaf.scale.set(0.05, 0.13, 0.05);
        leaf.position.set(clusterX + Math.cos(angle) * 0.02, 0.3 + 0.11, planterZ + Math.sin(angle) * 0.02);
        leaf.rotation.z = Math.cos(angle) * 0.3;
        leaf.rotation.x = Math.sin(angle) * 0.3;
        root.add(leaf);
      }
    }
  }

  // A bench beside the front door, far enough along the south wall to
  // stay clear of the doorway itself and the exterior light above it.
  {
    const benchMat = Materials.wood("#5a3d29");
    const benchX = doorDef.position[0] + doorDef.width / 2 + 1.2;
    const benchZ = southOuterZ + 0.25;
    const benchSeat = box(1.2, 0.06, 0.4, benchMat);
    benchSeat.position.set(benchX, 0.42, benchZ);
    root.add(benchSeat);
    // Version 4, Phase 2 ("Playtesting Notes, Continued") — the backrest
    // was on the wrong side: `benchZ + 0.17` put it *further* from the
    // wall than the seat, leaving the open, backless edge almost flush
    // against the wall (a ~5cm gap) and the backrest itself out in the
    // yard, so anyone sitting down would face directly into the exterior
    // wall a few inches from their knees. `+Z` is "further from the
    // house" throughout this file (see `southOuterZ`'s own usage above) —
    // the backrest belongs on the *near*-wall side instead, so a person
    // sitting on the bench has their back to the house and looks out
    // into the yard, the ordinary way a bench against a wall works.
    const benchBack = box(1.2, 0.32, 0.05, benchMat);
    benchBack.position.set(benchX, 0.61, benchZ - 0.17);
    root.add(benchBack);
    for (const lx of [-0.5, 0.5]) {
      const leg = box(0.06, 0.42, 0.35, benchMat);
      leg.position.set(benchX + lx, 0.21, benchZ);
      root.add(leg);
    }
  }

  // --- A small framed sketch, south wall — Decorative Details phase
  // ("picture frames... wall decorations"). Reuses `Materials
  // .sketchPaper()` (already built for the Builder's own sketch presence
  // items — see docs/WORKBENCH.md) rather than inventing a second way to
  // suggest hand-drawn paper; a sketch on the wall reads as "somebody's
  // own work, framed," fitting a workshop's identity more than a generic
  // print would. Positioned well clear of the sconce at x=1.9 (see
  // above) and the light switch at x=1.5.
  const artWidth = 0.28, artHeight = 0.36, artX = 2.8;
  const artFrame = box(artWidth + 0.06, artHeight + 0.06, 0.03, Materials.wood("#3d2a1c"));
  artFrame.position.set(artX, 1.8, southInteriorZ - 0.015);
  root.add(artFrame);
  const artPanel = box(artWidth, artHeight, 0.01, Materials.sketchPaper(), { castShadow: false });
  artPanel.position.set(artX, 1.8, southInteriorZ - 0.035);
  root.add(artPanel);

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
    wallLightSockets,
    exteriorLightSockets,
    clockHourHand,
    clockMinuteHand,
    bounds: { width, depth, height },
    floorMesh: floor,
    wallColliders,
  };
}
