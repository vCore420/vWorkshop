import * as THREE from "three";

const TERRAIN_SIZE = 48; // metres — a bounded "grounds" patch around the Workshop, not infinite terrain; see this file's own module comment
const TERRAIN_SEGMENTS = 48; // 1m resolution — fine enough to sculpt real detail, coarse enough to stay cheap to edit and persist
const GRID_POINTS = TERRAIN_SEGMENTS + 1; // 49x49 vertices
const HALF_SIZE = TERRAIN_SIZE / 2;
const MAX_HEIGHT = 4; // metres — a generous hill, never a cliff that swallows the Workshop itself
const MIN_HEIGHT = -2.5; // a shallow basin — enough for a pond bed, not a canyon

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
 * "Introduce a dedicated terrain editing workflow... the surrounding
 * world should feel just as thoughtfully designed as the Workshop
 * itself." A real, genuinely editable heightmap — not the flat,
 * infinitely-recentring ground `WorldEnvironmentSystem.js` already draws
 * for the far distance. That ground was built to solve a different
 * problem ("the world never visibly ends") and solves it well, by
 * discarding any specific location's own identity — it *recentres
 * around the camera*, which makes "raise the ground at this exact
 * spot" meaningless for it by design. Terrain needs the opposite
 * property: a fixed, stable patch of real ground someone can come back
 * to and find exactly as they left it. This system owns that one
 * bounded patch (48m square, centred on the Workshop) and layers it
 * a few centimetres above the existing flat ground — "the goal is not
 * creating a huge world. The goal is creating a beautiful one" is taken
 * literally: a generous garden's worth of real, sculptable ground, not
 * an attempt to make the *entire* infinite ground editable.
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
 * directly, the same way it already reads Builder object footprints.
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
  }

  _buildMesh() {
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(GRID_POINTS * GRID_POINTS * 3), 3));
    this._geometry = geometry;
    this._writeAllPositionsAndColors();
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    // A few centimetres above WorldEnvironmentSystem's own flat ground
    // (which sits at y=-0.03) — enough to always win the depth test
    // without the two visibly fighting for the same pixels at the seam
    // where the terrain patch ends and the infinite ground continues.
    this.mesh.position.set(0, 0.01, 0);
    this.engine.scene.add(this.mesh);
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

  load(data) {
    if (Array.isArray(data?.heights) && data.heights.length === this.heights.length) this.heights.set(data.heights);
    if (Array.isArray(data?.materialIndex) && data.materialIndex.length === this.materialIndex.length) this.materialIndex.set(data.materialIndex);
    if (this._geometry) {
      this._writeAllPositionsAndColors();
      this._geometry.computeVertexNormals();
    }
  }
}
