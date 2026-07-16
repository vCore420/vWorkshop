import * as THREE from "three";
import { configureFlatTexture } from "./TextureUtils.js";

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

export function metalBrushedTexture(base = "#9a978f") {
  const canvas = makeCanvas(128);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 200; i++) {
    ctx.strokeStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.lineWidth = 0.4;
    const y = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureFlatTexture(texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
