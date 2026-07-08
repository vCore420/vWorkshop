/**
 * GhostPreview
 * --------------
 * "During movement the object should become a transparent placement
 * preview identical to new object placement" — this is the one mechanic
 * both flows share. Placing something new and repositioning something
 * that already exists end up looking and feeling identical because they
 * both go through the exact same two functions here.
 *
 * `makeTransparent` clones every material it touches before modifying it —
 * never mutates in place. That's not caution for its own sake: materials
 * for a given colour are shared/cached (`PlaceholderFactory.js`'s own
 * cache, and every Builder object's *geometry* is shared the same way —
 * see `ObjectCompiler.js`), so setting `.opacity` directly on a live
 * mesh's material would make *every other object using that same cached
 * material* transparent too. `restoreMaterials`/`disposeGhostMaterials`
 * are equally careful never to touch `.geometry` for the same reason: a
 * ghost's geometry almost always belongs to that shared cache, not to the
 * ghost, and disposing it would break every other placed copy of that
 * shape.
 */
import * as THREE from "three";

const GHOST_OPACITY = 0.45;

/**
 * Clones and dims every material on `object3D`, returning a Map of
 * mesh -> original material (or array of materials) so the exact same
 * references can be restored later with `restoreMaterials`.
 */
export function makeTransparent(object3D) {
  const originals = new Map();
  object3D.traverse((child) => {
    if (!child.isMesh) return;
    const wasArray = Array.isArray(child.material);
    const mats = wasArray ? child.material : [child.material];
    originals.set(child, child.material);
    const clones = mats.map((m) => {
      const clone = m.clone();
      clone.transparent = true;
      clone.opacity = GHOST_OPACITY;
      clone.depthWrite = false; // avoids sorting artefacts between a see-through preview and whatever's behind it
      return clone;
    });
    child.material = wasArray ? clones : clones[0];
  });
  return originals;
}

/** Restores each mesh's original material reference and disposes the
 *  temporary transparent clones — safe, since those clones were only ever
 *  used by this one ghost. Use this for a *moved existing* object, which
 *  needs its real material back either way (confirmed or cancelled). */
export function restoreMaterials(originals) {
  for (const [mesh, original] of originals) {
    const current = mesh.material;
    mesh.material = original;
    for (const m of Array.isArray(current) ? current : [current]) m.dispose();
  }
}

/** Disposes a *freshly compiled* ghost's transparent materials — used when
 *  a brand-new placement is cancelled, or once it's confirmed and a real,
 *  separately-compiled instance takes its place. Deliberately does not
 *  touch `.geometry` anywhere in the traversal — see this file's own
 *  top comment for why that would be a real, if easy to miss, bug. */
export function disposeGhostMaterials(object3D) {
  object3D.traverse((child) => {
    if (!child.isMesh) return;
    for (const m of Array.isArray(child.material) ? child.material : [child.material]) m.dispose();
  });
}

/** A simple crosshair-style default: straight ahead, at a comfortable
 *  placement distance, before any hover/drag has happened yet. */
export function defaultGhostPoint(camera, distance = 2.2) {
  const point = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(distance);
  point.add(camera.position);
  return point;
}
