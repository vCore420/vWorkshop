import * as THREE from "three";
import { debounce } from "../utils/debounce.js";

const GRID_CELL_SIZE = 0.5; // metres — coarse enough for a fast flood-fill, fine enough to recognise an ordinary room
const GRID_HALF_EXTENT = 40; // metres — the build area this system considers, centred on the Workshop; a flood-fill needs *some* bound to have a guaranteed "outside" to start from
const WALL_MIN_HEIGHT = 1.6; // metres — how tall a placed object's own bounding box must be to count as a wall-like enclosure piece, not furniture
const WALL_MAX_BASE_Y = 1.2; // metres — a wall-like piece must actually reach up from near the ground, not start partway up (a shelf, a floating sign)
const DEFAULT_INTERIOR_HEIGHT = 3.2; // metres — used when no roof/ceiling piece is found above a detected enclosure
const DETECTION_DEBOUNCE_MS = 700;

/**
 * BuildingDetectionSystem
 * --------------------------
 * "Whenever a player constructs an enclosed building, the Workshop should
 * naturally recognise it as an interior... players should never need to
 * manually mark a building as an interior. The world should simply
 * understand enclosed spaces." This is that recognition.
 *
 * Deliberately geometric, not based on which specific construction piece
 * was used — "avoid creating hardcoded world content" applies just as
 * much here as to any other system. Any placed World Object whose own
 * real bounding box (`WorldObjectsSystem.getFootprints()` — the exact
 * same real, per-object boxes collision already uses, not a separate
 * copy) is tall enough and low enough to plausibly be a wall counts as an
 * enclosure piece, whether it's the built-in "wall" construction piece, a
 * custom-designed object, or an imported model used as a wall. A table or
 * a bench never qualifies; a door, window, or archway — every one tall
 * enough to reach from near the floor to well above head height — does.
 *
 * **A coarse 2D flood-fill, not true 3D voxel analysis.** A single
 * horizontal grid (`GRID_CELL_SIZE` cells, over a bounded build area
 * around the Workshop) marks cells overlapping a wall-like footprint as
 * blocked, then floods inward from the grid's own guaranteed-outside
 * edge; whatever never gets reached is enclosed. Grouping enclosed cells
 * into connected regions and taking each region's own bounding box is
 * what actually gets registered with `InteriorSystem.registerVolume()`
 * — the exact same system, and the exact same call, `RoomLayoutSystem.js`
 * already uses for the Workshop's own room. Neither one is a special
 * case the other needs to know about.
 *
 * **Real, acknowledged limitations, not hidden ones**: this is a single
 * horizontal slice, not a full 3D volume — a building with a floor that
 * doesn't align with the Workshop's own ground level, or an oddly-shaped
 * multi-storey structure, isn't something this system reasons about.
 * Detected regions get a flat default height (or the tallest nearby wall
 * piece's own height, if one's found) rather than a roofline actually
 * traced in 3D. "Avoid overcomplicating" — a believable approximation
 * covering the ordinary case (a player builds a room with four walls and
 * a doorway) matters more here than a fully general solution.
 */
export class BuildingDetectionSystem {
  constructor({ worldObjectsStore, worldObjectsSystem, interiorSystem }) {
    this.worldObjectsStore = worldObjectsStore;
    this.worldObjectsSystem = worldObjectsSystem;
    this.interiorSystem = interiorSystem;
    // Debounced, not run on every single placement/move — "instances:changed"
    // can fire many times a second while a player drags something around;
    // the flood-fill only needs to run once things have actually settled.
    this._scheduleDetection = debounce(() => this._detect(), DETECTION_DEBOUNCE_MS);
    this._disposers = []; // every InteriorSystem.registerVolume() disposer from the last detection pass
  }

  init(engine) {
    this.engine = engine;
    this._scheduleDetection();
    this._offChanged = this.worldObjectsStore.events.on("instances:changed", () => this._scheduleDetection());
  }

  _detect() {
    const wallBoxes = this._collectWallLikeFootprints();
    const regions = wallBoxes.length ? this._floodFillEnclosures(wallBoxes) : [];

    for (const dispose of this._disposers) dispose();
    this._disposers = regions.map((box) => this.interiorSystem.registerVolume(box));
  }

  _collectWallLikeFootprints() {
    const footprints = this.worldObjectsSystem?.getFootprints() ?? [];
    const walls = [];
    for (const box of footprints) {
      const height = box.max.y - box.min.y;
      if (height >= WALL_MIN_HEIGHT && box.min.y <= WALL_MAX_BASE_Y) walls.push(box);
    }
    return walls;
  }

  _floodFillEnclosures(wallBoxes) {
    const cellsPerSide = Math.round((GRID_HALF_EXTENT * 2) / GRID_CELL_SIZE);
    const blocked = new Uint8Array(cellsPerSide * cellsPerSide);
    const toIndex = (cx, cz) => cz * cellsPerSide + cx;
    const toCell = (worldX, worldZ) => ({
      cx: Math.floor((worldX + GRID_HALF_EXTENT) / GRID_CELL_SIZE),
      cz: Math.floor((worldZ + GRID_HALF_EXTENT) / GRID_CELL_SIZE),
    });

    let tallestWallHeight = DEFAULT_INTERIOR_HEIGHT;
    for (const box of wallBoxes) {
      const min = toCell(box.min.x, box.min.z);
      const max = toCell(box.max.x, box.max.z);
      const height = box.max.y - box.min.y;
      if (height > tallestWallHeight) tallestWallHeight = height;
      for (let cz = Math.max(0, min.cz); cz <= Math.min(cellsPerSide - 1, max.cz); cz++) {
        for (let cx = Math.max(0, min.cx); cx <= Math.min(cellsPerSide - 1, max.cx); cx++) {
          blocked[toIndex(cx, cz)] = 1;
        }
      }
    }

    // Flood-fill from the grid's own outer edge — guaranteed to be
    // "outside" anything a player could plausibly have built within the
    // considered area. Anything this never reaches is enclosed.
    const visited = new Uint8Array(cellsPerSide * cellsPerSide);
    const queue = [];
    for (let cx = 0; cx < cellsPerSide; cx++) {
      queue.push([cx, 0], [cx, cellsPerSide - 1]);
    }
    for (let cz = 0; cz < cellsPerSide; cz++) {
      queue.push([0, cz], [cellsPerSide - 1, cz]);
    }
    while (queue.length) {
      const [cx, cz] = queue.pop();
      if (cx < 0 || cz < 0 || cx >= cellsPerSide || cz >= cellsPerSide) continue;
      const idx = toIndex(cx, cz);
      if (visited[idx] || blocked[idx]) continue;
      visited[idx] = 1;
      queue.push([cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]);
    }

    // Group unreached, unblocked cells into connected regions.
    const regionOf = new Int32Array(cellsPerSide * cellsPerSide).fill(-1);
    const regions = [];
    for (let cz = 0; cz < cellsPerSide; cz++) {
      for (let cx = 0; cx < cellsPerSide; cx++) {
        const idx = toIndex(cx, cz);
        if (visited[idx] || blocked[idx] || regionOf[idx] !== -1) continue;

        const regionId = regions.length;
        const stack = [[cx, cz]];
        let minCx = cx, maxCx = cx, minCz = cz, maxCz = cz;
        let cellCount = 0;
        while (stack.length) {
          const [scx, scz] = stack.pop();
          if (scx < 0 || scz < 0 || scx >= cellsPerSide || scz >= cellsPerSide) continue;
          const sIdx = toIndex(scx, scz);
          if (visited[sIdx] || blocked[sIdx] || regionOf[sIdx] !== -1) continue;
          regionOf[sIdx] = regionId;
          cellCount++;
          minCx = Math.min(minCx, scx);
          maxCx = Math.max(maxCx, scx);
          minCz = Math.min(minCz, scz);
          maxCz = Math.max(maxCz, scz);
          stack.push([scx + 1, scz], [scx - 1, scz], [scx, scz + 1], [scx, scz - 1]);
        }

        // A single stray unenclosed cell (or a tiny sliver from grid
        // rounding at a wall's own edge) isn't a room — require a
        // sensible minimum footprint before calling it a building.
        if (cellCount < 4) continue;

        const worldMinX = minCx * GRID_CELL_SIZE - GRID_HALF_EXTENT;
        const worldMaxX = (maxCx + 1) * GRID_CELL_SIZE - GRID_HALF_EXTENT;
        const worldMinZ = minCz * GRID_CELL_SIZE - GRID_HALF_EXTENT;
        const worldMaxZ = (maxCz + 1) * GRID_CELL_SIZE - GRID_HALF_EXTENT;
        regions.push(new THREE.Box3(new THREE.Vector3(worldMinX, 0, worldMinZ), new THREE.Vector3(worldMaxX, tallestWallHeight, worldMaxZ)));
      }
    }
    return regions;
  }

  dispose() {
    this._scheduleDetection.cancel();
    this._offChanged?.();
    for (const dispose of this._disposers) dispose();
  }
}
