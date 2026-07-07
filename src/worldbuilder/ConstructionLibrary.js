/**
 * ConstructionLibrary
 * ---------------------
 * "Construction pieces are the alphabet. Everything I build becomes the
 * language." These are permanent, hand-authored `WorkshopObjectDefinition`s
 * — the exact same data shape a Builder-designed object has (see
 * ObjectCompiler.js) — except they're seeded here in code instead of
 * designed at runtime, and they can't be edited or deleted. That's the
 * entire distinction: a *source* of definitions, not a different kind of
 * definition. `ObjectCompiler.compileDefinition()` doesn't know or care
 * which store a definition came from.
 *
 * String ids (`"wall"`, `"door"`, ...) are deliberate — `ObjectLibraryStore`
 * uses auto-incrementing numeric ids, so a construction piece can never
 * collide with a user-authored object's id even if some future code
 * forgets to check `definitionSource` (see WorldObjectsStore.js).
 *
 * Kept intentionally small (16 pieces, matching the brief's own list) and
 * intentionally plain — a neutral, unpainted grey for everything except the
 * Door (the one piece that's actually interactive out of the box, via the
 * `door` behaviour already built for the workshop's own furniture). Nothing
 * here is decoration; each piece exists purely to be assembled into
 * something else.
 */

const RAW_MATERIAL_COLOR = "#a8a095";
const DOOR_COLOR = "#5a4632";

function piece({ id, name, description, parts, behaviours = [] }) {
  return {
    id,
    name,
    description,
    category: "Construction",
    tags: ["construction"],
    defaultScale: 1,
    defaultRotationY: 0,
    parts,
    behaviours,
    version: 1,
    isConstruction: true,
  };
}

function stairSteps(count, riseEach, runEach) {
  return Array.from({ length: count }, (_, i) => ({
    id: `step${i}`,
    type: "box",
    position: [0, riseEach / 2 + i * riseEach, i * runEach],
    rotationY: 0,
    scale: [1.0, riseEach, runEach],
    color: RAW_MATERIAL_COLOR,
  }));
}

export const CONSTRUCTION_PIECES = [
  piece({
    id: "cube",
    name: "Cube",
    description: "A plain 1x1x1 block.",
    parts: [{ id: "a", type: "box", position: [0, 0.5, 0], rotationY: 0, scale: [1, 1, 1], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "plane",
    name: "Plane",
    description: "A flat, generic panel — a sign, a floor tile, whatever it's rotated to be.",
    parts: [{ id: "a", type: "plane", position: [0, 0.5, 0], rotationY: 0, scale: [1, 1, 1], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "wall",
    name: "Wall",
    description: "A standard wall segment, 2m wide.",
    parts: [{ id: "a", type: "box", position: [0, 1.25, 0], rotationY: 0, scale: [2, 2.5, 0.2], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "cornerWall",
    name: "Corner Wall",
    description: "Two wall segments meeting at a right angle, inside corner at the origin.",
    parts: [
      { id: "a", type: "box", position: [1, 1.25, 0], rotationY: 0, scale: [2, 2.5, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "b", type: "box", position: [0, 1.25, 1], rotationY: 0, scale: [0.2, 2.5, 2], color: RAW_MATERIAL_COLOR },
    ],
  }),

  piece({
    id: "floor",
    name: "Floor",
    description: "A 2x2m floor slab.",
    parts: [{ id: "a", type: "box", position: [0, 0.075, 0], rotationY: 0, scale: [2, 0.15, 2], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "ceiling",
    name: "Ceiling",
    description: "A 2x2m ceiling slab.",
    parts: [{ id: "a", type: "box", position: [0, 0.075, 0], rotationY: 0, scale: [2, 0.15, 2], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "roof",
    name: "Roof",
    description: "A single pitched roof panel.",
    parts: [{ id: "a", type: "box", position: [0, 0.75, -0.55], rotationX: 0.35, rotationY: 0, rotationZ: 0, scale: [2.2, 0.1, 1.5], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "roofCorner",
    name: "Roof Corner",
    description: "A smaller angled roof panel for hips and corners — a simplified approximation, not a precise mitre.",
    parts: [{ id: "a", type: "box", position: [0, 0.6, -0.45], rotationX: 0.35, rotationY: Math.PI / 4, rotationZ: 0, scale: [1.4, 0.1, 1.4], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "pillar",
    name: "Pillar",
    description: "A vertical support column, 2.5m tall.",
    parts: [{ id: "a", type: "cylinder", position: [0, 1.25, 0], rotationY: 0, scale: [0.3, 2.5, 0.3], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "doorway",
    name: "Doorway",
    description: "A wall segment with an open doorway already cut into it — pair it with a Door piece.",
    parts: [
      { id: "left", type: "box", position: [-0.75, 1.25, 0], rotationY: 0, scale: [0.5, 2.5, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "right", type: "box", position: [0.75, 1.25, 0], rotationY: 0, scale: [0.5, 2.5, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "header", type: "box", position: [0, 2.3, 0], rotationY: 0, scale: [1.0, 0.4, 0.2], color: RAW_MATERIAL_COLOR },
    ],
  }),

  piece({
    id: "door",
    name: "Door",
    description: "A swinging door, ready to use — carries the same Door behaviour any custom object can.",
    parts: [{ id: "a", type: "box", position: [0, 1.05, 0], rotationY: 0, scale: [0.9, 2.1, 0.05], color: DOOR_COLOR }],
    behaviours: [{ type: "door", properties: { openOffset: 90 } }],
  }),

  piece({
    id: "window",
    name: "Window",
    description: "A wall segment with an open (unglazed) window cut into it.",
    parts: [
      { id: "left", type: "box", position: [-0.75, 1.25, 0], rotationY: 0, scale: [0.5, 2.5, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "right", type: "box", position: [0.75, 1.25, 0], rotationY: 0, scale: [0.5, 2.5, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "sill", type: "box", position: [0, 0.5, 0], rotationY: 0, scale: [1.0, 1.0, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "header", type: "box", position: [0, 2.25, 0], rotationY: 0, scale: [1.0, 0.5, 0.2], color: RAW_MATERIAL_COLOR },
    ],
  }),

  piece({
    id: "stairs",
    name: "Stairs",
    description: "Five ascending steps, rising 1m over 2m of depth.",
    parts: stairSteps(5, 0.2, 0.4),
  }),

  piece({
    id: "ramp",
    name: "Ramp",
    description: "A single inclined panel.",
    parts: [{ id: "a", type: "box", position: [0, 0.35, 0], rotationX: -0.35, rotationY: 0, rotationZ: 0, scale: [1.2, 0.15, 2.4], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "fence",
    name: "Fence",
    description: "Two posts and two rails, 2m wide.",
    parts: [
      { id: "postA", type: "box", position: [-1, 0.5, 0], rotationY: 0, scale: [0.08, 1.0, 0.08], color: RAW_MATERIAL_COLOR },
      { id: "postB", type: "box", position: [1, 0.5, 0], rotationY: 0, scale: [0.08, 1.0, 0.08], color: RAW_MATERIAL_COLOR },
      { id: "railLow", type: "box", position: [0, 0.35, 0], rotationY: 0, scale: [2.0, 0.06, 0.06], color: RAW_MATERIAL_COLOR },
      { id: "railHigh", type: "box", position: [0, 0.75, 0], rotationY: 0, scale: [2.0, 0.06, 0.06], color: RAW_MATERIAL_COLOR },
    ],
  }),

  piece({
    id: "beam",
    name: "Beam",
    description: "A long horizontal support beam, 3m.",
    parts: [{ id: "a", type: "box", position: [0, 0.075, 0], rotationY: 0, scale: [3.0, 0.15, 0.15], color: RAW_MATERIAL_COLOR }],
  }),
];

export function getConstructionPiece(id) {
  return CONSTRUCTION_PIECES.find((p) => p.id === id) ?? null;
}
