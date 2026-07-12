import * as THREE from "three";
import { configureFlatTexture } from "../utils/TextureUtils.js";
import { defaultEmbodimentConfig, normalizeEmbodimentConfig } from "../ai/EmbodimentConfiguration.js";

const RADIUS = 0.13; // "increase Bubble's size very slightly. It should still feel like a companion rather than the focal point of the room." Nudged up again (0.16 → 0.11 → 0.13) — still small, just a touch less easy to lose track of. Every embodiment shape below is built at roughly this same scale, so switching type never makes the resident suddenly loom or vanish.
const FACE_TEXTURE_SIZE = 128;
const BASE_GLOW_OPACITY = 0.8; // reproduced exactly when embodiment.glow is at its default (0.5) — see _applyGlow()
const BASE_LIGHT_INTENSITY = 0.35;

const MOOD_COLORS = {
  sleeping: "#4a6a72",
  content: "#7fd8c4",
  curious: "#8fc8e8",
  happy: "#a8e8b8",
  thinking: "#c8a8e8",
};

/**
 * ResidentRenderer
 * ------------------
 * "Semi-transparent bubble, soft internal glow, gentle sparkle effects,
 * subtle internal movement, slight refraction, soft ambient lighting,
 * tiny floating particles... feel digital rather than magical." Four
 * layers, one root group, unchanged in spirit from the very first phase
 * this existed — only the outer layer's own *geometry* now varies:
 *
 *   - An outer mesh (`MeshPhysicalMaterial`, real `transmission` for
 *     glass-like refraction rather than faked transparency) — the body
 *     itself. Its *shape* now comes from `embodiment.type` (see
 *     `_buildOuterGeometry()`); its *material* — transmission, clearcoat,
 *     opacity — stays identical across every shape, which is what keeps
 *     a cube-bodied or prism-bodied resident still unmistakably the same
 *     kind of thing as the original floating orb, just a different
 *     silhouette.
 *   - A smaller inner sphere, fully emissive, no transparency — the
 *     "soft internal glow," colour driven by mood/expression
 *     (`MOOD_COLORS`) so the bubble's own light genuinely shifts with how
 *     it's feeling, not just its face. Deliberately always a sphere
 *     regardless of outer shape — an inner light source reads the same
 *     way inside a cube as inside an orb; there's no "soft internal glow"
 *     worth giving a cube's own inner glow sharp corners.
 *   - A handful of `THREE.Points` drifting slowly inside the body's own
 *     rough radius — "tiny floating particles" — never leaving it, never
 *     moving quickly.
 *
 * **Embodiment, finally real** (`docs/AI.md`/`docs/RESIDENT.md`'s own
 * "Embodiment Preparation: not active this phase" retired) —
 * `setEmbodiment(config)` reads every field `EmbodimentConfiguration.js`
 * defines:
 *   - `type` picks the outer geometry (`_buildOuterGeometry()`).
 *   - `color` becomes the outer material's own base colour — the "glass"
 *     itself is now genuinely tinted per resident, distinct from the
 *     mood-driven emissive glow layered on top of it.
 *   - `glow` scales the inner glow's opacity and the point light's
 *     intensity around their original fixed values (see
 *     `BASE_GLOW_OPACITY`/`BASE_LIGHT_INTENSITY`) — the default (0.5)
 *     reproduces the exact original look.
 *   - `scale` applies once, at the root-group level, so it composes
 *     cleanly with the per-frame squash/stretch `ResidentMovement.js`
 *     already applies at the mesh level rather than fighting it.
 *   - `idleBehaviour` isn't read here at all — it changes how much
 *     `ResidentMovement.js`'s own procedural motion moves, not anything
 *     about how the resident is drawn; see that file's own `update()`.
 *
 * **The face is a small canvas texture, redrawn only when the expression
 * actually changes** (not every frame — a static drawing operation
 * repeated 60 times a second for a face that changes maybe once a minute
 * would be wasted work), applied to a thin plane that sits just in front
 * of the body's centre and rotates to face wherever the resident is
 * currently "looking." "The expressions should remain subtle. Avoid
 * exaggerated cartoon animation" — every expression in `drawFace()` is a
 * handful of simple curves, not a sprite sheet. "Thinking" and "curious"
 * were, honestly, too close to each other at this texture size — both a
 * single raised eye plus a small open mouth — so this phase gave
 * "thinking" its own distinct read (both eyes lifted and drawn slightly
 * together, a flat, settled mouth — a look turned inward) rather than
 * reusing "curious"'s asymmetric, outward-looking one.
 */
export class ResidentRenderer {
  constructor(embodiment = null) {
    this.root = new THREE.Group();
    this.root.name = "resident";
    this._embodiment = normalizeEmbodimentConfig(embodiment ?? defaultEmbodimentConfig());
    this._outerType = null; // forces the very first _applyEmbodiment() to build geometry rather than skipping it as "unchanged"

    this._buildBubble();
    this._buildInnerGlow();
    this._buildFace();
    this._buildSparkles();
    this._buildLight();
    this._applyEmbodiment(this._embodiment);

    this._lastExpression = null;
    this._sparklePulsePhase = Math.random() * Math.PI * 2;
    this._localLookTarget = new THREE.Vector3();
  }

  /** One geometry per `EmbodimentConfiguration.EMBODIMENT_TYPES` entry,
   *  each sized to roughly the same overall footprint as the original
   *  sphere (`RADIUS`) so switching type never looms or shrinks
   *  drastically — a deliberately plain Three.js primitive per shape,
   *  matching "digital, not magical" (and this project's own placeholder-
   *  geometry convention, see `docs/ARCHITECTURE.md`'s "Placeholder-first
   *  assets") rather than an imported model for any of them. `custom`
   *  (reserved for a future phase that isn't a simple primitive at all)
   *  falls back to the same sphere `floatingOrb` uses, honestly, rather
   *  than pretending to have a shape for it yet. */
  _buildOuterGeometry(type) {
    switch (type) {
      case "cube": {
        const side = RADIUS * 1.55;
        return new THREE.BoxGeometry(side, side, side, 2, 2, 2);
      }
      case "prism": {
        // radialSegments: 3 — a genuine triangular prism, not a cylinder;
        // reads as a small glass prism, which the material's own real
        // `transmission` already suits.
        const geometry = new THREE.CylinderGeometry(RADIUS * 0.95, RADIUS * 0.95, RADIUS * 1.7, 3);
        geometry.rotateY(Math.PI / 6); // one flat face toward the front rather than an edge
        return geometry;
      }
      case "lantern": {
        // radialSegments: 8 — a faceted, lantern-like column rather than
        // a perfectly smooth cylinder, closer to how the Workshop's own
        // Construction Library pieces stay simple-but-faceted.
        return new THREE.CylinderGeometry(RADIUS * 0.85, RADIUS * 0.85, RADIUS * 1.9, 8);
      }
      case "wisp": {
        // A sphere, permanently stretched along Y by scaling the
        // geometry itself (not `mesh.scale`, which stays free for the
        // per-frame squash/stretch and the embodiment's own uniform
        // `scale` at the root level) — an elongated, teardrop-ish
        // silhouette rather than a perfect orb.
        const geometry = new THREE.SphereGeometry(RADIUS * 0.85, 20, 16);
        geometry.scale(0.75, 1.55, 0.75);
        return geometry;
      }
      case "floatingOrb":
      case "custom":
      default:
        return new THREE.SphereGeometry(RADIUS, 24, 18);
    }
  }

  _buildBubble() {
    this.material = new THREE.MeshPhysicalMaterial({
      color: "#dff5f0",
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      metalness: 0,
      transmission: 0.6, // real refraction, not faked — "slight refraction"
      thickness: RADIUS,
      ior: 1.15,
      emissive: new THREE.Color(MOOD_COLORS.content),
      emissiveIntensity: 0.18,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    });
    this.mesh = new THREE.Mesh(this._buildOuterGeometry("floatingOrb"), this.material);
    this.mesh.castShadow = false; // a small translucent glow has no business casting a hard shadow
    this.mesh.receiveShadow = false;
    this.root.add(this.mesh);
  }

  _buildInnerGlow() {
    // Always a sphere regardless of outer shape — see the class comment.
    const geometry = new THREE.SphereGeometry(RADIUS * 0.45, 12, 10);
    this.glowMaterial = new THREE.MeshBasicMaterial({ color: MOOD_COLORS.content, transparent: true, opacity: BASE_GLOW_OPACITY });
    this.glowMesh = new THREE.Mesh(geometry, this.glowMaterial);
    this.root.add(this.glowMesh);
  }

  _buildFace() {
    this._faceCanvas = document.createElement("canvas");
    this._faceCanvas.width = FACE_TEXTURE_SIZE;
    this._faceCanvas.height = FACE_TEXTURE_SIZE;
    this._faceCtx = this._faceCanvas.getContext("2d");
    this._faceTexture = new THREE.CanvasTexture(this._faceCanvas);
    this._faceTexture.colorSpace = THREE.SRGBColorSpace;
    configureFlatTexture(this._faceTexture);

    const faceMaterial = new THREE.MeshBasicMaterial({ map: this._faceTexture, transparent: true, depthWrite: false });
    const faceGeometry = new THREE.PlaneGeometry(RADIUS * 1.1, RADIUS * 1.1);
    this.faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
    this.faceMesh.position.set(0, 0, RADIUS * 0.92);
    this.faceMesh.renderOrder = 1;
    this.root.add(this.faceMesh);

    this._drawFace("content");
  }

  _buildSparkles() {
    const count = 10;
    const positions = new Float32Array(count * 3);
    this._sparkleSeeds = [];
    for (let i = 0; i < count; i++) {
      const seed = { phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.4, radius: RADIUS * (0.3 + Math.random() * 0.55), axis: Math.random() * Math.PI * 2 };
      this._sparkleSeeds.push(seed);
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: "#ffffff", size: 0.012, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true });
    this.sparkles = new THREE.Points(geometry, material);
    this.root.add(this.sparkles);
  }

  _buildLight() {
    // "Soft ambient lighting" of its own — a very small point light so the
    // bubble genuinely casts a little warmth onto whatever it's near,
    // rather than only ever looking lit from outside itself.
    this.light = new THREE.PointLight(MOOD_COLORS.content, BASE_LIGHT_INTENSITY, 1.4, 2);
    this.light.position.set(0, 0, 0);
    this.root.add(this.light);
  }

  /** Applies every embodiment field — called once at construction and
   *  again whenever `ResidentController.js` notices the active profile's
   *  own embodiment has changed (see its own `residents:changed`
   *  listener). Geometry is only rebuilt when `type` actually differs
   *  from what's already there, since disposing/rebuilding on every call
   *  (colour and glow change far more often than type does) would be
   *  wasted work. */
  setEmbodiment(config) {
    this._applyEmbodiment(normalizeEmbodimentConfig(config));
  }

  _applyEmbodiment(embodiment) {
    this._embodiment = embodiment;
    if (embodiment.type !== this._outerType) {
      this._outerType = embodiment.type;
      const oldGeometry = this.mesh.geometry;
      this.mesh.geometry = this._buildOuterGeometry(embodiment.type);
      oldGeometry.dispose();
    }
    this.material.color.set(embodiment.color);
    this._applyGlow(embodiment.glow);
    this.root.scale.setScalar(embodiment.scale);
  }

  /** `glow` (0-1, default 0.5) scales the inner glow's opacity and the
   *  point light's intensity around their original fixed values, so the
   *  default reproduces the exact look this resident always had before
   *  embodiment settings did anything. */
  _applyGlow(glow) {
    const factor = glow / 0.5;
    this.glowMaterial.opacity = Math.min(1, BASE_GLOW_OPACITY * factor);
    this.light.intensity = BASE_LIGHT_INTENSITY * factor;
  }

  /** Redraws the face only when the expression actually changed. */
  setExpression(expression) {
    if (expression === this._lastExpression) return;
    this._lastExpression = expression;
    this._drawFace(expression);
    const color = MOOD_COLORS[expression] ?? MOOD_COLORS.content;
    this.glowMaterial.color.set(color);
    this.light.color.set(color);
    this.material.emissive.set(color);
  }

  _drawFace(expression) {
    const ctx = this._faceCtx;
    const s = FACE_TEXTURE_SIZE;
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = "#1c2a28";
    ctx.fillStyle = "#1c2a28";
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = "round";

    const eyeY = s * 0.44;
    const eyeDX = s * 0.16;

    if (expression === "sleeping") {
      drawCurve(ctx, s / 2 - eyeDX, eyeY, s * 0.09, 0.15);
      drawCurve(ctx, s / 2 + eyeDX, eyeY, s * 0.09, 0.15);
      return;
    }

    if (expression === "thinking") {
      // Deliberately distinct from "curious" below (both eyes lifted and
      // drawn a little closer together, a flat, settled mouth) — the two
      // used to share almost the same asymmetric-raised-eye silhouette,
      // easy to mistake for one another at this texture size. This one
      // reads as turned inward; "curious" stays turned outward.
      const liftedY = eyeY - s * 0.035;
      const innerDX = eyeDX * 0.75;
      dot(ctx, s / 2 - innerDX, liftedY, s * 0.05);
      dot(ctx, s / 2 + innerDX, liftedY, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(s / 2 - s * 0.05, s * 0.62);
      ctx.lineTo(s / 2 + s * 0.05, s * 0.62);
      ctx.stroke();
      return;
    }

    if (expression === "curious") {
      dot(ctx, s / 2 - eyeDX, eyeY, s * 0.055);
      dot(ctx, s / 2 + eyeDX, eyeY - s * 0.03, s * 0.06);
      ctx.beginPath();
      ctx.ellipse(s / 2, s * 0.63, s * 0.035, s * 0.045, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (expression === "happy") {
      drawCurve(ctx, s / 2 - eyeDX, eyeY, s * 0.08, -0.9);
      drawCurve(ctx, s / 2 + eyeDX, eyeY, s * 0.08, -0.9);
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.56, s * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      // "Playful teeth" — a couple of tiny pale rectangles, not a full grin.
      ctx.fillStyle = "#eafaf5";
      ctx.fillRect(s / 2 - s * 0.045, s * 0.615, s * 0.03, s * 0.025);
      ctx.fillRect(s / 2 + s * 0.015, s * 0.615, s * 0.03, s * 0.025);
      return;
    }

    // "content" — the default resting expression.
    dot(ctx, s / 2 - eyeDX, eyeY, s * 0.055);
    dot(ctx, s / 2 + eyeDX, eyeY, s * 0.055);
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.58, s * 0.09, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  /** `position`/`idleRotationY`/`scale` come from `ResidentMovement`'s own
   *  `update()`; `lookTarget` is whichever world point the face should
   *  currently point toward (already blended between the idle look-at and
   *  the player by `ResidentController.js`). `dt` drives the sparkle
   *  drift. */
  update(dt, { position, idleRotationY, scale, lookTarget }) {
    this.root.position.copy(position);
    this.root.rotation.y = idleRotationY;
    this.mesh.scale.copy(scale);
    this.glowMesh.scale.copy(scale);

    if (lookTarget) {
      // Object3D.lookAt() expects its target in the *parent's* own local
      // space for an ordinary Mesh (unlike a Camera or Light, which take
      // world space) — converting first avoids a subtly wrong rotation
      // whenever the root group itself has any position/rotation applied,
      // which it always does here.
      this.root.worldToLocal(this._localLookTarget.copy(lookTarget));
      this.faceMesh.lookAt(this._localLookTarget);
      // lookAt() orients the object's own -Z toward the target; the face
      // texture itself was drawn facing +Z (see _buildFace() — it sits on
      // the bubble's +Z side by default), so a flip is needed for the
      // drawn side to actually be what ends up pointing at lookTarget.
      this.faceMesh.rotateY(Math.PI);
    }

    for (let i = 0; i < this._sparkleSeeds.length; i++) {
      const seed = this._sparkleSeeds[i];
      seed.phase += dt * seed.speed;
      const r = seed.radius * (0.7 + 0.3 * Math.sin(seed.phase * 1.3));
      const positions = this.sparkles.geometry.attributes.position.array;
      positions[i * 3] = Math.cos(seed.phase + seed.axis) * r;
      positions[i * 3 + 1] = Math.sin(seed.phase * 0.8) * r * 0.6;
      positions[i * 3 + 2] = Math.sin(seed.phase + seed.axis) * r;
    }
    this.sparkles.geometry.attributes.position.needsUpdate = true;

    this._sparklePulsePhase += dt * 0.5;
    this.sparkles.material.opacity = 0.55 + 0.2 * Math.sin(this._sparklePulsePhase); // "occasional sparkle pulses" — a slow, gentle breathing
  }

  /** "Glow becomes softer... idle movement slows" while offline —
   *  ResidentController.js calls this whenever `isAwake` changes, rather
   *  than every frame, since it's a state transition, not continuous
   *  motion. Scales relative to whatever the embodiment's own glow is
   *  currently set to, rather than a second fixed pair of numbers, so a
   *  resident configured with a brighter glow still reads as dimmer while
   *  asleep than it does while awake. */
  setAwake(isAwake) {
    const glowFactor = this._embodiment.glow / 0.5;
    this.material.opacity = isAwake ? 0.55 : 0.4;
    this.material.emissiveIntensity = isAwake ? 0.18 : 0.08;
    this.glowMaterial.opacity = isAwake ? Math.min(1, BASE_GLOW_OPACITY * glowFactor) : Math.min(1, BASE_GLOW_OPACITY * glowFactor * 0.56);
    this.light.intensity = isAwake ? BASE_LIGHT_INTENSITY * glowFactor : BASE_LIGHT_INTENSITY * glowFactor * 0.43;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.glowMesh.geometry.dispose();
    this.glowMaterial.dispose();
    this.faceMesh.geometry.dispose();
    this.faceMesh.material.dispose();
    this._faceTexture.dispose();
    this.sparkles.geometry.dispose();
    this.sparkles.material.dispose();
  }
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A gentle arc used for closed/curved eyes — `curve` near 0 is nearly
 *  flat, negative curves upward (a smile-shaped eye), positive downward. */
function drawCurve(ctx, x, y, width, curve) {
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.quadraticCurveTo(x, y + width * curve, x + width, y);
  ctx.stroke();
}
