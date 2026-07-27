import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { woodGrainTexture, metalBrushedTexture, paperTexture, blueprintTexture, sketchTexture, sidingTexture, corkTexture, plasterTexture, concreteTexture, surfaceSetFrom } from "./ProceduralTexture.js";
import { textureQuality } from "./TextureQuality.js";

/**
 * PlaceholderFactory
 * ------------------
 * Every furniture builder in /src/entities/furniture/ calls into this file
 * rather than constructing raw THREE geometry/materials itself. That gives
 * us one place to:
 *
 *   1. Keep a consistent "believable, unfussy" placeholder visual style.
 *   2. Swap the whole project onto real models later — one edit inside a
 *      `Materials` entry or a shape helper here re-skins every caller at
 *      once, without any furniture file changing.
 *
 * Materials are cached so we don't create hundreds of near-identical
 * texture/material objects for one room.
 *
 * Version 4, Phase 10a — point 2 above used to promise a specific escape
 * hatch by name: "once you have a GLTF workbench,
 * `PlaceholderFactory.mesh(\"workbench\", ...)` becomes `GLTFLoader` under
 * the hood." There is no `mesh()` function in this file and there never
 * has been — this file exports `box`/`bevelBox`/`cylinder`/`sphere`/
 * `plane`/`multiFaceBox`/`brassTag`/`group`, and a grep for
 * `PlaceholderFactory.mesh` across `src/` returns only that sentence
 * itself. The *intent* was true and still is (this is the one seam a
 * real-asset swap would go through); the named API was invented and
 * never built. Rewritten to describe the seam that actually exists,
 * rather than leaving a promise no caller could keep — `CLAUDE.md`'s "a
 * docstring is a promise" rule, applied to this file's own.
 */

const materialCache = new Map();

function cached(key, factory) {
  if (!materialCache.has(key)) materialCache.set(key, factory());
  return materialCache.get(key);
}

/**
 * Version 4, Phase 10a ("The Visual Upgrade — Foundation") — every
 * *textured* material below now carries a generated normal and roughness
 * map alongside its colour map, via `surfaceSetFrom()` (see
 * `ProceduralTexture.js`'s own "Surface maps" section for how they're
 * derived and why deriving them from the albedo is the right reading of
 * these particular textures rather than a shortcut).
 *
 * This is the whole of the wave's visible effect, and it is deliberately
 * invisible as a *diff*: not one furniture file, builder piece, or Being
 * changed, and no call signature moved. Every object in the Workshop that
 * already used `wood()`/`metal()`/`cork()`/`siding()`/`paper()` picks the
 * relief up the moment it's next built, because they all already come
 * through here. That was the entire argument for doing the foundation as
 * its own wave — see docs/ROADMAP.md's Phase 10a account.
 *
 * **The flat-colour materials below are deliberately left alone.**
 * `fabric()`, `matte()`, `plastic()`, `rubber()`, `ceramic()`, `brass()`
 * and `emissive()` have no `map` at all — there is no luminance detail to
 * derive relief *from*, so a generated normal map would be a flat sheet
 * of `(0.5, 0.5, 1)` doing nothing but costing a texture fetch per
 * fragment. Giving those surfaces real character means authoring detail
 * they don't currently have, which is per-surface art work belonging with
 * Waves 10b/10c, not something this wave can honestly fake.
 *
 * `roughnessRange` is tuned per material rather than shared: how much a
 * surface's finish actually varies is a property of the material, not a
 * global constant. Wood and cork vary a lot (grain and blotches really do
 * catch light differently); brushed metal varies little along its grain;
 * paper is nearly uniform.
 */
export const Materials = {
  wood(color = "#6b4a34") {
    return cached(`wood:${color}`, () => new THREE.MeshStandardMaterial({
      ...surfaceSetFrom(woodGrainTexture(color, "#00000055"), { normalStrength: 5, roughnessRange: { min: 0.78, max: 1 } }),
      roughness: 0.75,
      metalness: 0.05,
    }));
  },
  metal(color = "#9a978f") {
    return cached(`metal:${color}`, () => new THREE.MeshStandardMaterial({
      // The *lowest* strength of any textured material here, and
      // deliberately so despite brushed metal being the most obviously
      // "relieved" surface in the set — because `metalBrushedTexture()`
      // draws hard-edged 1px alternating white/black streaks, which
      // produce far steeper luminance gradients than wood's soft
      // 35%-alpha grain. Measured during this wave's own verification:
      // 2.2 here yields ~15° typical normal tilt, where wood needed 5 to
      // reach a fraction of that. Raising it further pushes brushed steel
      // straight into crumpled-foil territory. Roughness barely varies —
      // a brushed finish is uniform by definition; it's the *direction*
      // that varies, not the amount.
      ...surfaceSetFrom(metalBrushedTexture(color, { size: textureQuality().textureSize }), { normalStrength: 2.2, roughnessRange: { min: 0.9, max: 1 } }),
      roughness: 0.4,
      metalness: 0.75,
    }));
  },
  fabric(color = "#3c5a53") {
    return cached(`fabric:${color}`, () => new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0,
    }));
  },
  paper(color = "#ede3d0") {
    return cached(`paper:${color}`, () => new THREE.MeshStandardMaterial({
      // Gentle: `paperTexture()` draws 2000 single-pixel specks, and a
      // strong normal derived from per-pixel noise reads as sandpaper
      // rather than paper fibre. Enough to catch a raking light, no more.
      ...surfaceSetFrom(paperTexture(color), { normalStrength: 2.5, roughnessRange: { min: 0.94, max: 1 } }),
      roughness: 0.9,
      metalness: 0,
    }));
  },
  blueprint() {
    return cached("blueprint", () => new THREE.MeshStandardMaterial({
      map: blueprintTexture(),
      roughness: 0.85,
      metalness: 0,
    }));
  },
  sketchPaper() {
    return cached("sketchPaper", () => new THREE.MeshStandardMaterial({
      map: sketchTexture(),
      roughness: 0.9,
      metalness: 0,
    }));
  },
  matte(color = "#888888") {
    return cached(`matte:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }));
  },
  /**
   * Version 4, Phase 10b — painted plaster, for the room's own interior
   * walls and ceiling. These were using `matte()` above: a completely
   * flat colour on the largest surfaces in the Workshop by area, which
   * meant every grained wooden object in the room was seen against a
   * backdrop carrying no surface information at all.
   *
   * Strength 1.5 is measured, not chosen — it lands at ~2.4° typical
   * normal tilt, against wood's ~4.1°. That relationship is the point: a
   * wall should read as a real surface rather than a void, and stop well
   * short of competing for attention with anything standing in front of
   * it. The room is the backdrop, not the subject. (The first pass set
   * this to 3, which measured at ~4.7° — *stronger* than the furniture it
   * sits behind, exactly backwards. See `plasterTexture()`'s own comment
   * for the measurements and for why this texture is formless rather than
   * merely faint.)
   */
  plaster(color = "#cfc4ad") {
    return cached(`plaster:${color}`, () => new THREE.MeshStandardMaterial({
      ...surfaceSetFrom(plasterTexture(color, { size: textureQuality().textureSize }), { normalStrength: 1.5, roughnessRange: { min: 0.88, max: 1 } }),
      roughness: 0.95,
      metalness: 0,
    }));
  },
  /**
   * Version 4, Phase 10b — poured concrete, for the Workshop floor.
   * `concreteTexture()` has existed since Version 1 and the floor has
   * always used it, but always through a hand-rolled
   * `new THREE.MeshStandardMaterial({ map: ... })` in `WorkshopRoom.js`
   * rather than through this factory — which meant that when Phase 10a
   * gave every textured material its surface maps, the floor (one of the
   * three largest surfaces a player ever looks at) was silently skipped,
   * because it wasn't coming through here at all. Bringing it in fixes
   * that and removes a second way of doing the same thing.
   */
  concrete(color = "#7d766a") {
    return cached(`concrete:${color}`, () => new THREE.MeshStandardMaterial({
      ...surfaceSetFrom(concreteTexture(color), { normalStrength: 14, roughnessRange: { min: 0.86, max: 1 } }),
      roughness: 0.95,
      metalness: 0,
    }));
  },
  // Workshop Workbench phase — "material quality... plastic, rubber."
  // Two real gaps, not previously distinguishable from `matte()` at
  // all — every plastic clipboard, fan housing, or tool handle in the
  // Workshop was using the exact same numbers as a painted metal
  // switch plate. Genuinely different surface behaviour, not just a
  // different name: plastic reads as smooth and a little glossy
  // (lower roughness, a faint highlight); rubber reads as soft and
  // completely non-reflective (roughness pushed close to 1, no
  // highlight at all). Neither is metallic.
  plastic(color = "#3a3a3a") {
    return cached(`plastic:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0 }));
  },
  rubber(color = "#232323") {
    return cached(`rubber:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0 }));
  },
  siding(color = "#5a4a3d") {
    return cached(`siding:${color}`, () => new THREE.MeshStandardMaterial({
      // The strongest normal in the set, and the most justified: lapped
      // boards genuinely do step over each other, so the seam lines this
      // texture draws are real geometric edges the flat exterior wall it
      // sits on has no way to express otherwise. This is the material
      // where the whole approach pays off most visibly — the Workshop's
      // exterior read as a painted flat plane before it.
      ...surfaceSetFrom(sidingTexture(color), { normalStrength: 6, roughnessRange: { min: 0.85, max: 1 } }),
      roughness: 0.9,
      metalness: 0,
    }));
  },
  glass(color = "#bfe6ff") {
    return cached(`glass:${color}`, () => new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      thickness: 0.05,
      transparent: true,
      opacity: 0.35,
    }));
  },
  // Furniture & Storage phase — "pinboard... material quality." The one
  // real cork surface in the Workshop was sharing matte()'s flat colour;
  // this gives it cork's own actual mottled look, the same way paper()
  // and blueprint() already have their own texture rather than a flat
  // tint standing in for one.
  cork(color = "#c79a63") {
    return cached(`cork:${color}`, () => new THREE.MeshStandardMaterial({
      // Cork's blotches are genuinely pitted, and it's a surface a player
      // stands close to and looks straight at (the pinboard) — worth real
      // depth and the widest roughness variation of any material here.
      ...surfaceSetFrom(corkTexture(color), { normalStrength: 5, roughnessRange: { min: 0.74, max: 1 } }),
      roughness: 0.92,
      metalness: 0,
    }));
  },
  // Decorative Details phase — "materials... ceramic." Every plant pot
  // in the Workshop was sharing matte()'s own numbers for a surface
  // that's almost always glazed ceramic in real life — smoother and
  // very slightly reflective, distinct from plastic's own glossier,
  // completely non-metallic read.
  ceramic(color = "#a9764f") {
    return cached(`ceramic:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 }));
  },
  brass() {
    return cached("brass", () => new THREE.MeshStandardMaterial({ color: "#b8863b", roughness: 0.35, metalness: 0.9 }));
  },
  emissive(color = "#7fd8c4", intensity = 1) {
    return cached(`emissive:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
    }));
  },
};

/** Simple box builder — the workhorse of every placeholder object. */
export function box(width, height, depth, material, { castShadow = true, receiveShadow = true } = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * A box with softened edges — Version 4, Phase 10a ("The Visual Upgrade —
 * Foundation").
 *
 * The second of Phase 10's two opening findings, alongside the missing
 * surface maps: every edge in the Workshop was a razor-sharp 90°, because
 * `box()` above is raw `BoxGeometry` and it is the workhorse behind
 * nearly every object here. Real manufactured objects essentially never
 * are — a machined edge, a planed board, a moulded plastic housing all
 * carry a chamfer or fillet, and that chamfer catches a thin highlight
 * along its whole length. The absence of that highlight is the single
 * strongest "untextured prototype" tell available, and it costs a few
 * triangles to fix.
 *
 * **This does not replace `box()`, and adopting it stays deliberate
 * rather than automatic** — because silently rounding every box in the
 * project would change all 56 `ConstructionLibrary` pieces at once,
 * unverified, and their triangle cost is the real constraint (see the
 * measured table below).
 *
 * **The UV concern this docstring originally raised turned out to be
 * unfounded, and is corrected here rather than left standing (Wave
 * 10b).** It used to claim `RoundedBoxGeometry` "generates its own UVs
 * from a subdivided cube, which do not match `BoxGeometry`'s," and that
 * every textured surface therefore needed an individual check. Measured
 * directly on a real bench-top size (1.8 × 0.08 × 0.8): both geometries
 * lay out **per-face UV islands spanning 0–1**, and the flat top face of
 * the rounded version spans u 0.005–0.995, v 0.012–0.988 — inset by
 * exactly the bevel's own proportion of the face, which is both correct
 * (the rounded-off corner genuinely isn't flat top any more) and far
 * below the threshold of visibility. A texture sits on a bevelled box
 * essentially where it sits on a plain one. That was the blocker on
 * adopting this for textured wood, and it isn't one.
 *
 * **The radius is clamped to a third of the smallest dimension**, and the
 * geometry's outer extent stays exactly `width × height × depth` —
 * `RoundedBoxGeometry` rounds *inward* from the box's own faces, it never
 * grows past them. That is what makes it safe for the envelope-preserving
 * rule Wave 10c works under (a 2m wall stays exactly 2m at its widest
 * point, so it still meets its neighbour), and the clamp is what stops a
 * generous `bevel` on a thin panel from collapsing it into a lozenge.
 *
 * `segments` follows the active texture tier by default — corner
 * subdivision is the one part of this with a real triangle cost, and a
 * device that shouldn't be paying for normal maps shouldn't be paying for
 * three-segment fillets either.
 *
 * **Measured cost, so Waves 10b/10c can adopt this with open eyes rather
 * than discovering it late** (verified directly, this wave, on a unit
 * cube — `RoundedBoxGeometry` subdivides the whole box, not only its
 * edges, so the multiplier is the same at any size):
 *
 * | tier | segments | triangles | vs plain `box()` |
 * |------|----------|-----------|------------------|
 * | low | 1 | 108 | 9× |
 * | medium | 2 | 300 | 25× |
 * | high | 3 | 588 | 49× |
 *
 * A plain `BoxGeometry` is 12. That multiplier is comfortable for
 * Workshop furniture — a nine-piece room of a few dozen boxes each lands
 * in the low tens of thousands of triangles, which is nothing — but it is
 * emphatically *not* free for `ConstructionLibrary` pieces, which a
 * player can place hundreds of copies of. Wave 10c should bevel
 * selectively (the pieces seen close and often) rather than by default,
 * and should re-measure rather than assume this stays comfortable.
 */
export function bevelBox(width, height, depth, material, { bevel = 0.012, segments = null, castShadow = true, receiveShadow = true } = {}) {
  const radius = Math.min(bevel, Math.min(width, height, depth) / 3);
  const geometry = new RoundedBoxGeometry(width, height, depth, segments ?? textureQuality().bevelSegments, radius);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * A box with up to six independent face materials — used for wall segments,
 * which look different from the interior side than the exterior side.
 * `faces` matches BoxGeometry's own default material-group order:
 * `{ px, nx, py, ny, pz, nz }` (right, left, top, bottom, front, back).
 * Any face omitted falls back to `fallback`.
 */
export function multiFaceBox(width, height, depth, faces, fallback) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const order = ["px", "nx", "py", "ny", "pz", "nz"];
  const materials = order.map((key) => faces[key] ?? fallback);
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cylinder(radiusTop, radiusBottom, height, material, radialSegments = 16) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A unit sphere (radius 0.5) — combine with a part's own scale to size it. */
export function sphere(material, widthSegments = 16, heightSegments = 12) {
  const geometry = new THREE.SphereGeometry(0.5, widthSegments, heightSegments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A unit flat plane (1 x 1), facing +z by default. */
export function plane(material) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A small brass tag mesh — used sparingly to mark objects that are
 * intentionally placeholders for a future feature, so it never reads as
 * "unfinished" but as "reserved". Purely visual, no interaction logic.
 */
export function brassTag(width = 0.14, height = 0.04) {
  return box(width, height, 0.005, Materials.brass(), { castShadow: false });
}

/** Group helper: builds a THREE.Group, positions/rotates it, and returns it. */
export function group(position = [0, 0, 0], rotationY = 0) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.rotation.y = rotationY;
  return g;
}

// Version 2 Sign-Off phase — `computeFootprint(object3D)` used to live
// here: a one-line wrapper around `new THREE.Box3().setFromObject()`,
// whose own docstring claimed it was "used by collision + interaction
// radius helpers." It never actually was — every real caller of that
// exact pattern (`WorldObjectsSystem.js`, `LadderSystem.js`) already
// calls `Box3.setFromObject()` directly, and nothing anywhere called
// this wrapper. Removed rather than kept as a second, unused way to do
// the same one-line thing — see docs/REFINEMENT.md's own "Version 2
// Sign-Off" section.
