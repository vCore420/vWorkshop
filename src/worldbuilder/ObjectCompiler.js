import * as THREE from "three";
import { Materials } from "../utils/PlaceholderFactory.js";

/**
 * ObjectCompiler
 * ---------------
 * Turns a WorkshopObjectDefinition's `parts` array into a real
 * `THREE.Group` — nothing more. This is the one function both the
 * Builder app's live preview and `WorldObjectsSystem`'s real placed
 * instances call, so what you see while designing an object is exactly
 * what appears in the world; there is no second code path to drift out of
 * sync.
 *
 * Every part is built as a *unit-sized* primitive and sized entirely
 * through `part.scale` — this keeps the Builder's editable fields down to
 * position/rotation/scale/colour(/segments, for the shapes that need it)
 * for every primitive type, rather than a different set of size fields
 * per shape. See `docs/WORLDBUILDER.md`'s "Preset shapes" section for the
 * full reasoning behind which thirteen shapes made the cut and which
 * suggested ones didn't.
 *
 * It also means the *geometry itself* never varies for a given type (and,
 * for the shapes that use it, segment count) — see `cachedGeometry`
 * below, which shares one geometry instance across every part that needs
 * it instead of building a fresh copy of identical vertex data per part.
 * That matters once a world has any real number of Construction Library
 * pieces in it: a hundred placed "Wall" pieces are a hundred meshes
 * pointing at one shared box geometry, not a hundred separate ones.
 * (Materials were already shared this way — see `PlaceholderFactory.js`'s
 * own cache — this is the geometry-side equivalent, safe for the
 * identical reason: nothing here mutates a part's geometry after
 * creation, only its mesh's position/rotation/scale.)
 *
 * A part's `rotationY` is the only rotation the Builder's UI exposes (see
 * BuilderApp.js) — full 3-axis rotation editing wasn't worth the extra form
 * complexity for hand-authored objects. `rotationX`/`rotationZ` are still
 * read here if present, purely so the hardcoded Construction Library
 * (`ConstructionLibrary.js`) can tilt a roof panel or a ramp — they're an
 * escape hatch for data, not a feature anyone edits through a form.
 */
export function compileDefinition(definition, { colorOverride = null } = {}) {
  const group = new THREE.Group();
  group.name = definition.name;
  for (const part of definition.parts ?? []) {
    const mesh = buildPart(part, colorOverride);
    if (!mesh) continue;
    mesh.position.set(...part.position);
    mesh.rotation.set(part.rotationX ?? 0, part.rotationY ?? 0, part.rotationZ ?? 0);
    mesh.scale.set(...part.scale);
    mesh.userData.partId = part.id;
    group.add(mesh);
  }
  return group;
}

const geometryCache = new Map();

function cachedGeometry(key, factory) {
  if (!geometryCache.has(key)) geometryCache.set(key, factory());
  return geometryCache.get(key);
}

function unitMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---- geometry builders — every one produces a shape roughly bounded by
// a 1x1x1 box centred on the origin, so `part.scale` behaves consistently
// no matter which type is picked. A few (noted individually) prioritise a
// natural "sits flat on its origin" convention over strict bounding-box
// centring, since that's the more useful way to actually place them. ----

function unitBoxGeometry() {
  return cachedGeometry("box", () => new THREE.BoxGeometry(1, 1, 1));
}

function unitPlaneGeometry() {
  return cachedGeometry("plane", () => new THREE.PlaneGeometry(1, 1));
}

function unitCylinderGeometry(segments) {
  return cachedGeometry(`cylinder:${segments}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, segments));
}

function unitConeGeometry(segments) {
  return cachedGeometry(`cone:${segments}`, () => new THREE.CylinderGeometry(0, 0.5, 1, segments));
}

function unitSphereGeometry(segments) {
  const heightSegments = Math.max(8, Math.round(segments * 0.7));
  return cachedGeometry(`sphere:${segments}`, () => new THREE.SphereGeometry(0.5, segments, heightSegments));
}

/** A cone with few enough radial segments to read as a pyramid rather
 *  than a cone — rotated so a flat face points forward instead of an
 *  edge, the way a real pyramid's base aligns to its footprint. */
function unitPyramidGeometry(segments) {
  return cachedGeometry(`pyramid:${segments}`, () => {
    const geo = new THREE.CylinderGeometry(0, 0.5, 1, segments);
    geo.rotateY(Math.PI / segments);
    return geo;
  });
}

/** A right-triangle cross-section extruded sideways — a ramp/wedge either
 *  way, just a matter of which axis you scale. X = slope run, Y = rise,
 *  Z = width. */
function unitWedgeGeometry() {
  return cachedGeometry("wedge", () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, -0.5);
    shape.lineTo(0.5, -0.5);
    shape.lineTo(0.5, 0.5);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -0.5);
    return geo;
  });
}

/** A box with rounded vertical edges — a rounded rectangle profile
 *  extruded for height. The corner radius is a fixed proportion of the
 *  cross-section rather than its own editable field, to keep the part
 *  editor's fields the same for every shape. */
function unitRoundedBoxGeometry() {
  return cachedGeometry("roundedBox", () => {
    const half = 0.5;
    const r = 0.14;
    const shape = new THREE.Shape();
    shape.moveTo(-half + r, -half);
    shape.lineTo(half - r, -half);
    shape.absarc(half - r, -half + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(half, half - r);
    shape.absarc(half - r, half - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-half + r, half);
    shape.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-half, -half + r);
    shape.absarc(-half + r, -half + r, r, Math.PI, Math.PI * 1.5, false);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 6 });
    geo.translate(0, 0, -0.5);
    geo.rotateX(-Math.PI / 2); // the rounded profile becomes the horizontal cross-section; extrusion becomes vertical height
    return geo;
  });
}

/** The top hemisphere only — a dome/cap shape. Deliberately *not*
 *  bounding-box-centred the way every fully-symmetric shape here is: a
 *  dome's flat cut face sits right at the part's own origin (y=0), domed
 *  side extending upward from there, since that's the natural way to
 *  actually place one (a roof cap sitting at a specific height), not
 *  centred through its own middle. */
function unitHalfSphereGeometry(segments) {
  return cachedGeometry(`halfSphere:${segments}`, () => {
    const heightSegments = Math.max(4, Math.round(segments * 0.35));
    return new THREE.SphereGeometry(0.5, segments, heightSegments, 0, Math.PI * 2, 0, Math.PI / 2);
  });
}

/** A quarter-slice of a cylinder — corner trim, a rounded stair edge, a
 *  chunky corner brace. */
function unitQuarterCylinderGeometry(segments) {
  return cachedGeometry(`quarterCylinder:${segments}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, segments, 1, false, 0, Math.PI / 2));
}

/** A genuinely hollow tube — a rectangular wall cross-section (inner
 *  radius to outer radius, top to bottom) revolved around the Y axis, so
 *  it has real inner/outer walls and capped rings top and bottom, not
 *  just a cylinder that looks tube-like from outside. Wall thickness is a
 *  fixed proportion of the radius, the same "keep the field set uniform"
 *  reasoning as the rounded cube's corner radius. */
function unitTubeGeometry(segments) {
  return cachedGeometry(`tube:${segments}`, () => {
    const outerR = 0.5;
    const innerR = 0.34;
    const halfH = 0.5;
    const profile = [
      new THREE.Vector2(innerR, -halfH),
      new THREE.Vector2(outerR, -halfH),
      new THREE.Vector2(outerR, halfH),
      new THREE.Vector2(innerR, halfH),
      new THREE.Vector2(innerR, -halfH),
    ];
    return new THREE.LatheGeometry(profile, segments);
  });
}

/** A full ring (torus) — window frames, portholes, decorative hoops.
 *  Tube thickness is a fixed proportion of the outer radius. */
function unitRingGeometry(segments) {
  return cachedGeometry(`ring:${segments}`, () => {
    const tube = 0.125;
    const radius = 0.5 - tube;
    const radialSegments = Math.max(8, Math.round(segments * 0.6));
    return new THREE.TorusGeometry(radius, tube, radialSegments, segments);
  });
}

/** Half a ring — a genuine arch, the same tube proportions as Ring. */
function unitArchGeometry(segments) {
  return cachedGeometry(`arch:${segments}`, () => {
    const tube = 0.125;
    const radius = 0.5 - tube;
    const radialSegments = Math.max(8, Math.round(segments * 0.6));
    const geo = new THREE.TorusGeometry(radius, tube, radialSegments, segments, Math.PI);
    geo.rotateZ(Math.PI);
    return geo;
  });
}

function buildPart(part, colorOverride) {
  const color = colorOverride ?? part.color ?? "#8d8577";
  const material = Materials.matte(color);
  const segments = part.segments ?? 16;

  switch (part.type) {
    case "box":
      return unitMesh(unitBoxGeometry(), material);
    case "cylinder":
      return unitMesh(unitCylinderGeometry(segments), material);
    case "cone":
      return unitMesh(unitConeGeometry(segments), material);
    case "sphere":
      return unitMesh(unitSphereGeometry(segments), material);
    case "plane":
      return unitMesh(unitPlaneGeometry(), material);
    case "pyramid":
      return unitMesh(unitPyramidGeometry(Math.max(3, segments)), material);
    case "wedge":
      return unitMesh(unitWedgeGeometry(), material);
    case "roundedBox":
      return unitMesh(unitRoundedBoxGeometry(), material);
    case "halfSphere":
      return unitMesh(unitHalfSphereGeometry(segments), material);
    case "quarterCylinder":
      return unitMesh(unitQuarterCylinderGeometry(segments), material);
    case "tube":
      return unitMesh(unitTubeGeometry(segments), material);
    case "ring":
      return unitMesh(unitRingGeometry(segments), material);
    case "arch":
      return unitMesh(unitArchGeometry(segments), material);
    default:
      console.warn(`[ObjectCompiler] unknown part type "${part.type}" — skipping.`);
      return null;
  }
}

/** A fresh, empty part descriptor for the Builder's "Add ..." buttons. */
export function makeDefaultPart(type, id) {
  return {
    id,
    type,
    position: [0, 0.5, 0],
    rotationY: 0,
    scale: [1, 1, 1],
    color: "#8d8577",
    segments: type === "pyramid" ? 4 : 16,
  };
}
