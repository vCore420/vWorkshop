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
 * Grown from an original 16 pieces to a curated set organised into four
 * practical groups — Structural, Openings, Workshop, Utilities — "enough
 * to begin constructing meaningful spaces without relying entirely on
 * custom objects." Still intentionally plain: a neutral, unpainted grey
 * for anything structural, warm wood tones for anything furniture-like,
 * and colour reserved for the handful of pieces where it actually means
 * something (the door, the light). Nothing here is decoration for its own
 * sake; each piece exists to be assembled into something else, or to be
 * genuinely useful the moment it's placed.
 */

const RAW_MATERIAL_COLOR = "#a8a095";
const DOOR_COLOR = "#5a4632";
const WOOD_COLOR = "#6b4a34";
const CRATE_COLOR = "#7a5a3a";
const LIGHT_FIXTURE_COLOR = "#e8dcc0";

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
  // ============================================================
  // Structural
  // ============================================================
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
    id: "halfWall",
    name: "Half Wall",
    description: "A knee-high wall segment, 2m wide — a low divider or a railing base.",
    parts: [{ id: "a", type: "box", position: [0, 0.625, 0], rotationY: 0, scale: [2, 1.25, 0.2], color: RAW_MATERIAL_COLOR }],
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
    id: "beam",
    name: "Beam",
    description: "A long horizontal support beam, 3m.",
    parts: [{ id: "a", type: "box", position: [0, 0.075, 0], rotationY: 0, scale: [3.0, 0.15, 0.15], color: RAW_MATERIAL_COLOR }],
  }),

  piece({
    id: "stairs",
    name: "Stairs",
    description: "Five ascending steps, rising 1m over 2m of depth.",
    parts: stairSteps(5, 0.2, 0.4),
  }),

  piece({
    id: "ladder",
    name: "Ladder",
    description: "Two rails and six rungs, 2.4m tall — climbs, doesn't carry a behaviour of its own.",
    parts: [
      { id: "railL", type: "box", position: [-0.28, 1.2, 0], rotationY: 0, scale: [0.06, 2.4, 0.06], color: WOOD_COLOR },
      { id: "railR", type: "box", position: [0.28, 1.2, 0], rotationY: 0, scale: [0.06, 2.4, 0.06], color: WOOD_COLOR },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `rung${i}`,
        type: "cylinder",
        position: [0, 0.25 + i * 0.4, 0],
        rotationY: 0,
        rotationZ: Math.PI / 2,
        scale: [0.04, 0.62, 0.04],
        color: WOOD_COLOR,
      })),
    ],
  }),

  // ============================================================
  // Openings
  // ============================================================
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
    id: "doubleDoor",
    name: "Double Door",
    description: "A wider double-leaf door. Swings open as one panel, the same honest simplification the single Door already makes — see docs/WORLDBUILDER.md.",
    parts: [
      { id: "left", type: "box", position: [-0.46, 1.05, 0], rotationY: 0, scale: [0.88, 2.1, 0.05], color: DOOR_COLOR },
      { id: "right", type: "box", position: [0.46, 1.05, 0], rotationY: 0, scale: [0.88, 2.1, 0.05], color: DOOR_COLOR },
    ],
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
    id: "largeWindow",
    name: "Large Window",
    description: "A wider, taller unglazed window opening — a picture window or a shopfront.",
    parts: [
      { id: "left", type: "box", position: [-1.15, 1.4, 0], rotationY: 0, scale: [0.5, 2.8, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "right", type: "box", position: [1.15, 1.4, 0], rotationY: 0, scale: [0.5, 2.8, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "sill", type: "box", position: [0, 0.3, 0], rotationY: 0, scale: [2.3, 0.6, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "header", type: "box", position: [0, 2.65, 0], rotationY: 0, scale: [2.3, 0.5, 0.2], color: RAW_MATERIAL_COLOR },
    ],
  }),

  piece({
    id: "archway",
    name: "Archway",
    description: "A doorway-width opening with a curved top instead of a flat header, built from the Arch primitive.",
    parts: [
      { id: "left", type: "box", position: [-0.75, 1.0, 0], rotationY: 0, scale: [0.5, 2.0, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "right", type: "box", position: [0.75, 1.0, 0], rotationY: 0, scale: [0.5, 2.0, 0.2], color: RAW_MATERIAL_COLOR },
      { id: "arch", type: "arch", position: [0, 2.0, 0], rotationX: 0, rotationY: 0, rotationZ: 0, scale: [1.9, 1.9, 0.2], color: RAW_MATERIAL_COLOR, segments: 16 },
    ],
  }),

  // ============================================================
  // Workshop
  // ============================================================
  piece({
    id: "table",
    name: "Table",
    description: "A tabletop on four legs, 1.2m x 0.7m, 0.75m tall.",
    parts: [
      { id: "top", type: "box", position: [0, 0.72, 0], rotationY: 0, scale: [1.2, 0.06, 0.7], color: WOOD_COLOR },
      { id: "legFL", type: "box", position: [-0.53, 0.36, 0.29], rotationY: 0, scale: [0.06, 0.72, 0.06], color: WOOD_COLOR },
      { id: "legFR", type: "box", position: [0.53, 0.36, 0.29], rotationY: 0, scale: [0.06, 0.72, 0.06], color: WOOD_COLOR },
      { id: "legBL", type: "box", position: [-0.53, 0.36, -0.29], rotationY: 0, scale: [0.06, 0.72, 0.06], color: WOOD_COLOR },
      { id: "legBR", type: "box", position: [0.53, 0.36, -0.29], rotationY: 0, scale: [0.06, 0.72, 0.06], color: WOOD_COLOR },
    ],
  }),

  piece({
    id: "bench",
    name: "Bench",
    description: "A simple bench seat on four legs, 1.2m x 0.35m, 0.45m tall.",
    parts: [
      { id: "top", type: "box", position: [0, 0.44, 0], rotationY: 0, scale: [1.2, 0.05, 0.35], color: WOOD_COLOR },
      { id: "legL", type: "box", position: [-0.5, 0.21, 0], rotationY: 0, scale: [0.06, 0.42, 0.3], color: WOOD_COLOR },
      { id: "legR", type: "box", position: [0.5, 0.21, 0], rotationY: 0, scale: [0.06, 0.42, 0.3], color: WOOD_COLOR },
    ],
  }),

  piece({
    id: "shelf",
    name: "Shelf",
    description: "An open shelving unit — a back panel, two sides, three boards.",
    parts: [
      { id: "back", type: "box", position: [0, 0.9, -0.14], rotationY: 0, scale: [0.9, 1.8, 0.03], color: WOOD_COLOR },
      { id: "sideL", type: "box", position: [-0.44, 0.9, 0], rotationY: 0, scale: [0.03, 1.8, 0.3], color: WOOD_COLOR },
      { id: "sideR", type: "box", position: [0.44, 0.9, 0], rotationY: 0, scale: [0.03, 1.8, 0.3], color: WOOD_COLOR },
      { id: "boardLow", type: "box", position: [0, 0.3, 0], rotationY: 0, scale: [0.88, 0.03, 0.3], color: WOOD_COLOR },
      { id: "boardMid", type: "box", position: [0, 0.9, 0], rotationY: 0, scale: [0.88, 0.03, 0.3], color: WOOD_COLOR },
      { id: "boardHigh", type: "box", position: [0, 1.5, 0], rotationY: 0, scale: [0.88, 0.03, 0.3], color: WOOD_COLOR },
    ],
  }),

  piece({
    id: "cabinet",
    name: "Cabinet",
    description: "An enclosed storage cabinet, ready to use — carries the Storage behaviour any custom object can.",
    parts: [{ id: "body", type: "box", position: [0, 0.55, 0], rotationY: 0, scale: [0.8, 1.1, 0.4], color: WOOD_COLOR }],
    behaviours: [{ type: "storage", properties: { prompt: "Check the cabinet", capacity: 20 } }],
  }),

  piece({
    id: "storageCrate",
    name: "Storage Crate",
    description: "A small portable crate, ready to use — carries the Storage behaviour any custom object can.",
    parts: [
      { id: "body", type: "box", position: [0, 0.25, 0], rotationY: 0, scale: [0.5, 0.5, 0.5], color: CRATE_COLOR },
      { id: "strapA", type: "box", position: [0, 0.42, 0], rotationY: 0, scale: [0.52, 0.03, 0.52], color: WOOD_COLOR },
      { id: "strapB", type: "box", position: [0, 0.08, 0], rotationY: 0, scale: [0.52, 0.03, 0.52], color: WOOD_COLOR },
    ],
    behaviours: [{ type: "storage", properties: { prompt: "Check the crate", capacity: 8 } }],
  }),

  // ============================================================
  // Utilities
  // ============================================================
  piece({
    id: "light",
    name: "Light",
    description: "A simple ceiling or wall fixture, ready to use — carries the Light Source behaviour any custom object can.",
    parts: [
      { id: "fixture", type: "halfSphere", position: [0, 0.0, 0], rotationX: Math.PI, rotationY: 0, rotationZ: 0, scale: [0.3, 0.2, 0.3], color: LIGHT_FIXTURE_COLOR, segments: 16 },
    ],
    behaviours: [{ type: "lightSource", properties: { color: "#ffdca8", intensity: 0.8, distance: 4 } }],
  }),

  piece({
    id: "switch",
    name: "Switch",
    description: "A small wall-mounted switch plate — carries the Trigger behaviour, so it can be wired to fire any named event a plugin or future system listens for (see docs/PLUGIN_GUIDE.md).",
    parts: [{ id: "plate", type: "box", position: [0, 0, 0], rotationY: 0, scale: [0.1, 0.15, 0.02], color: RAW_MATERIAL_COLOR }],
    behaviours: [{ type: "trigger", properties: { eventName: "switchFlipped" } }],
  }),

  piece({
    id: "sign",
    name: "Sign",
    description: "A post with a flat board on top — a nameplate, a direction marker, whatever it's painted to be.",
    parts: [
      { id: "post", type: "cylinder", position: [0, 0.5, 0], rotationY: 0, scale: [0.05, 1.0, 0.05], color: WOOD_COLOR },
      { id: "board", type: "box", position: [0, 1.05, 0], rotationY: 0, scale: [0.6, 0.35, 0.03], color: WOOD_COLOR },
    ],
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
    id: "gate",
    name: "Gate",
    description: "A fence-styled swinging gate, 1.2m wide — carries the same Door behaviour the Door piece does.",
    parts: [
      { id: "postA", type: "box", position: [-0.6, 0.5, 0], rotationY: 0, scale: [0.08, 1.0, 0.08], color: RAW_MATERIAL_COLOR },
      { id: "postB", type: "box", position: [0.6, 0.5, 0], rotationY: 0, scale: [0.08, 1.0, 0.08], color: RAW_MATERIAL_COLOR },
      { id: "railLow", type: "box", position: [0, 0.35, 0], rotationY: 0, scale: [1.2, 0.06, 0.06], color: RAW_MATERIAL_COLOR },
      { id: "railHigh", type: "box", position: [0, 0.75, 0], rotationY: 0, scale: [1.2, 0.06, 0.06], color: RAW_MATERIAL_COLOR },
    ],
    behaviours: [{ type: "door", properties: { openOffset: 100 } }],
  }),

  piece({
    id: "ramp",
    name: "Ramp",
    description: "A single inclined panel.",
    parts: [{ id: "a", type: "box", position: [0, 0.35, 0], rotationX: -0.35, rotationY: 0, rotationZ: 0, scale: [1.2, 0.15, 2.4], color: RAW_MATERIAL_COLOR }],
  }),
];

export function getConstructionPiece(id) {
  return CONSTRUCTION_PIECES.find((p) => p.id === id) ?? null;
}
