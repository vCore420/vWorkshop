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
 * Every part is built as a *unit-sized* primitive (a 1×1×1 box, a sphere of
 * radius 0.5, etc.) and sized entirely through `part.scale` — this keeps
 * the Builder's editable fields down to position/rotation/scale/colour for
 * every primitive type, rather than a different set of size fields per
 * shape. It also means the *geometry itself* never varies for a given
 * type (and, for cylinder/cone/sphere, segment count) — see
 * `cachedGeometry` below, which shares one geometry instance across every
 * part that needs it instead of building a fresh copy of identical vertex
 * data per part. That matters once a world has any real number of
 * Construction Library pieces in it: a hundred placed "Wall" pieces are a
 * hundred meshes pointing at one shared box geometry, not a hundred
 * separate ones. (Materials were already shared this way — see
 * `PlaceholderFactory.js`'s own cache — this is the geometry-side
 * equivalent, safe for the identical reason: nothing here mutates a part's
 * geometry after creation, only its mesh's position/rotation/scale.)
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

function buildPart(part, colorOverride) {
  const color = colorOverride ?? part.color ?? "#8d8577";
  const material = Materials.matte(color);
  const segments = part.segments ?? 16;

  switch (part.type) {
    case "box":
      return unitMesh(cachedGeometry("box", () => new THREE.BoxGeometry(1, 1, 1)), material);
    case "cylinder":
      return unitMesh(cachedGeometry(`cylinder:${segments}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, segments)), material);
    case "cone":
      return unitMesh(cachedGeometry(`cone:${segments}`, () => new THREE.CylinderGeometry(0, 0.5, 1, segments)), material);
    case "sphere": {
      const heightSegments = Math.max(8, Math.round(segments * 0.7));
      return unitMesh(cachedGeometry(`sphere:${segments}`, () => new THREE.SphereGeometry(0.5, segments, heightSegments)), material);
    }
    case "plane":
      return unitMesh(cachedGeometry("plane", () => new THREE.PlaneGeometry(1, 1)), material);
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
    segments: 16,
  };
}
