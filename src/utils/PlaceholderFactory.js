import * as THREE from "three";
import { woodGrainTexture, metalBrushedTexture, paperTexture, blueprintTexture, sketchTexture, sidingTexture, corkTexture } from "./ProceduralTexture.js";

/**
 * PlaceholderFactory
 * ------------------
 * Every furniture builder in /src/entities/furniture/ calls into this file
 * rather than constructing raw THREE geometry/materials itself. That gives
 * us one place to:
 *
 *   1. Keep a consistent "believable, unfussy" placeholder visual style.
 *   2. Swap the whole project onto real models later — e.g. once you have a
 *      GLTF workbench, `PlaceholderFactory.mesh("workbench", ...)` becomes
 *      `GLTFLoader` under the hood and every furniture file is untouched.
 *
 * Materials are cached so we don't create hundreds of near-identical
 * texture/material objects for one room.
 */

const materialCache = new Map();

function cached(key, factory) {
  if (!materialCache.has(key)) materialCache.set(key, factory());
  return materialCache.get(key);
}

export const Materials = {
  wood(color = "#6b4a34") {
    return cached(`wood:${color}`, () => new THREE.MeshStandardMaterial({
      map: woodGrainTexture(color, "#00000055"),
      roughness: 0.75,
      metalness: 0.05,
    }));
  },
  metal(color = "#9a978f") {
    return cached(`metal:${color}`, () => new THREE.MeshStandardMaterial({
      map: metalBrushedTexture(color),
      roughness: 0.4,
      metalness: 0.75,
    }));
  },
  fabric(color = "#3c5a53") {
    return cached(`fabric:${color}`, () => new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0,
    }));
  },
  paper(color = "#ede3d0") {
    return cached(`paper:${color}`, () => new THREE.MeshStandardMaterial({
      map: paperTexture(color),
      roughness: 0.9,
      metalness: 0,
    }));
  },
  blueprint() {
    return cached("blueprint", () => new THREE.MeshStandardMaterial({
      map: blueprintTexture(),
      roughness: 0.85,
      metalness: 0,
    }));
  },
  sketchPaper() {
    return cached("sketchPaper", () => new THREE.MeshStandardMaterial({
      map: sketchTexture(),
      roughness: 0.9,
      metalness: 0,
    }));
  },
  matte(color = "#888888") {
    return cached(`matte:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }));
  },
  // Workshop Workbench phase — "material quality... plastic, rubber."
  // Two real gaps, not previously distinguishable from `matte()` at
  // all — every plastic clipboard, fan housing, or tool handle in the
  // Workshop was using the exact same numbers as a painted metal
  // switch plate. Genuinely different surface behaviour, not just a
  // different name: plastic reads as smooth and a little glossy
  // (lower roughness, a faint highlight); rubber reads as soft and
  // completely non-reflective (roughness pushed close to 1, no
  // highlight at all). Neither is metallic.
  plastic(color = "#3a3a3a") {
    return cached(`plastic:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0 }));
  },
  rubber(color = "#232323") {
    return cached(`rubber:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0 }));
  },
  siding(color = "#5a4a3d") {
    return cached(`siding:${color}`, () => new THREE.MeshStandardMaterial({
      map: sidingTexture(color),
      roughness: 0.9,
      metalness: 0,
    }));
  },
  glass(color = "#bfe6ff") {
    return cached(`glass:${color}`, () => new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      thickness: 0.05,
      transparent: true,
      opacity: 0.35,
    }));
  },
  // Furniture & Storage phase — "pinboard... material quality." The one
  // real cork surface in the Workshop was sharing matte()'s flat colour;
  // this gives it cork's own actual mottled look, the same way paper()
  // and blueprint() already have their own texture rather than a flat
  // tint standing in for one.
  cork(color = "#c79a63") {
    return cached(`cork:${color}`, () => new THREE.MeshStandardMaterial({
      map: corkTexture(color),
      roughness: 0.92,
      metalness: 0,
    }));
  },
  // Decorative Details phase — "materials... ceramic." Every plant pot
  // in the Workshop was sharing matte()'s own numbers for a surface
  // that's almost always glazed ceramic in real life — smoother and
  // very slightly reflective, distinct from plastic's own glossier,
  // completely non-metallic read.
  ceramic(color = "#a9764f") {
    return cached(`ceramic:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 }));
  },
  brass() {
    return cached("brass", () => new THREE.MeshStandardMaterial({ color: "#b8863b", roughness: 0.35, metalness: 0.9 }));
  },
  emissive(color = "#7fd8c4", intensity = 1) {
    return cached(`emissive:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
    }));
  },
};

/** Simple box builder — the workhorse of every placeholder object. */
export function box(width, height, depth, material, { castShadow = true, receiveShadow = true } = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * A box with up to six independent face materials — used for wall segments,
 * which look different from the interior side than the exterior side.
 * `faces` matches BoxGeometry's own default material-group order:
 * `{ px, nx, py, ny, pz, nz }` (right, left, top, bottom, front, back).
 * Any face omitted falls back to `fallback`.
 */
export function multiFaceBox(width, height, depth, faces, fallback) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const order = ["px", "nx", "py", "ny", "pz", "nz"];
  const materials = order.map((key) => faces[key] ?? fallback);
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cylinder(radiusTop, radiusBottom, height, material, radialSegments = 16) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A unit sphere (radius 0.5) — combine with a part's own scale to size it. */
export function sphere(material, widthSegments = 16, heightSegments = 12) {
  const geometry = new THREE.SphereGeometry(0.5, widthSegments, heightSegments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A unit flat plane (1 x 1), facing +z by default. */
export function plane(material) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A small brass tag mesh — used sparingly to mark objects that are
 * intentionally placeholders for a future feature, so it never reads as
 * "unfinished" but as "reserved". Purely visual, no interaction logic.
 */
export function brassTag(width = 0.14, height = 0.04) {
  return box(width, height, 0.005, Materials.brass(), { castShadow: false });
}

/** Group helper: builds a THREE.Group, positions/rotates it, and returns it. */
export function group(position = [0, 0, 0], rotationY = 0) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.rotation.y = rotationY;
  return g;
}

// Version 2 Sign-Off phase — `computeFootprint(object3D)` used to live
// here: a one-line wrapper around `new THREE.Box3().setFromObject()`,
// whose own docstring claimed it was "used by collision + interaction
// radius helpers." It never actually was — every real caller of that
// exact pattern (`WorldObjectsSystem.js`, `LadderSystem.js`) already
// calls `Box3.setFromObject()` directly, and nothing anywhere called
// this wrapper. Removed rather than kept as a second, unused way to do
// the same one-line thing — see docs/REFINEMENT.md's own "Version 2
// Sign-Off" section.
