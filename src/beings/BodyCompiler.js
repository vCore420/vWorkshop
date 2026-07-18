import * as THREE from "three";
import { Materials } from "../utils/PlaceholderFactory.js";

/**
 * BodyCompiler
 * --------------
 * "Support creating beings entirely from primitive shapes... the Workshop
 * should allow creators to build life from nothing. Not just import it."
 * The same role `ObjectCompiler.js` already plays for Builder objects —
 * turning a plain data description into a real `THREE.Object3D`, nothing
 * more — applied to something ObjectCompiler's own flat, single-root
 * `parts` array was never built for: a genuine parent-child hierarchy,
 * full three-axis rotation per part, and a real skeleton a Workshop
 * animation can actually drive.
 *
 * **Unit geometry + cached, exactly like `ObjectCompiler.js`.** Every
 * shape is built once at a roughly unit size and reused across every part
 * that needs it — `part.scale` does all the sizing, the same "geometry
 * itself never varies" reasoning that file's own comment already gives.
 *
 * **A body part IS a rig joint, when the creator says so — not two
 * separate systems.** "Please optimise for clarity rather than
 * complexity" (the brief's own words, specifically about Rig Creation).
 * Rather than a second, parallel "bones" data structure layered on top of
 * the body hierarchy, any part can carry an optional `jointName` — one of
 * `WorkshopSkeleton.WORKSHOP_JOINTS`' own ids. `compileBody()` derives a
 * complete, exact `skeletonMap`/`skeletonRest` directly from whichever
 * parts were actually tagged — no heuristic name-matching
 * (`WorkshopSkeleton.autoMapSkeleton()`) is ever needed for a primitive
 * body, since the creator declared the mapping explicitly and correctly
 * by construction. The same `AnimationRetargeting.
 * applyPoseToMappedSkeleton()` that drives a retargeted imported model
 * drives a primitive body identically — see `docs/ANIMATION.md`'s own
 * "Shared Animation Architecture" section for why that's the same code
 * path either way.
 */

const geometryCache = new Map();
function cachedGeometry(key, factory) {
  if (!geometryCache.has(key)) geometryCache.set(key, factory());
  return geometryCache.get(key);
}

function unitBoxGeometry() {
  return cachedGeometry("box", () => new THREE.BoxGeometry(1, 1, 1));
}
function unitSphereGeometry() {
  return cachedGeometry("sphere", () => new THREE.SphereGeometry(0.5, 20, 16));
}
function unitCylinderGeometry() {
  return cachedGeometry("cylinder", () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16));
}
/** A real capsule — a cylinder with two hemispherical caps
 *  (`THREE.CapsuleGeometry`, available since Three.js r142; this Workshop
 *  runs r164 — see `index.html`'s own import map). Radius/length chosen
 *  so the whole shape roughly fills the same unit bounding box every
 *  other primitive here does, so `part.scale` behaves consistently no
 *  matter which shape is picked, the same convention
 *  `ObjectCompiler.js`'s own unit geometries already establish. */
function unitCapsuleGeometry() {
  return cachedGeometry("capsule", () => new THREE.CapsuleGeometry(0.3, 0.4, 4, 12));
}

const SHAPE_BUILDERS = { box: unitBoxGeometry, sphere: unitSphereGeometry, cylinder: unitCylinderGeometry, capsule: unitCapsuleGeometry };

/** `{id, label}` — the four primitive types this phase's own brief names
 *  explicitly. "Future primitive types" is one more entry in
 *  `SHAPE_BUILDERS`/`BODY_PART_SHAPES` away, the same "avoid hardcoded
 *  assumptions wherever practical" instinct every other Workshop registry
 *  already follows. */
export const BODY_PART_SHAPES = [
  { id: "box", label: "Cube" },
  { id: "sphere", label: "Sphere" },
  { id: "cylinder", label: "Cylinder" },
  { id: "capsule", label: "Capsule" },
];

let _nextPartId = 1;

export function nextBodyPartId() {
  return `body-part-${_nextPartId++}`;
}

/** A fresh, reasonable-looking part descriptor for the "Add Part" button
 *  — small enough not to swallow whatever it's parented to, positioned a
 *  little above its parent's own origin rather than exactly on top of it,
 *  so a freshly-added part is at least visible immediately rather than
 *  needing every field touched before it means anything. */
export function makeDefaultBodyPart(id, { parentId = null, shape = "box" } = {}) {
  return {
    id,
    name: "New Part",
    parentId,
    jointName: null,
    shape,
    position: [0, 0.3, 0],
    rotation: [0, 0, 0],
    scale: [0.3, 0.3, 0.3],
    color: "#8d8577",
  };
}

/** Every id in `bodyParts` that is `partId` itself, or a descendant of it
 *  (a child, a child's child, and so on) — the set a parent-selection
 *  dropdown must exclude so re-parenting can never create a cycle. Pure,
 *  no mutation, safe to call on every render since a body rarely has more
 *  than a few dozen parts. */
export function descendantIds(bodyParts, partId) {
  const result = new Set([partId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const part of bodyParts) {
      if (result.has(part.parentId) && !result.has(part.id)) {
        result.add(part.id);
        grew = true;
      }
    }
  }
  result.delete(partId); // the part's own id was only ever a seed for the walk, not a "descendant of itself"
  return result;
}

/** Builds a full hierarchical `THREE.Group` from a flat `bodyParts` array
 *  (each with its own `parentId`) — a genuine parent-child scene graph,
 *  not the single-root, flat structure `ObjectCompiler.compileDefinition()`
 *  produces for static furniture. Every mesh carries `userData.partId`,
 *  the identical convention `ObjectCompiler.js` already uses, so the
 *  Being Creator's own selection-highlight logic works exactly the same
 *  way `BuilderApp.js`'s already does. Returns `{root, skeletonMap,
 *  skeletonRest}` — see this file's own module comment for why the
 *  skeleton needs no heuristic detection here. */
/** A part's own `position`/`rotation`/`scale` missing or malformed used
 *  to throw straight out of `compileBody()` — `mesh.rotation.set(...undefined)`
 *  is a hard `TypeError`, not a bug this file caught anywhere. Since the
 *  loop below builds every mesh before parenting any of them, that threw
 *  partway through a Being's own root group, leaving it with *zero*
 *  children — a real, already-placed `BeingInstanceStore` record with
 *  nothing whatsoever to show for it, and no retry: `BeingController
 *  ._spawnRuntime()` had already registered the runtime before calling
 *  this, so `_reconcile()` never calls it again. Every field here now
 *  falls back to `makeDefaultBodyPart()`'s own default (a well-formed
 *  part authored entirely through the Being Creator's own UI already has
 *  real values for all three; this defends against a hand-edited or
 *  imported file that doesn't, matching `BeingLibrary.importDefinition()`'s
 *  own "never trust the file" standard for every other field). */
function normalizedVec3(value, fallback) {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n)) ? value : fallback;
}

export function compileBody(bodyParts) {
  const root = new THREE.Group();
  root.name = "body-root";
  const nodesById = new Map();

  for (const part of bodyParts) {
    const geometry = (SHAPE_BUILDERS[part.shape] ?? unitBoxGeometry)();
    const mesh = new THREE.Mesh(geometry, Materials.matte(part.color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = part.name || part.id;
    mesh.userData.partId = part.id;
    mesh.position.set(...normalizedVec3(part.position, [0, 0.3, 0]));
    mesh.rotation.set(...normalizedVec3(part.rotation, [0, 0, 0]));
    mesh.scale.set(...normalizedVec3(part.scale, [0.3, 0.3, 0.3]));
    nodesById.set(part.id, mesh);
  }

  // A second pass to parent them — every node needs to already exist
  // before any of them can be attached to each other, regardless of
  // which order they happen to appear in the array (a child is not
  // guaranteed to come after its own parent).
  for (const part of bodyParts) {
    const node = nodesById.get(part.id);
    const parentNode = part.parentId ? nodesById.get(part.parentId) : null;
    (parentNode ?? root).add(node);
  }

  const skeletonMap = {};
  const skeletonRest = {};
  for (const part of bodyParts) {
    if (!part.jointName) continue;
    const node = nodesById.get(part.id);
    skeletonMap[part.jointName] = node;
    skeletonRest[part.jointName] = node.quaternion.clone();
  }

  return { root, skeletonMap, skeletonRest };
}

const SIDE_SWAP_PATTERN = /\b(left|right)\b/i;
const JOINT_SIDE_SWAP = Object.fromEntries(
  ["upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg", "foot"].flatMap((kind) => [
    [`${kind}Left`, `${kind}Right`],
    [`${kind}Right`, `${kind}Left`],
  ])
);

function swapSideText(text) {
  return text.replace(SIDE_SWAP_PATTERN, (match) => {
    const lower = match.toLowerCase();
    const swapped = lower === "left" ? "right" : "left";
    return match[0] === match[0].toUpperCase() ? swapped[0].toUpperCase() + swapped.slice(1) : swapped;
  });
}

/** "Mirroring parts. Symmetry tools." Duplicates `partId` and every one
 *  of its own descendants (an entire arm, say, not just one bone) as a
 *  sibling of the original — reflected across the body's own centre
 *  plane (negating X position and the Y/Z rotation components that a
 *  YZ-plane reflection actually flips), with `jointName`/`name` swapped
 *  Left↔Right wherever that text or joint id appears. Returns a fresh
 *  array of new parts only (never mutates `bodyParts`); a caller
 *  concatenates it onto their own array. Mirroring a part with no
 *  "Left"/"Right" in its own name or joint id still works — it's simply
 *  a geometric reflection with an unchanged name and joint assignment,
 *  which is honestly what "mirror" means for something that isn't
 *  side-specific to begin with. */
export function mirrorSubtree(bodyParts, partId) {
  const subtreeIds = new Set([partId, ...descendantIds(bodyParts, partId)]);
  const source = bodyParts.filter((p) => subtreeIds.has(p.id));
  const idMap = new Map(source.map((p) => [p.id, nextBodyPartId()]));
  const originalParentId = bodyParts.find((p) => p.id === partId)?.parentId ?? null;

  return source.map((part) => ({
    ...part,
    id: idMap.get(part.id),
    name: swapSideText(part.name),
    parentId: part.id === partId ? originalParentId : idMap.get(part.parentId), // the mirrored root becomes a sibling of the original; every other part keeps its place inside the newly-cloned subtree
    jointName: part.jointName ? (JOINT_SIDE_SWAP[part.jointName] ?? part.jointName) : null,
    position: [-part.position[0], part.position[1], part.position[2]],
    rotation: [part.rotation[0], -part.rotation[1], -part.rotation[2]],
    scale: [...part.scale],
  }));
}
