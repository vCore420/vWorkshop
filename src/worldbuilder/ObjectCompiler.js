import * as THREE from "three";
import { box, cylinder, sphere, plane, Materials } from "../utils/PlaceholderFactory.js";

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
 * shape.
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

function buildPart(part, colorOverride) {
  const color = colorOverride ?? part.color ?? "#8d8577";
  const material = Materials.matte(color);
  const segments = part.segments ?? 16;

  switch (part.type) {
    case "box":
      return box(1, 1, 1, material);
    case "cylinder":
      return cylinder(0.5, 0.5, 1, material, segments);
    case "cone":
      return cylinder(0, 0.5, 1, material, segments);
    case "sphere":
      return sphere(material, segments, Math.max(8, Math.round(segments * 0.7)));
    case "plane":
      return plane(material);
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
