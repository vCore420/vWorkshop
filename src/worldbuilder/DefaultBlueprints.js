/**
 * DefaultBlueprints
 * -------------------
 * Version 3, Phase 5 ("Beyond One Building") — "pre-made blueprints so
 * the player can see that, by default, good things can be made with the
 * default building blocks... to give the player ideas on what is
 * capable." Three starter interiors, built almost entirely from existing
 * Construction Library pieces, the same "connect before adding" standard
 * every other phase this version has held itself to — with one small,
 * genuine exception: sealing Sunlit Room's own window needed a piece
 * that didn't exist yet (`windowPane`/`largeWindowPane`, see
 * `ConstructionLibrary.js`), added as a permanent library addition
 * rather than a one-off hack local to this file, so any player gets the
 * same capability.
 *
 * Every wall/doorway/window/floor/ceiling piece here is exactly 2m wide
 * by the Construction Library's own convention (confirmed against the
 * real piece dimensions, not assumed), so every room below sits on a
 * clean 2m grid with zero gaps or overlaps by construction. Every
 * piece's own placement origin is at its own base-centre (again, the
 * Construction Library's own established convention — confirmed, not
 * assumed), except `lantern`, whose two parts are both centred on its
 * own local origin, so it's positioned directly at the height it should
 * hang from rather than a base.
 *
 * Every exterior opening here is sealed, and each in the same shape:
 * a `doorway`/`window` frame paired with a second piece that actually
 * closes it (`door`, `windowPane`) — `BuildingDetectionSystem`'s own
 * flood-fill needs a genuinely sealed boundary to recognise an
 * enclosure at all (an open gap lets the flood-fill pour straight
 * through), so a bare frame alone wouldn't register as an interior
 * until a player happened to add the second piece. `Two-Room Cottage`'s
 * own interior connecting doorway is the one exception — deliberately
 * left without a leaf, since it doesn't affect the *outer* seal either
 * way, and a permanently open threshold between two rooms of the same
 * building reads as an intentional, welcoming choice, not an oversight.
 *
 * See `BlueprintStore.js` for how these get seeded (constructor default,
 * only ever overridden once a player has real saved blueprint data of
 * their own — including if they deleted every one of these, which is
 * respected exactly as much as any of their own custom work would be).
 */

const HALF_TURN = Math.PI / 2;

function piece(definitionId, offset, rotationY = 0) {
  return { definitionId, definitionSource: "construction", offset, rotationY, scale: 1, colorOverride: null };
}

/** "Simple Shed" — 2m x 2m, one room. The smallest possible enclosed
 *  space: three solid walls, one real doorway, a floor, a ceiling, and
 *  one small lantern so it's not pitch dark inside. */
const SIMPLE_SHED = [
  piece("floor", [0, 0, 0]),
  piece("ceiling", [0, 2.5, 0]),
  piece("wall", [0, 0, -1], 0), // north
  piece("wall", [1, 0, 0], HALF_TURN), // east
  piece("wall", [-1, 0, 0], HALF_TURN), // west
  piece("doorway", [0, 0, 1], 0), // south — entry
  piece("door", [0, 0, 1], 0),
  piece("lantern", [0.7, 2.1, -0.7]),
];

/** "Sunlit Room" — 4m x 4m, one room. Two wall segments per side, floored
 *  and ceilinged with four tiles each, lit by two lanterns and a real,
 *  genuinely sealed window on the west wall.
 *
 *  A `window` piece alone is an open, unglazed opening by design (posts
 *  either side, but its own sill is only 1m tall and its header doesn't
 *  start until 2m up, so nothing at "wall height" ever spans the gap
 *  between them) — `BuildingDetectionSystem`'s flood-fill used to treat
 *  that gap exactly like an un-doored doorway and pour straight through
 *  it. Paired with a `windowPane` — a new piece added specifically to
 *  resolve this, the same "pair an opening with a piece that seals it"
 *  idea `doorway`/`door` already established — the opening genuinely
 *  seals: the pane's own single box spans the window's full frame
 *  height (tall enough and low enough to register as wall-like on its
 *  own), which also means it blocks walking through where the glass
 *  would be, not just satisfies detection. See `docs/WORLD.md`'s
 *  "Interior Recognition" section for the full account. Every *other*
 *  exterior opening across all three starter blueprints still pairs a
 *  `doorway` with a real, closed `door` — a window is one more sealable
 *  opening now, not a replacement for that pattern. */
const SUNLIT_ROOM = [
  piece("floor", [-1, 0, -1]),
  piece("floor", [1, 0, -1]),
  piece("floor", [-1, 0, 1]),
  piece("floor", [1, 0, 1]),
  piece("ceiling", [-1, 2.5, -1]),
  piece("ceiling", [1, 2.5, -1]),
  piece("ceiling", [-1, 2.5, 1]),
  piece("ceiling", [1, 2.5, 1]),
  piece("wall", [-1, 0, -2], 0), // north
  piece("wall", [1, 0, -2], 0),
  piece("wall", [-1, 0, 2], 0), // south
  piece("doorway", [1, 0, 2], 0), // south — entry
  piece("door", [1, 0, 2], 0),
  piece("wall", [2, 0, -1], HALF_TURN), // east
  piece("wall", [2, 0, 1], HALF_TURN),
  piece("wall", [-2, 0, -1], HALF_TURN), // west
  piece("window", [-2, 0, 1], HALF_TURN),
  piece("windowPane", [-2, 0, 1], HALF_TURN),
  piece("lantern", [-1.5, 2.1, -1.5]),
  piece("lantern", [1.5, 2.1, 1.5]),
];

/** "Two-Room Cottage" — 8m x 4m, two 4m x 4m rooms side by side, divided
 *  by one interior wall. A rectangle-plus-divider rather than a true
 *  L-shape — the same "two connected rooms" feel with a lot less corner
 *  geometry to get wrong. Room A (west half) has the only exterior
 *  entry; the interior doorway connecting the two rooms is deliberately
 *  left without a door leaf (see this file's own top comment). */
const TWO_ROOM_COTTAGE = [
  // Floor + ceiling — 4 columns x 2 rows across the full 8x4 footprint.
  piece("floor", [-3, 0, -1]), piece("floor", [-3, 0, 1]),
  piece("floor", [-1, 0, -1]), piece("floor", [-1, 0, 1]),
  piece("floor", [1, 0, -1]), piece("floor", [1, 0, 1]),
  piece("floor", [3, 0, -1]), piece("floor", [3, 0, 1]),
  piece("ceiling", [-3, 2.5, -1]), piece("ceiling", [-3, 2.5, 1]),
  piece("ceiling", [-1, 2.5, -1]), piece("ceiling", [-1, 2.5, 1]),
  piece("ceiling", [1, 2.5, -1]), piece("ceiling", [1, 2.5, 1]),
  piece("ceiling", [3, 2.5, -1]), piece("ceiling", [3, 2.5, 1]),
  // North wall — 4 segments, x: -4 to 4.
  piece("wall", [-3, 0, -2], 0),
  piece("wall", [-1, 0, -2], 0),
  piece("wall", [1, 0, -2], 0),
  piece("wall", [3, 0, -2], 0),
  // South wall — 4 segments, one replaced by the only exterior entry (Room A).
  piece("doorway", [-3, 0, 2], 0),
  piece("door", [-3, 0, 2], 0),
  piece("wall", [-1, 0, 2], 0),
  piece("wall", [1, 0, 2], 0),
  piece("wall", [3, 0, 2], 0),
  // East wall — 2 segments, z: -2 to 2.
  piece("wall", [4, 0, -1], HALF_TURN),
  piece("wall", [4, 0, 1], HALF_TURN),
  // West wall — 2 segments, z: -2 to 2.
  piece("wall", [-4, 0, -1], HALF_TURN),
  piece("wall", [-4, 0, 1], HALF_TURN),
  // Interior dividing wall (x=0) — one solid segment, one open doorway
  // connecting the two rooms (no door leaf — see this file's own top comment).
  piece("wall", [0, 0, -1], HALF_TURN),
  piece("doorway", [0, 0, 1], HALF_TURN),
  // Lights — one per room, plus one near the entry.
  piece("lantern", [-3.3, 2.1, -1.3]),
  piece("lantern", [-2.7, 2.1, 1.7]),
  piece("lantern", [2.7, 2.1, -1.7]),
];

/** Keyed by a stable id (not a display name) so re-seeding an existing
 *  save (see `BlueprintStore.load()`) never risks a duplicate — the same
 *  reasoning `BlueprintStore.create()`'s own generated ids already
 *  follow, just fixed instead of timestamped. */
export const DEFAULT_BLUEPRINTS = {
  "default-simple-shed": { id: "default-simple-shed", name: "Simple Shed", objects: SIMPLE_SHED, createdAt: "2026-01-01T00:00:00.000Z" },
  "default-sunlit-room": { id: "default-sunlit-room", name: "Sunlit Room", objects: SUNLIT_ROOM, createdAt: "2026-01-01T00:00:00.000Z" },
  "default-two-room-cottage": { id: "default-two-room-cottage", name: "Two-Room Cottage", objects: TWO_ROOM_COTTAGE, createdAt: "2026-01-01T00:00:00.000Z" },
};
