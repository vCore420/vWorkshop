import * as THREE from "three";
import { configureFlatTexture } from "./TextureUtils.js";
import { textureQuality } from "./TextureQuality.js";

/**
 * ProceduralTexture
 * -----------------
 * Every texture in this phase is generated on a <canvas> at runtime rather
 * than loaded from an image file. This satisfies two goals at once: zero
 * asset-creation effort, and zero network dependency for the visuals that
 * matter most. When real photographed/painted textures exist later, swap
 * them in at the material-creation call site in PlaceholderFactory.js —
 * nothing else in the codebase references these functions directly.
 */

function makeCanvas(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return canvas;
}

/** Workshop Workbench phase — `size`/`grainLines`/`step` are new,
 *  optional, and default to the exact original values (256px, 40 lines,
 *  a point every 16px) — every existing call site across the Workshop
 *  is completely unaffected. `Materials.wood()` itself still only ever
 *  calls this with the defaults; a *caller* wanting a more detailed
 *  grain for one specific, prominent, closely-viewed surface (the
 *  Workbench's own top — see Workbench.js) can ask for one directly,
 *  without needing `Materials.wood()` itself to grow a size parameter
 *  of its own or risk a `.repeat` tiling seam this generator was never
 *  designed to hide (the grain lines' own sine wave doesn't complete a
 *  whole number of cycles across the canvas, so repeating the texture
 *  at anything other than 1x tends to show a visible seam at the
 *  wrap — more canvas detail avoids that entirely, rather than fighting
 *  it). */
export function woodGrainTexture(baseColor = "#6b4a34", grainColor = "#4a3120", { size = 256, grainLines = 40, step = 16 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = grainColor;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < grainLines; i++) {
    const y = Math.random() * canvas.height;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += step) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Furniture & Storage phase — "pinboard... material quality." The cork
 * board was a single flat matte colour with nothing suggesting cork's own
 * characteristic mottled, blotchy surface. Built the same way
 * `concreteTexture()` already is (randomly placed, randomly sized,
 * randomly faint arcs) — cork's own irregular grain just needs bigger,
 * warmer-toned blotches at a lower density than concrete's fine speckle.
 */
export function corkTexture(base = "#c79a63") {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 220; i++) {
    const shade = Math.random() > 0.5 ? "0,0,0" : "255,235,200";
    const v = 0.05 + Math.random() * 0.12;
    ctx.fillStyle = `rgba(${shade},${v})`;
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1.5 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Softly painted plaster, for the Workshop's own interior walls and
 * ceiling — Version 4, Phase 10b, **substantially rewritten in Phase
 * 10e after Vi played it: "its a bit much and not the greatest looking,
 * we want a warm cozy room feel."**
 *
 * That feedback is worth recording precisely, because it is the exact
 * failure this file's own measurements could not have caught. The first
 * version measured at 0.129 luminance contrast across the 1st-99th
 * percentile, and the comment here defended that as "a real, visible
 * tooth rather than a whisper — correct for plaster." It was correct
 * *for plaster*, and wrong *for this room*. A workshop someone wants to
 * spend time in has walls that recede; aggregate tooth reads as bare
 * render or unfinished render coat, which is cold and busy rather than
 * warm. Being measurably right about the wrong target is still wrong.
 *
 * **Three deliberate changes, all pushing the same direction:**
 *
 *  1. **Shadows are warm, never black.** The single biggest cause of the
 *     old version looking cold: neutral black speckle over a warm base
 *     desaturates toward grey, which is exactly how a wall reads as
 *     grubby rather than cosy. Every darkening tone here is a warm brown;
 *     every lightening one is a warm cream. Nothing neutral, nothing
 *     pure.
 *  2. **Broad tonal drift does the work; fine grain barely appears.**
 *     The old version's ~16,800 hard speckles at 512px are gone, replaced
 *     by large soft gradients (the gentle unevenness of a hand-painted
 *     wall catching light across its span) plus a trace of very fine,
 *     very faint grain — present only to stop large flat gradients
 *     banding, not to be seen as texture in its own right.
 *  3. **Far lower contrast.** Target is roughly a third of the old
 *     figure. The warmth should come from colour and light, not from
 *     surface detail competing with the furniture in front of it.
 *
 * **Still deliberately formless**, and that part of the original
 * reasoning stands unchanged: `buildWallWithOpenings()` slices a wall
 * into box segments of *varying sizes* around its windows and door, and a
 * `BoxGeometry` face maps UV 0..1 regardless of how large that face
 * actually is — so a narrow pier between two windows shows the same
 * texture compressed into less space than the broad wall beside it.
 * Anything with visible direction or structure (a grain, a board line, a
 * weave) would turn that density difference into an obvious seam.
 * Formless, low-contrast drift does not, which is what makes the
 * mismatch survivable without rebuilding how every wall segment is
 * generated.
 */
export function plasterTexture(base = "#d5c8b0", { size = 256 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const scale = size / 256;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Warm tones only — see this function's own comment. A warm cream to
  // lift, a warm brown to settle; never white, never black.
  const LIFT = "255,246,228";
  const SETTLE = "126,101,74";

  // Broad, soft tonal drift — deliberately *large* relative to the canvas
  // (radius up to most of its width) so what reads is a gentle unevenness
  // across the whole surface rather than discrete patches you could count.
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = (70 + Math.random() * 110) * scale;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() > 0.45 ? LIFT : SETTLE;
    gradient.addColorStop(0, `rgba(${tone},0.03)`);
    gradient.addColorStop(0.55, `rgba(${tone},0.014)`);
    gradient.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A trace of fine grain. Present to break up banding in the smooth
  // gradients above, not to be seen as texture — an order of magnitude
  // fewer marks than the version this replaces, at a third the alpha,
  // and warm rather than neutral.
  for (let i = 0; i < Math.round(900 * scale * scale); i++) {
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(${LIFT},0.016)` : `rgba(${SETTLE},0.016)`;
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, (0.5 + Math.random() * 0.9) * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function paperTexture(base = "#ede3d0") {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function concreteTexture(base = "#8d8577") {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 600; i++) {
    const v = Math.random() * 0.1;
    ctx.fillStyle = `rgba(0,0,0,${v})`;
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Vertical streak noise used by EnvironmentSystem to simulate rain on window glass. */
export function rainStreakTexture() {
  const canvas = makeCanvas(128);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(200,220,235,0.5)";
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * canvas.width;
    const len = 10 + Math.random() * 30;
    const y = Math.random() * canvas.height;
    ctx.lineWidth = 0.6 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y + len);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

/** A soft circular glow, colour-tinted — used for the sun and moon discs.
 *  Centre is solid `color`, fading smoothly to fully transparent by the
 *  edge, so a THREE.Sprite using this reads as a soft light source rather
 *  than a hard-edged coloured circle. */
export function radialGlowTexture(color = "#fff2df") {
  const canvas = makeCanvas(128);
  const ctx = canvas.getContext("2d");
  const c = canvas.width / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  return texture;
}

/** A soft, irregular white blob — several overlapping soft circles rather
 *  than one perfect one, so a field of these reads as clouds rather than
 *  a grid of identical discs. */
export function cloudBlobTexture() {
  const canvas = makeCanvas(128);
  const ctx = canvas.getContext("2d");
  const puffs = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffs; i++) {
    const x = 40 + Math.random() * 48;
    const y = 50 + Math.random() * 28;
    const r = 22 + Math.random() * 20;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  return texture;
}

/** A single small soft dot — used (as a sprite map, not a texture atlas)
 *  for every star in the night sky's THREE.Points cloud. */
export function starSpriteTexture() {
  const canvas = makeCanvas(32);
  const ctx = canvas.getContext("2d");
  const c = canvas.width / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.8)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  return texture;
}

/** Blueprint-style texture: blue ground, white grid + a few "drawn" lines. */
export function blueprintTexture() {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#204a63";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 16; i < canvas.width; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.rect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, canvas.height * 0.55);
  ctx.lineTo(canvas.width * 0.6, canvas.height * 0.55);
  ctx.lineTo(canvas.width * 0.6, canvas.height - 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(canvas.width * 0.72, canvas.height * 0.35, 28, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Loose sketch-paper texture: cream ground, a few pencil-like scribbled lines. */
export function sketchTexture() {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#efe6d3";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(60,50,40,0.55)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const y = 40 + i * 34 + Math.random() * 10;
    ctx.moveTo(24, y);
    for (let x = 24; x <= canvas.width - 24; x += 14) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 10);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(60,50,40,0.35)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.7, canvas.height * 0.65, 30, 0, Math.PI * 1.4);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Version 4, Phase 10a — `size` is new, optional, and defaults to the
 *  original 128px, so any caller that doesn't ask is completely
 *  unaffected. This is the one generator in this file the foundation wave
 *  raises the resolution of directly: at 128px it was the most
 *  under-resolved surface in the Workshop (half every other generator's
 *  edge length, on a material whose entire character is fine directional
 *  streaking), and — unlike `woodGrainTexture()`'s documented tiling-seam
 *  sensitivity or `concreteTexture()`'s `repeat`-tuned speckle density —
 *  it has no size-dependent art tuning to disturb.
 *
 *  **Every size-dependent number below scales with `size`, so the result
 *  is the same brushed metal at higher fidelity — not a different-looking
 *  material.** Streak count scales *linearly*, not by area: the streaks
 *  are full-width horizontal lines distributed down `canvas.height`, so
 *  it's their spacing in one dimension that sets the apparent density,
 *  and squaring the count would have quadrupled it into a solid smear.
 *  Line width and the end-point jitter scale linearly for the same
 *  reason — each keeps its real-world size on the surface, and the actual
 *  gain is that a streak's edges are now resolved with sub-pixel
 *  precision rather than aliased across a 128px canvas. */
export function metalBrushedTexture(base = "#9a978f", { size = 128 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const scale = size / 128;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < Math.round(200 * scale); i++) {
    ctx.strokeStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.lineWidth = 0.4 * scale;
    const y = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + (Math.random() - 0.5) * 2 * scale);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Version 3, Phase 10 ("Real Assets, Honestly Introduced") — a fine,
 *  neutral speckle for `TerrainSystem.js`'s own ground mesh, following
 *  `concreteTexture()`/`corkTexture()`'s exact technique (randomly
 *  placed, randomly sized, low-alpha dots). Deliberately **not**
 *  grass-tinted, unlike its name might suggest at a glance — the
 *  terrain paints seven different materials (grass, dirt, rock, sand,
 *  gravel, mud, path — see `TERRAIN_MATERIALS`) by vertex colour alone,
 *  and this texture sits underneath *all seven* as one shared `map`,
 *  multiplied against whichever vertex colour is actually painted there
 *  (`MeshStandardMaterial` already does this multiply automatically
 *  once both `map` and `vertexColors` are set — no shader work needed,
 *  same as this whole file's own standing rule). A near-white, barely-
 *  tinted base with both lighter and darker speckle keeps that multiply
 *  close to neutral for every material, not just grass — true per-
 *  material splat texturing (grass looking like *grass*, sand looking
 *  like *sand*) is a real, bigger project deliberately left for later;
 *  see `docs/WORLD.md`'s own "Terrain painting" paragraph, now updated
 *  to describe this honestly rather than left claiming no texture is
 *  involved at all. */
export function terrainDetailTexture() {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e4e0d2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 900; i++) {
    const shade = Math.random() > 0.5 ? "0,0,0" : "255,255,255";
    const v = 0.04 + Math.random() * 0.1;
    ctx.fillStyle = `rgba(${shade},${v})`;
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ======================================================================
// Surface maps — Version 4, Phase 10a ("The Visual Upgrade — Foundation")
// ======================================================================
//
// The single highest-leverage finding of Phase 10's own opening
// investigation: before this wave, there was not one `normalMap`,
// `roughnessMap`, `aoMap`, or `bumpMap` anywhere in `src/` — confirmed by
// grep across all 266 files, zero hits. Every material in the Workshop
// was albedo-only. A `MeshStandardMaterial` with nothing but a colour map
// cannot produce surface micro-relief at all, which is why wood read as
// wood-coloured paper and brushed metal read as grey plastic no matter
// how carefully the grain above was drawn. That is a *material* gap, not
// a geometry-budget one — which is what makes it fixable here, once, for
// every object at once, rather than object by object.
//
// **Derived from the albedo, not drawn separately.** Both functions below
// read `texture.image` — a `THREE.CanvasTexture` keeps a live reference to
// the canvas it was built from — and infer relief from its luminance.
// That is not a shortcut standing in for "real" authored maps; it is
// genuinely the correct reading of these particular textures, because
// every generator above already draws its detail *as* relief: wood grain
// lines are darker because they're grooves, cork's blotches are shading,
// siding's board seams are shadow lines. Luminance already is the height
// field. It also means every existing generator is completely untouched
// and every existing caller keeps working unchanged — no signature grew,
// nothing needed re-drawing.
//
// See docs/VISUAL_IDENTITY.md for the art-direction side of this, and
// docs/PERFORMANCE.md for the tier that decides whether they're built.

/** Luminance of one pixel, 0..1. Rec. 601 weights — the eye's own
 *  sensitivity, not a flat average, so a mid-green grain line and a
 *  mid-blue one produce the same depth rather than the green one reading
 *  as a deeper groove purely because green is perceptually brighter. */
function luminanceAt(data, index) {
  return (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255;
}

/** Copies the sampling/tiling state that has to match the albedo exactly.
 *  Getting this wrong is silent and ugly rather than loud: a normal map
 *  that doesn't share its albedo's own `repeat` slides across the surface
 *  relative to the colour it's meant to be the relief *of*, so grain
 *  lines light as though the grooves were somewhere else entirely.
 *  `concreteTexture()`'s own `repeat.set(4, 4)` makes this a real case
 *  here, not a theoretical one. */
function matchTiling(target, source) {
  target.wrapS = source.wrapS;
  target.wrapT = source.wrapT;
  target.repeat.copy(source.repeat);
  target.offset.copy(source.offset);
  configureFlatTexture(target);
  // Deliberately *not* sRGB, unlike every albedo above. A normal map's
  // channels are vector components and a roughness map's are a linear
  // material property — neither is a colour, and tagging either as sRGB
  // would have the renderer apply a gamma curve to numbers that aren't
  // brightness, quietly flattening relief and skewing roughness. Three's
  // own default for a CanvasTexture is already NoColorSpace; set
  // explicitly because "it happens to default correctly" is exactly the
  // kind of thing that breaks silently in a future Three.js upgrade.
  target.colorSpace = THREE.NoColorSpace;
  return target;
}

/**
 * A tangent-space normal map derived from `texture`'s own luminance.
 *
 * Central-difference gradient (a neighbour either side, rather than the
 * pixel and one neighbour) so the relief is symmetric — a one-sided
 * difference biases every edge half a pixel in the same direction, which
 * on a regular pattern like siding's board seams reads as the whole
 * surface being subtly lit from the wrong side. Sampling wraps with a
 * modulo rather than clamping at the edges, because these textures tile:
 * clamping would flatten the relief along the seam into a visible straight
 * line, which is precisely where a tiling texture can least afford one.
 *
 * `strength` scales the gradient before normalisation — higher is deeper.
 * **Every caller's value was measured rather than guessed**, and the
 * first set of guesses turned out to be badly wrong in both directions,
 * which is worth recording so the next person tuning one starts from
 * evidence: the useful metric is the *typical* (mean) normal tilt across
 * the whole canvas, not the peak, because peak is one extreme pixel in
 * 65,000 and says almost nothing about how a surface reads. Measured at
 * the originally-guessed strengths, wood and cork came out at ~1° typical
 * tilt (invisible — a normal map costing a texture fetch to do nothing),
 * while brushed metal at a *lower* guessed strength came out at 15°,
 * because its 1px alternating white/black streaks are far higher-contrast
 * and higher-frequency than wood's soft 35%-alpha grain. Contrast and
 * spatial frequency of the source drawing dominate here; the strength
 * number alone is not comparable between two different generators.
 *
 * The Workshop's surfaces are still planed timber, brushed steel and cork
 * rather than hammered rock — the failure mode of an over-strong normal
 * map (a surface that looks like crumpled foil under a moving light) is
 * more noticeable and less honest than a slightly flat one, so these sit
 * where a surface reads as genuinely relieved and no further.
 */
export function normalMapFromTexture(texture, strength = 1.6) {
  const source = texture.image;
  if (!source?.width) return null;
  const width = source.width;
  const height = source.height;

  const sourceCtx = source.getContext("2d");
  const src = sourceCtx.getImageData(0, 0, width, height).data;

  const canvas = makeCanvas(width);
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const out = ctx.createImageData(width, height);

  const at = (x, y) => luminanceAt(src, (((y + height) % height) * width + ((x + width) % width)) * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Negated because a *darker* neighbour means a groove — the surface
      // falls away toward it, so the normal tilts away from it, not
      // toward it. Getting this sign backwards produces a map that looks
      // plausible in isolation and inverts every highlight in place,
      // which is the classic way this goes wrong unnoticed.
      const dx = -(at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = -(at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);

      const i = (y * width + x) * 4;
      out.data[i] = ((dx / length) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / length) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);

  return matchTiling(new THREE.CanvasTexture(canvas), texture);
}

/**
 * A roughness map derived from `texture`'s own luminance — darker areas
 * (grooves, seams, worn patches) read as slightly smoother than the flat
 * surface around them, which is what actually happens to a real object:
 * the recesses and the handled edges are where finish survives and where
 * dirt polishes in, so they catch a highlight the broad faces don't.
 *
 * **Three.js multiplies this map's green channel against the material's
 * own `roughness` scalar** — it does not replace it. So a map whose
 * values sit in `[min, max]` with `max` at 1.0 leaves the material's
 * existing overall roughness as the ceiling and only ever varies
 * *downward* from it. That's the deliberate choice here: every material
 * in `PlaceholderFactory.js` already has a hand-tuned roughness value
 * that reads correctly, and this wave's job is to add variation to those
 * surfaces, not to silently re-tune all thirteen of them at once.
 *
 * **Luminance is normalised across the texture's own observed range
 * before being mapped into `[min, max]`** — the fix for a real defect
 * caught during this wave's own verification rather than in review. The
 * first implementation mapped *absolute* luminance, which quietly made
 * `min`/`max` mean almost nothing: measured directly, `sidingTexture()`'s
 * luminance spans only 0.242–0.368 of the available 0–1, so a declared
 * band of `[0.85, 1.0]` collapsed to an actual output of 0.886–0.906 — a
 * 2% variation, indistinguishable from a flat map while still costing a
 * full texture fetch per fragment. Every generator in this file has the
 * same shape of problem (wood spans 0.102, cork 0.233, paper 0.089),
 * because they all draw low-contrast detail over a mid-tone base rather
 * than using the full dynamic range. Normalising means a material's
 * declared roughness band is the band it actually gets, whatever base
 * colour it happens to be tinted.
 */
export function roughnessMapFromTexture(texture, { min = 0.82, max = 1 } = {}) {
  const source = texture.image;
  if (!source?.width) return null;
  const width = source.width;
  const height = source.height;

  const src = source.getContext("2d").getImageData(0, 0, width, height).data;

  // First pass: the texture's own actual luminance range. Cheap (one
  // linear scan of a canvas built once and cached for the lifetime of the
  // session) and the only way `min`/`max` can mean anything real — see
  // this function's own comment for the measurements that forced it.
  let lumMin = 1;
  let lumMax = 0;
  for (let i = 0; i < src.length; i += 4) {
    const lum = luminanceAt(src, i);
    if (lum < lumMin) lumMin = lum;
    if (lum > lumMax) lumMax = lum;
  }
  // A genuinely uniform texture (no detail to vary across) normalises to
  // nothing rather than dividing by zero — it gets a flat map at `max`,
  // which is exactly "leave this material's own roughness alone".
  const span = lumMax - lumMin;

  const canvas = makeCanvas(width);
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const out = ctx.createImageData(width, height);

  for (let i = 0; i < src.length; i += 4) {
    const t = span > 0 ? (luminanceAt(src, i) - lumMin) / span : 1;
    const value = (min + t * (max - min)) * 255;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = value;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);

  return matchTiling(new THREE.CanvasTexture(canvas), texture);
}

/**
 * The one call site every textured material in `PlaceholderFactory.js`
 * actually uses: takes an albedo texture and returns the full
 * `{ map, normalMap, roughnessMap }` set ready to spread into a
 * `MeshStandardMaterial`.
 *
 * Returns `{ map }` alone when the active texture tier says not to build
 * surface maps (see `TextureQuality.js` for why that's a boot-time,
 * device-capability decision). Spreading a set with `normalMap:
 * undefined` into a material constructor is harmless — Three.js treats a
 * missing map as no map — so a caller never needs to branch.
 */
export function surfaceSetFrom(texture, { normalStrength = 1.6, roughnessRange } = {}) {
  if (!textureQuality().surfaceMaps) return { map: texture };
  return {
    map: texture,
    normalMap: normalMapFromTexture(texture, normalStrength),
    roughnessMap: roughnessMapFromTexture(texture, roughnessRange),
  };
}

/** Horizontal lapped-board siding, for the workshop's exterior walls. */
export function sidingTexture(base = "#5a4a3d") {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const boardHeight = 22;
  for (let y = 0; y < canvas.height; y += boardHeight) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, y, canvas.width, 2);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, y + 2, canvas.width, boardHeight - 2);
  }
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.globalAlpha = 0.03;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
