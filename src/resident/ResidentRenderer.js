import * as THREE from "three";
import { configureFlatTexture } from "../utils/TextureUtils.js";
import { defaultEmbodimentConfig, normalizeEmbodimentConfig } from "../ai/EmbodimentConfiguration.js";
import { EXPRESSION_GRID_SIZE } from "./ExpressionTypes.js";

const RADIUS = 0.13; // "increase Bubble's size very slightly. It should still feel like a companion rather than the focal point of the room." Nudged up again (0.16 → 0.11 → 0.13) — still small, just a touch less easy to lose track of. Every embodiment shape below is built at roughly this same scale, so switching type never makes the resident suddenly loom or vanish.
const FACE_TEXTURE_SIZE = 128;
const BASE_GLOW_OPACITY = 0.8; // reproduced exactly when embodiment.glow is at its default (0.5) — see _applyGlow()
const BASE_LIGHT_INTENSITY = 0.35;
const TRANSITION_DURATION = 0.16; // seconds — see setExpression()'s own comment

const MOOD_COLORS = {
  sleeping: "#4a6a72",
  neutral: "#7fd8c4",
  curious: "#8fc8e8",
  happy: "#a8e8b8",
  thinking: "#c8a8e8",
  // Workshop Personality phase — three new expressions, three new
  // glow colours, each chosen to sit in the same soft, "digital, not
  // magical" family the original five already established rather than
  // introducing a jarringly saturated or dark outlier.
  excited: "#ffd27a", // warm gold — noticeably brighter/warmer than "happy"'s green, the same way the expression itself reads as more energetic
  sad: "#7a8ca0", // a cooler, more muted blue-grey — subdued, not stark
  surprised: "#f0a8d8", // a bright, light pink-magenta — stands out momentarily, matching a brief, sudden reaction rather than a settled mood
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
    this._expressionSet = null; // a custom Expression Set from ExpressionSetStore.js, or null for the built-in procedural drawing — see setExpressionSet()

    this._buildBubble();
    this._buildInnerGlow();
    this._buildFace();
    this._buildSparkles();
    this._buildLight();
    this._applyEmbodiment(this._embodiment);

    this._lastExpression = null;
    this._pendingExpression = null; // the expression a transition is currently fading toward — see setExpression()
    this._transitionTimer = 0;
    this._sparklePulsePhase = Math.random() * Math.PI * 2;
    this._localLookTarget = new THREE.Vector3();
    // Phase 14 ("Further Environmental Polish") — scratch quaternions for
    // damping the face plane's own look-at rotation; see update()'s own
    // comment on why an instantaneous lookAt() read as "hunting."
    this._previousFaceQuaternion = new THREE.Quaternion();
    this._targetFaceQuaternion = new THREE.Quaternion();
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
      emissive: new THREE.Color(MOOD_COLORS.neutral),
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
    this.glowMaterial = new THREE.MeshBasicMaterial({ color: MOOD_COLORS.neutral, transparent: true, opacity: BASE_GLOW_OPACITY });
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
    // Phase 14 ("Further Environmental Polish") — this sat at RADIUS*0.92
    // (0.1196), *inside* the sphere body's own curved silhouette
    // (RADIUS=0.13) everywhere except a small dot dead-centre: the
    // sphere's own front surface at off-axis distance r sits at
    // sqrt(RADIUS² - r²), which only drops below 0.1196 past r≈0.051 —
    // well inside the face plane's own extent, so the sphere's own
    // depth-writing body (MeshPhysicalMaterial, transparent but not
    // depth-write-disabled) occluded almost the whole face, reading as
    // "rarely showing more than a dot or two." RADIUS*1.08 (0.1404)
    // clears the sphere's own front apex (RADIUS itself) at every off-
    // axis position, guaranteeing the whole face renders unoccluded —
    // still a single shared offset for every embodiment shape (the cube
    // already cleared comfortably at the old value, and clears with even
    // more room now), matching this file's own "one face plane for all
    // shapes" simplicity.
    this.faceMesh.position.set(0, 0, RADIUS * 1.08);
    this.faceMesh.renderOrder = 1;
    this.root.add(this.faceMesh);

    this._drawFace("neutral");
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
    this.light = new THREE.PointLight(MOOD_COLORS.neutral, BASE_LIGHT_INTENSITY, 1.4, 2);
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

  /** Workshop Personality phase — "expressions should transition
   *  smoothly and feel subtle rather than exaggerated." Previously an
   *  instant swap — the new face texture simply appeared the same frame
   *  the expression changed. Now a brief cross-fade: the face mesh eases
   *  to fully transparent, the texture underneath is swapped while
   *  genuinely invisible (see `update()`'s own handling of
   *  `_pendingExpression`), then eases back in — the same "a change in
   *  state should read as a transition, not a cut" instinct
   *  `ResidentMovement.js`'s own eased turns and `EnvironmentSystem.js`'s
   *  own weather easing already hold themselves to, just applied to a
   *  2D face for the first time. `TRANSITION_DURATION` (160ms) is
   *  deliberately quick — long enough to read as a change, nowhere near
   *  long enough to feel like Bubble is fading in and out. */
  setExpression(expression) {
    if (expression === this._lastExpression || expression === this._pendingExpression) return;
    this._pendingExpression = expression;
    this._transitionTimer = TRANSITION_DURATION;
  }

  /** Workshop Personality phase — "future residents should naturally use
   *  the same architecture." A resident's active Expression Set (see
   *  `ExpressionSetStore.js`) is resolved by whoever owns this renderer
   *  (`ResidentController.js`, from the active profile's own
   *  `expressionSetId` — the identical "a plain id on the profile,
   *  resolved elsewhere" shape `provider`/`model` already use) and
   *  handed in here as either a real set object or `null` ("use the
   *  built-in procedural drawing," the only behaviour that existed
   *  before this phase). Redraws immediately with whatever the current
   *  expression already is, so switching sets is visible right away
   *  rather than waiting for the next expression change — a set switch
   *  itself doesn't need the cross-fade `setExpression()` uses; it's a
   *  configuration change, not a felt emotional beat. */
  setExpressionSet(expressionSet) {
    this._expressionSet = expressionSet ?? null;
    if (this._lastExpression) this._drawFace(this._lastExpression);
  }

  /** The one place that decides *how* an expression gets drawn — a
   *  custom pixel image from the active Expression Set if one exists for
   *  this specific expression, otherwise the original built-in
   *  procedural drawing (`_drawProceduralFace()`). A set doesn't need to
   *  define all eight expressions to be usable — anything it leaves
   *  blank quietly falls back to the built-in look for just that one
   *  expression, never a blank or broken face. */
  _drawFace(expression) {
    const pixels = this._expressionSet?.expressions?.[expression];
    if (pixels) this._drawPixelFace(pixels, this._expressionSet.gridSize ?? EXPRESSION_GRID_SIZE);
    else this._drawProceduralFace(expression);
  }

  /** A custom Expression Creator drawing — `pixels` is a flat array of
   *  `gridSize * gridSize` entries, each either a CSS colour string or
   *  `null` (transparent, showing the bubble's own glow through it,
   *  exactly like the procedural drawing's own unpainted background).
   *  Drawn as plain filled squares, not smoothed or interpolated — "simple
   *  pixel drawing tools" should look like pixel art once it's actually
   *  on the resident's own face, not silently blurred away. */
  _drawPixelFace(pixels, gridSize) {
    const ctx = this._faceCtx;
    const s = FACE_TEXTURE_SIZE;
    ctx.clearRect(0, 0, s, s);
    const cell = s / gridSize;
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const color = pixels[gy * gridSize + gx];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
  }

  /** The original built-in expression drawing — a handful of simple
   *  curves per expression, never a sprite sheet. "The expressions
   *  should remain subtle. Avoid exaggerated cartoon animation." Always
   *  available regardless of which Expression Set is active, since any
   *  expression a set doesn't define falls back to this. */
  _drawProceduralFace(expression) {
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

    // Workshop Personality phase — three new expressions, held to the
    // same "a handful of simple curves" standard as the original five.
    if (expression === "excited") {
      // Bigger, rounder eyes than "happy" (wide with energy, not just
      // pleased) and a fully open, filled smile rather than a stroked
      // arc — the one expression here that reads as genuinely bright
      // rather than gently pleased, without tipping into a cartoon grin.
      dot(ctx, s / 2 - eyeDX, eyeY, s * 0.075);
      dot(ctx, s / 2 + eyeDX, eyeY, s * 0.075);
      ctx.beginPath();
      ctx.ellipse(s / 2, s * 0.6, s * 0.1, s * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (expression === "sad") {
      // The exact mirror of "happy"'s own eyes (positive curve instead
      // of negative — droops instead of arching) and a frown built from
      // the top half of a circle, the mirror of "happy"'s own smile arc
      // (see that arc's own angles, reflected through the centre).
      drawCurve(ctx, s / 2 - eyeDX, eyeY, s * 0.07, 0.6);
      drawCurve(ctx, s / 2 + eyeDX, eyeY, s * 0.07, 0.6);
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.7, s * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      return;
    }

    if (expression === "surprised") {
      // Wide, open ring-shaped eyes (a stroked circle, not a filled dot
      // — "wide-eyed") and a small round open mouth, the classic honest
      // reading for a sudden, brief reaction rather than a settled mood.
      ctx.beginPath();
      ctx.arc(s / 2 - eyeDX, eyeY, s * 0.055, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s / 2 + eyeDX, eyeY, s * 0.055, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.62, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // "neutral" — the default resting expression.
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

    this._updateExpressionTransition(dt);

    if (lookTarget) {
      // Object3D.lookAt() expects its target in the *parent's* own local
      // space for an ordinary Mesh (unlike a Camera or Light, which take
      // world space) — converting first avoids a subtly wrong rotation
      // whenever the root group itself has any position/rotation applied,
      // which it always does here.
      this.root.worldToLocal(this._localLookTarget.copy(lookTarget));
      // Phase 14 ("Further Environmental Polish") — this used to call
      // lookAt() directly on faceMesh every frame: an instantaneous,
      // undamped snap to a fresh orientation, invisible on the round orb
      // (nothing for the eye to compare it against) but visibly "hunting"
      // on the cube's own flat, hard-edged face, since the body itself
      // barely rotates (only the slow idle sway above) while the face
      // plane alone kept re-snapping every frame. Compute the same target
      // orientation as before, then ease toward it (the same exponential-
      // smoothing shape MathUtils.js's own `damp()` already uses for
      // scalars elsewhere, applied here via Quaternion.slerp) instead of
      // snapping straight to it.
      this._previousFaceQuaternion.copy(this.faceMesh.quaternion);
      this.faceMesh.lookAt(this._localLookTarget);
      // lookAt() orients the object's own -Z toward the target; the face
      // texture itself was drawn facing +Z (see _buildFace() — it sits on
      // the bubble's +Z side by default), so a flip is needed for the
      // drawn side to actually be what ends up pointing at lookTarget.
      this.faceMesh.rotateY(Math.PI);
      this._targetFaceQuaternion.copy(this.faceMesh.quaternion);
      this.faceMesh.quaternion.copy(this._previousFaceQuaternion).slerp(this._targetFaceQuaternion, 1 - Math.exp(-8 * dt));
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

  /** The face mesh eases to fully transparent, swaps its texture (and
   *  the mood colour driving the glow/light/emissive) at the exact
   *  moment it's genuinely invisible, then eases back in — see
   *  `setExpression()`'s own comment for why. A resident with no
   *  transition in progress (the overwhelmingly common case, most
   *  frames) costs one cheap comparison and returns immediately. */
  _updateExpressionTransition(dt) {
    if (this._transitionTimer <= 0) return;
    const wasInSecondHalf = this._transitionTimer <= TRANSITION_DURATION / 2;
    this._transitionTimer = Math.max(0, this._transitionTimer - dt);
    const isInSecondHalf = this._transitionTimer <= TRANSITION_DURATION / 2;

    if (!wasInSecondHalf && isInSecondHalf) {
      // The invisible midpoint — swap what's actually drawn while
      // nothing can see it happen.
      this._lastExpression = this._pendingExpression;
      this._pendingExpression = null;
      this._drawFace(this._lastExpression);
      const color = MOOD_COLORS[this._lastExpression] ?? MOOD_COLORS.neutral;
      this.glowMaterial.color.set(color);
      this.light.color.set(color);
      this.material.emissive.set(color);
    }

    // 1 at both ends of the transition (fully visible before it starts
    // and after it ends), dipping to 0 exactly at the midpoint swap.
    const progress = 1 - this._transitionTimer / TRANSITION_DURATION;
    this.faceMesh.material.opacity = Math.abs(progress - 0.5) * 2;
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
