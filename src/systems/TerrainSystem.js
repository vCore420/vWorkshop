import * as THREE from "three";
import { terrainDetailTexture } from "../utils/ProceduralTexture.js";

const TERRAIN_SIZE = 200; // metres — the Workshop's entire primary ground, not a small patch layered above a second one; see this file's own module comment
const TERRAIN_SEGMENTS = 100; // 2m resolution — coarser than the original 1m (see module comment's own note on the trade-off), still fine enough for real sculpting
const GRID_POINTS = TERRAIN_SEGMENTS + 1; // 101x101 vertices
const HALF_SIZE = TERRAIN_SIZE / 2;
const MAX_HEIGHT = 4; // metres — a generous hill, never a cliff that swallows the Workshop itself
const MIN_HEIGHT = -2.5; // a shallow basin — enough for a pond bed, not a canyon
const SKIRT_OUTER_SIZE = 2000; // metres — a large, flat, non-editable extension well beyond any reasonable render distance or walking distance, so the Workshop's grounds never visibly just stop; see _buildSkirt()

/** "Paint terrain materials... grass, dirt, rock, sand, gravel, mud."
 *  Plain vertex colours, blended by ordinary linear interpolation at
 *  paint time — no texture splatting, no shader work, the same
 *  "genuinely real, deliberately simple" standard `AnimationPlayback.js`'s
 *  own Euler-lerp interpolation already holds itself to. Index 0
 *  ("grass") is every vertex's own starting material. */
export const TERRAIN_MATERIALS = [
  { id: "grass", label: "Grass", color: "#5c8a42" },
  { id: "dirt", label: "Dirt", color: "#6b5238" },
  { id: "rock", label: "Rock", color: "#8c8880" },
  { id: "sand", label: "Sand", color: "#d8c98a" },
  { id: "gravel", label: "Gravel", color: "#a89e88" },
  { id: "mud", label: "Mud", color: "#4a3826" },
  { id: "path", label: "Path", color: "#7a6a52" },
];

const MATERIAL_COLOR = TERRAIN_MATERIALS.map((m) => new THREE.Color(m.color));

// One-time migration support — see load()'s own comment. The exact
// dimensions the original (pre-Reliability-phase) terrain patch used,
// kept here only so an existing save's sculpting can be placed correctly
// onto the new, larger grid; nothing else in this file uses these.
const OLD_TERRAIN_SIZE = 48;
const OLD_TERRAIN_SEGMENTS = 48;
const OLD_GRID_POINTS = OLD_TERRAIN_SEGMENTS + 1; // 49x49
const OLD_HALF_SIZE = OLD_TERRAIN_SIZE / 2;

function oldWorldToGrid(coord) {
  return ((coord + OLD_HALF_SIZE) / OLD_TERRAIN_SIZE) * OLD_TERRAIN_SEGMENTS;
}

/** Bilinear sample of an old-format (49x49) flat array at fractional
 *  old-grid coordinates — the same interpolation `getHeightAt()` already
 *  does for live queries, reused here for the one-time migration. */
function sampleOldGrid(oldArray, fx, fz) {
  const gx0 = Math.floor(fx);
  const gz0 = Math.floor(fz);
  const gx1 = Math.min(gx0 + 1, OLD_GRID_POINTS - 1);
  const gz1 = Math.min(gz0 + 1, OLD_GRID_POINTS - 1);
  const tx = fx - gx0;
  const tz = fz - gz0;
  const h00 = oldArray[gz0 * OLD_GRID_POINTS + gx0];
  const h10 = oldArray[gz0 * OLD_GRID_POINTS + gx1];
  const h01 = oldArray[gz1 * OLD_GRID_POINTS + gx0];
  const h11 = oldArray[gz1 * OLD_GRID_POINTS + gx1];
  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * tz;
}

function gridToWorldX(gx) {
  return (gx / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
}
function gridToWorldZ(gz) {
  return (gz / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
}
function worldToGridX(x) {
  return ((x + HALF_SIZE) / TERRAIN_SIZE) * TERRAIN_SEGMENTS;
}
function worldToGridZ(z) {
  return ((z + HALF_SIZE) / TERRAIN_SIZE) * TERRAIN_SEGMENTS;
}

/**
 * TerrainSystem
 * ---------------
 * "There should no longer be two separate ground layers. The Workshop
 * should have one terrain system that both renders the world and
 * supports editing." Workshop Reliability phase — this is now genuinely
 * that one system. It used to be a small (48m), editable patch layered
 * a few centimetres above a completely separate flat, infinitely-
 * recentring ground `WorldEnvironmentSystem.js` drew for everything
 * beyond it — real for its own moment (see docs/WORLDBUILDER.md's
 * "Terrain Editing" section for that history), but a permanent seam and
 * a permanent height gap by construction: a proof of concept the
 * Workshop world was always meant to outgrow.
 *
 * **One mesh owns the Workshop's entire ground now.** `TERRAIN_SIZE`
 * grew from 48m to 200m — a 100m half-width that comfortably covers
 * every render distance up to "Medium" (the default) and most of "Long,"
 * not a patch smaller than even the shortest render distance the way
 * the original one was. `TERRAIN_SEGMENTS` grew proportionally less (48
 * to 100, not 48 to 200×the-old-ratio) — real vertex count matters for
 * a mesh whose Y positions and normals get rewritten every dirty frame
 * during active sculpting, so resolution eased from 1m/cell to 2m/cell
 * rather than trying to hold both "4x wider" and "same fine resolution"
 * at once. `MIN_BRUSH_RADIUS` in the Builder's own terrain tool grew
 * from 1m to 2m to match — see BuilderPhoneUI.js's own comment.
 *
 * **A second, much larger, non-editable "skirt"** (`_buildSkirt()`) — a
 * flat, coarse frame filling everything *outside* the editable 200m
 * patch, out to 2000m, at the exact same baseline the editable patch's
 * own unedited vertices already sit at (no seam, no *mismatched*
 * offset between the two — "remove the current height offset caused by
 * layering two terrain systems together" is true by construction now.
 * A small, different, and still legitimate offset from the *interior
 * floor* remains — see `_buildMesh()`'s own comment). This is still
 * owned entirely by *this* class, in this one file — not a second
 * system, not a competing ground; the identical "one terrain system"
 * the brief asks for, just with an outer region that happens not to be
 * sculptable, the same way a real garden's lawn doesn't stop existing
 * just because only the flower beds get dug. See "Known
 * simplifications" in docs/WORLDBUILDER.md for the honest boundary this
 * still has (a bounded, if very large, world — not literally infinite).
 *
 * **Every vertex position is written directly, not left to
 * `THREE.PlaneGeometry`'s own defaults.** `PlaneGeometry` is used only
 * for its already-correct triangle index buffer and UV layout — real
 * work worth reusing — but every X/Y/Z position is overwritten with this
 * file's own `gridToWorldX/Z()` formula, the exact inverse of
 * `worldToGridX/Z()` used for every query. That symmetry is what makes
 * "click here, the terrain changes here" reliable, rather than trusting
 * an assumption about which direction a `rotateX()` call happens to send
 * a given axis.
 *
 * **Height queries are bilinearly interpolated** (`getHeightAt()`) —
 * smooth footing while walking across a slope, not a visible staircase
 * of flat triangles. `CameraSystem._computeGroundHeight()` calls this
 * directly, the same way it already reads Builder object footprints —
 * and, since this phase, `BuildModeSystem._gatherSurfaces()` raycasts
 * this same mesh directly for object placement too (previously the
 * flat, now-removed ground), so "player movement, collision, and object
 * placement all reference the same terrain surface" is true by
 * construction, not merely by two independent systems happening to
 * agree.
 */
export class TerrainSystem {
  constructor() {
    this.heights = new Float32Array(GRID_POINTS * GRID_POINTS); // metres, all 0 (flat) initially
    this.materialIndex = new Uint8Array(GRID_POINTS * GRID_POINTS); // index into TERRAIN_MATERIALS, 0 ("grass") initially
    this._dirty = true;
  }

  init(engine) {
    this.engine = engine;
    this._buildMesh();
    this._buildSkirt();
  }

  _buildMesh() {
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(GRID_POINTS * GRID_POINTS * 3), 3));
    this._geometry = geometry;
    this._writeAllPositionsAndColors();
    geometry.computeVertexNormals();

    // Version 3, Phase 10 ("Real Assets, Honestly Introduced") — a fine
    // neutral detail texture, multiplied under the existing vertex-colour
    // paint (MeshStandardMaterial does this automatically once both `map`
    // and `vertexColors` are set — no shader work). One tile per grid
    // cell (TERRAIN_SIZE / TERRAIN_SEGMENTS = 2m), so the detail reads at
    // roughly the same scale the terrain is actually edited at. See
    // `terrainDetailTexture()`'s own comment for why it's neutral rather
    // than grass-tinted — it sits under all seven paintable materials.
    const detailTexture = terrainDetailTexture();
    detailTexture.repeat.set(TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    // Not offset from *itself* any more — the terrain patch and the
    // ground it used to sit above are now the same mesh, so there's
    // nothing left to offset from for that reason. This small distance
    // is a different, legitimate one: `WorkshopRoom.js`'s own interior
    // floor sits with its walkable top surface at exactly y=0 — the
    // *outdoor* ground sitting a few centimetres below it, the same
    // relationship the old flat ground always had, is what lets the
    // interior floor visibly win the depth test at the doorway
    // threshold rather than the two flickering against each other where
    // they meet.
    this.mesh.position.set(0, -0.03, 0);
    this.engine.scene.add(this.mesh);
  }

  /** The large, flat, non-editable extension beyond the editable patch —
   *  see this class's own top comment for why this still counts as "one
   *  terrain system," not two. A `THREE.Shape` with a same-sized
   *  rectangular hole cut out (`shape.holes`) produces one simple,
   *  genuinely non-overlapping "picture frame" geometry — the editable
   *  patch fills the hole exactly, so there's nothing for the two
   *  meshes to z-fight over, and no coarse/fine resolution seam to hide,
   *  since the skirt has nothing to blend *with* at the join beyond
   *  matching the same flat y=0 the patch's own unedited edge already
   *  sits at. Deliberately coarse (a handful of triangles, not a grid) —
   *  it never needs to be edited or sampled for height, only seen from a
   *  distance. */
  _buildSkirt() {
    const outerHalf = SKIRT_OUTER_SIZE / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-outerHalf, -outerHalf);
    shape.lineTo(outerHalf, -outerHalf);
    shape.lineTo(outerHalf, outerHalf);
    shape.lineTo(-outerHalf, outerHalf);
    shape.lineTo(-outerHalf, -outerHalf);
    const hole = new THREE.Path();
    hole.moveTo(-HALF_SIZE, -HALF_SIZE);
    hole.lineTo(HALF_SIZE, -HALF_SIZE);
    hole.lineTo(HALF_SIZE, HALF_SIZE);
    hole.lineTo(-HALF_SIZE, HALF_SIZE);
    hole.lineTo(-HALF_SIZE, -HALF_SIZE);
    shape.holes.push(hole);

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2); // ShapeGeometry is authored flat in the XY plane — lay it down into the horizontal XZ plane, matching the main terrain mesh's own PlaneGeometry orientation
    // Grass green (TERRAIN_MATERIALS[0]'s own colour) — matches the
    // editable patch's own default, unedited vertex colour exactly, so
    // the join reads as one continuous lawn, not two different greens
    // meeting at a line. Carries the same detail texture as the main
    // mesh, at the same real-world tile density (the skirt is
    // SKIRT_OUTER_SIZE/TERRAIN_SIZE = 10x larger, so 10x the repeat) —
    // an untextured skirt butting up against a textured patch would read
    // as a visible seam right at the join, not one continuous ground.
    const skirtDetailTexture = terrainDetailTexture();
    const skirtRepeat = TERRAIN_SEGMENTS * (SKIRT_OUTER_SIZE / TERRAIN_SIZE);
    skirtDetailTexture.repeat.set(skirtRepeat, skirtRepeat);
    const material = new THREE.MeshStandardMaterial({ color: MATERIAL_COLOR[0], map: skirtDetailTexture, roughness: 0.95, metalness: 0 });
    this.skirtMesh = new THREE.Mesh(geometry, material);
    this.skirtMesh.position.set(0, -0.03, 0); // exactly coplanar with the main terrain mesh's own baseline — see that mesh's own comment on why -0.03, not 0
    this.skirtMesh.receiveShadow = true;
    this.skirtMesh.castShadow = false;
    this.engine.scene.add(this.skirtMesh);
  }

  _writeAllPositionsAndColors() {
    const pos = this._geometry.attributes.position;
    const color = this._geometry.attributes.color;
    for (let gz = 0; gz < GRID_POINTS; gz++) {
      for (let gx = 0; gx < GRID_POINTS; gx++) {
        const i = gz * GRID_POINTS + gx;
        pos.setXYZ(i, gridToWorldX(gx), this.heights[i], gridToWorldZ(gz));
        const c = MATERIAL_COLOR[this.materialIndex[i]] ?? MATERIAL_COLOR[0];
        color.setXYZ(i, c.r, c.g, c.b);
      }
    }
    pos.needsUpdate = true;
    color.needsUpdate = true;
  }

  /** Bilinearly interpolated height at any world (x, z) inside the
   *  terrain patch — `null` outside it, so a caller (see
   *  `CameraSystem._computeGroundHeight()`) knows to fall back to the
   *  ordinary flat ground instead of an edge artefact. */
  getHeightAt(x, z) {
    const fx = worldToGridX(x);
    const fz = worldToGridZ(z);
    if (fx < 0 || fx > TERRAIN_SEGMENTS || fz < 0 || fz > TERRAIN_SEGMENTS) return null;
    const gx0 = Math.floor(fx);
    const gz0 = Math.floor(fz);
    const gx1 = Math.min(gx0 + 1, TERRAIN_SEGMENTS);
    const gz1 = Math.min(gz0 + 1, TERRAIN_SEGMENTS);
    const tx = fx - gx0;
    const tz = fz - gz0;
    const h00 = this.heights[gz0 * GRID_POINTS + gx0];
    const h10 = this.heights[gz0 * GRID_POINTS + gx1];
    const h01 = this.heights[gz1 * GRID_POINTS + gx0];
    const h11 = this.heights[gz1 * GRID_POINTS + gx1];
    const hTop = h00 + (h10 - h00) * tx;
    const hBottom = h01 + (h11 - h01) * tx;
    return hTop + (hBottom - hTop) * tz;
  }

  /** Every grid point (gx, gz) whose world position falls within
   *  `radius` of world (cx, cz), along with a 0..1 falloff (1 at the
   *  centre, 0 at the edge) — the one shared neighbourhood query every
   *  brush operation below builds on, so "how a brush's strength fades
   *  toward its own edge" only has one real implementation to get right. */
  _pointsInRadius(cx, cz, radius) {
    const points = [];
    const gxMin = Math.max(0, Math.floor(worldToGridX(cx - radius)));
    const gxMax = Math.min(TERRAIN_SEGMENTS, Math.ceil(worldToGridX(cx + radius)));
    const gzMin = Math.max(0, Math.floor(worldToGridZ(cz - radius)));
    const gzMax = Math.min(TERRAIN_SEGMENTS, Math.ceil(worldToGridZ(cz + radius)));
    for (let gz = gzMin; gz <= gzMax; gz++) {
      for (let gx = gxMin; gx <= gxMax; gx++) {
        const wx = gridToWorldX(gx);
        const wz = gridToWorldZ(gz);
        const dist = Math.hypot(wx - cx, wz - cz);
        if (dist > radius) continue;
        const falloff = 1 - dist / radius; // linear falloff — soft-edged, not a hard-walled cylinder of effect
        points.push({ index: gz * GRID_POINTS + gx, falloff });
      }
    }
    return points;
  }

  /** "Raise terrain." `strength` is metres of height added at the very
   *  centre of the brush per call — call this repeatedly (once per
   *  frame a mouse button is held, say) for a continuous, controllable
   *  build-up rather than one large jump. */
  raise(cx, cz, radius, strength) {
    for (const { index, falloff } of this._pointsInRadius(cx, cz, radius)) {
      this.heights[index] = THREE.MathUtils.clamp(this.heights[index] + strength * falloff, MIN_HEIGHT, MAX_HEIGHT);
    }
    this._markDirty();
  }

  lower(cx, cz, radius, strength) {
    this.raise(cx, cz, radius, -strength);
  }

  /** "Flatten terrain." Eases every point in the brush toward the
   *  height at the brush's own centre — repeated strokes settle an
   *  uneven patch to one level without needing to raise/lower by hand
   *  until it happens to match. */
  flatten(cx, cz, radius, strength) {
    const targetHeight = this.getHeightAt(cx, cz) ?? 0;
    for (const { index, falloff } of this._pointsInRadius(cx, cz, radius)) {
      this.heights[index] += (targetHeight - this.heights[index]) * strength * falloff;
    }
    this._markDirty();
  }

  /** "Smooth terrain." Eases every point toward the *average* height of
   *  its own immediate neighbours — softens sharp, jagged edits left by
   *  raise/lower without erasing the overall shape the way Flatten
   *  would. */
  smooth(cx, cz, radius, strength) {
    const points = this._pointsInRadius(cx, cz, radius);
    const originalHeights = new Map(points.map(({ index }) => [index, this.heights[index]]));
    for (const { index, falloff } of points) {
      const gx = index % GRID_POINTS;
      const gz = Math.floor(index / GRID_POINTS);
      let sum = 0;
      let count = 0;
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nx > TERRAIN_SEGMENTS || nz < 0 || nz > TERRAIN_SEGMENTS) continue;
        const nIndex = nz * GRID_POINTS + nx;
        sum += originalHeights.get(nIndex) ?? this.heights[nIndex];
        count++;
      }
      if (count === 0) continue;
      const average = sum / count;
      this.heights[index] += (average - this.heights[index]) * strength * falloff;
    }
    this._markDirty();
  }

  /** "Terrace terrain." Snaps height to the nearest of a fixed set of
   *  steps (0.5m apart) — repeated strokes carve a hillside into
   *  distinct, flat levels, the same real landscaping technique the
   *  brief's own word names. */
  terrace(cx, cz, radius, strength) {
    const STEP = 0.5;
    for (const { index, falloff } of this._pointsInRadius(cx, cz, radius)) {
      const stepped = Math.round(this.heights[index] / STEP) * STEP;
      this.heights[index] += (stepped - this.heights[index]) * strength * falloff;
    }
    this._markDirty();
  }

  /** "Paint terrain materials... painting should blend naturally where
   *  appropriate." `materialId` wins outright at the brush's own centre;
   *  toward the edge, a vertex's own existing colour and the new one
   *  blend by `falloff` rather than the brush having a hard, visible
   *  edge — real blending, achieved by ordinary linear interpolation
   *  between two `THREE.Color`s, not a second material layer. */
  paint(cx, cz, radius, materialId, strength = 1) {
    const materialColorIndex = TERRAIN_MATERIALS.findIndex((m) => m.id === materialId);
    if (materialColorIndex < 0) return;
    const targetColor = MATERIAL_COLOR[materialColorIndex];
    const colorAttr = this._geometry.attributes.color;
    for (const { index, falloff } of this._pointsInRadius(cx, cz, radius)) {
      const blend = Math.min(1, strength * falloff);
      if (blend >= 0.999) {
        this.materialIndex[index] = materialColorIndex;
        colorAttr.setXYZ(index, targetColor.r, targetColor.g, targetColor.b);
      } else {
        // A partial blend can't be represented by a single material
        // index (this vertex is genuinely *between* two materials now),
        // so the visible vertex colour blends smoothly while
        // `materialIndex` — which only ever needs to answer "what does
        // this square mostly look like" for persistence — snaps once
        // the blend is dominant, matching whichever colour is now
        // actually closer.
        const current = new THREE.Color(colorAttr.getX(index), colorAttr.getY(index), colorAttr.getZ(index));
        current.lerp(targetColor, blend);
        colorAttr.setXYZ(index, current.r, current.g, current.b);
        if (blend > 0.5) this.materialIndex[index] = materialColorIndex;
      }
    }
    colorAttr.needsUpdate = true;
  }

  _markDirty() {
    this._dirty = true;
  }

  /** Called once per frame by `main.js`'s own update loop — cheap when
   *  nothing changed (`_writeAllPositionsAndColors()` only ever runs
   *  after an actual brush stroke, never unconditionally every frame). */
  update() {
    if (!this._dirty) return;
    this._dirty = false;
    const pos = this._geometry.attributes.position;
    for (let gz = 0; gz < GRID_POINTS; gz++) {
      for (let gx = 0; gx < GRID_POINTS; gx++) {
        pos.setY(gz * GRID_POINTS + gx, this.heights[gz * GRID_POINTS + gx]);
      }
    }
    pos.needsUpdate = true;
    this._geometry.computeVertexNormals();
  }

  /** Whether (x, z) falls inside the terrain patch at all — used by
   *  brush tools to know whether a raycast hit actually landed somewhere
   *  editable before doing any work. */
  containsPoint(x, z) {
    return Math.abs(x) <= HALF_SIZE && Math.abs(z) <= HALF_SIZE;
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { heights: Array.from(this.heights), materialIndex: Array.from(this.materialIndex) };
  }

  /** "Ensure terrain persistence continues functioning correctly."
   *  Ordinary case: a save already in the new 101x101 format loads
   *  directly, unchanged. The one-time migration case: a save from
   *  before this phase (49x49, the old 48m patch) gets bilinearly
   *  resampled onto the new grid at the exact same real-world positions
   *  its own sculpting always occupied — someone's existing hills and
   *  paths are still exactly where they left them, just sitting on the
   *  new, larger primary terrain instead of a separate overlay. Anything
   *  outside the old patch's own 48m bounds simply stays the new grid's
   *  own default (flat, grass) — there was never any data there to
   *  migrate. */
  load(data) {
    if (Array.isArray(data?.heights) && data.heights.length === this.heights.length) {
      this.heights.set(data.heights);
      if (Array.isArray(data.materialIndex) && data.materialIndex.length === this.materialIndex.length) this.materialIndex.set(data.materialIndex);
    } else if (Array.isArray(data?.heights) && data.heights.length === OLD_GRID_POINTS * OLD_GRID_POINTS) {
      this._migrateFromOldTerrain(data.heights, data.materialIndex);
    }
    if (this._geometry) {
      this._writeAllPositionsAndColors();
      this._geometry.computeVertexNormals();
    }
  }

  _migrateFromOldTerrain(oldHeights, oldMaterialIndex) {
    console.log("[TerrainSystem] Migrating terrain sculpting from the earlier 48m patch onto the new 200m primary terrain \u2014 existing edits are preserved at their original real-world position.");
    for (let gz = 0; gz < GRID_POINTS; gz++) {
      for (let gx = 0; gx < GRID_POINTS; gx++) {
        const wx = gridToWorldX(gx);
        const wz = gridToWorldZ(gz);
        if (Math.abs(wx) > OLD_HALF_SIZE || Math.abs(wz) > OLD_HALF_SIZE) continue; // outside the old patch — nothing to migrate, stays this grid's own default
        const index = gz * GRID_POINTS + gx;
        const fx = oldWorldToGrid(wx);
        const fz = oldWorldToGrid(wz);
        this.heights[index] = sampleOldGrid(oldHeights, fx, fz);
        if (Array.isArray(oldMaterialIndex)) {
          // Nearest-neighbour, not bilinear — a material id is a discrete
          // index (0-6), not a continuous value to blend between.
          const nearestIndex = Math.round(fz) * OLD_GRID_POINTS + Math.round(fx);
          this.materialIndex[index] = oldMaterialIndex[nearestIndex] ?? 0;
        }
      }
    }
  }
}
