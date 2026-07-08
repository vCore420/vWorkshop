/**
 * layoutDefault
 * -------------
 * The room's geometry and furniture placement expressed as plain data,
 * separate from the code that builds meshes. This is what makes "customisable
 * layouts" (listed in the brief's future philosophy) realistic later: a
 * layout editor just needs to produce an object shaped like this one and
 * hand it to RoomLayoutSystem — it doesn't need to know how any piece of
 * furniture is actually constructed.
 *
 * Units are metres. +x = east, +z = south, +y = up. The room is centred on
 * the origin at floor level (y = 0).
 */

export const ROOM_DIMENSIONS = {
  width: 8, // x
  depth: 6, // z
  height: 3, // y
};

/** Where the player appears on a fresh visit (no save data yet). */
export const DEFAULT_SPAWN = {
  position: [0, 1.65, 2.2],
  yaw: 0, // facing north, into the room, away from the workshop door
};

/**
 * position: [x, y, z] in metres, y is usually 0 (furniture builders place
 * their own geometry relative to the floor).
 * rotationY: radians.
 *
 * The computer desk's side of the room (east, +x) reads top-to-bottom as
 * one walk: sit at the desk, browse the reference shelf, settle into the
 * reading chair, then the music cabinet at the end of the row — the quiet
 * corner the brief asked to relocate here, not spread across the room in
 * a line but grouped the way a real corner would be: shelf and chair close
 * enough to actually use together, the cabinet an easy last few steps
 * further on. Every pair here was checked against
 * FurnitureSystem._computeFootprintBox's actual rotated-AABB math (not
 * just eyeballed) to confirm no two footprints overlap and the walking
 * gaps between them stay comfortable — see docs/WORKBENCH.md's sibling
 * note in docs/ARCHITECTURE.md on how furniture footprints are computed.
 */
export const FURNITURE_LAYOUT = {
  workbench: { position: [-3.35, 0, -0.6], rotationY: Math.PI / 2 },
  toolStorage: { position: [-3.9, 0, 1.35], rotationY: Math.PI / 2 },
  pinboard: { position: [-3.95, 1.55, -2.15], rotationY: Math.PI / 2 },
  computerDesk: { position: [3.15, 0, -2.35], rotationY: -Math.PI / 2 },
  shelving: { position: [3.8, 0, -0.8], rotationY: -Math.PI / 2 },
  sittingArea: { position: [2.3, 0, 0.9], rotationY: -Math.PI * 0.6 },
  musicCabinet: { position: [3.5, 0, 2.15], rotationY: -Math.PI / 2 },
  notebook: { position: [-2.95, 0, -0.15], rotationY: 0.3 },
};

// Note: the z component of each window/door position below is now purely
// documentary — WorkshopRoom.js positions these at the wall's true centre
// (±depth/2) itself, derived from ROOM_DIMENSIONS, since the wall now has
// real thickness and a real cut opening rather than being a flush overlay.
export const WINDOWS = [
  { position: [-2.0, 1.55, -3], width: 1.3, height: 1.3 },
  { position: [1.4, 1.55, -3], width: 1.3, height: 1.3 },
];

export const WORKSHOP_DOOR = {
  position: [0, 0, 3],
  width: 2.6,
  height: 2.3,
};
