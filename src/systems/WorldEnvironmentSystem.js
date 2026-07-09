import * as THREE from "three";
import { Materials } from "../utils/PlaceholderFactory.js";
import { radialGlowTexture, cloudBlobTexture, starSpriteTexture } from "../utils/ProceduralTexture.js";
import { CameraSystem } from "./CameraSystem.js";

const GROUND_SIZE = 400; // metres — one tile of the "effectively infinite" ground
const RECENTER_THRESHOLD = 120; // recentre once the camera is this far from the tile's own centre
const RECENTER_GRID = 20; // snap recentring to this grid so the texture never visibly "swims"
// Kept comfortably inside every Render Distance option (55/100/160/200m —
// see SettingsStore.js) so the sky is never clipped by the camera's own
// far plane, even on "Short". Positioned relative to the *camera*, not
// the world origin (see update()), so this distance stays constant no
// matter how far something eventually gets built from the origin.
const SKY_RADIUS = 42;
const CLOUD_HALF_RANGE = 34; // clouds drift and wrap within this box around the camera — also comfortably inside "Short"
const STAR_COUNT = 320;
const CLOUD_COUNT = 12;

/**
 * WorldEnvironmentSystem
 * -------------------------
 * The one system responsible for rendering everything TimeOfDaySystem and
 * EnvironmentSystem *compute*: the ground, the sky colour and fog, the sun
 * and moon discs, the stars, and a small field of drifting clouds. Neither
 * of those two systems touches the scene directly — this is deliberately
 * the only place `scene.background`/`scene.fog`/any of these meshes get
 * created or changed, the same "compute state, emit an event, let one
 * dedicated renderer react" split the whole environment stack uses (see
 * docs/WORLD.md's Environment System section).
 *
 * Nothing here is aware that a Workshop, or any other building, exists —
 * the ground, sky, and every effect below apply to the *scene*, not to any
 * one structure in it. That's what makes "Builder compatibility... without
 * requiring special cases" true for free: a wall someone builds sits under
 * the same sky and in the same fog as the workshop itself, automatically.
 *
 * Kept deliberately restrained per "avoid making the sky visually
 * overwhelming": a modest, fixed number of clouds and stars, soft glow
 * sprites rather than lit 3D spheres for the sun/moon, and every effect
 * (cloud opacity, star visibility, fog density) fades in proportion to the
 * condition driving it rather than switching on abruptly.
 */
export class WorldEnvironmentSystem {
  constructor() {
    this._lastRecenter = new THREE.Vector2(0, 0);
    this._baseFogNear = 18;
    this._baseFogFar = 160;
    this._weatherFogDensity = 0;
    this._cloudCoverage = 0.1;
    this._windSpeed = 0.1;
    this._windDirectionRad = 0;
    this._sunDirection = new THREE.Vector3(0, 1, 0);
    this._moonDirection = new THREE.Vector3(0, -1, 0);
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem); // resolved once — see CameraSystem.js's own init() comment on why this is safe regardless of registration order

    const groundMat = Materials.ground();
    const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    this.groundMesh = new THREE.Mesh(geometry, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.set(0, -0.03, 0); // just under the interior floor's surface — avoids z-fighting at the threshold
    this.groundMesh.receiveShadow = true;
    engine.scene.add(this.groundMesh);

    engine.scene.fog = new THREE.Fog("#bfe6ff", this._baseFogNear, this._baseFogFar);

    this._buildSunMoon();
    this._buildStars();
    this._buildClouds();

    engine.events.on("timeofday:changed", (state) => this._onTimeChanged(state));
    engine.events.on("environment:changed", (state) => this._onEnvironmentChanged(state));
  }

  _buildSunMoon() {
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: radialGlowTexture("#fff6e0"), transparent: true, depthWrite: false, fog: false })
    );
    this.sunSprite.scale.set(16, 16, 1);
    this.engine.scene.add(this.sunSprite);

    this.moonSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: radialGlowTexture("#dbe6f5"), transparent: true, depthWrite: false, fog: false, opacity: 0.85 })
    );
    this.moonSprite.scale.set(10, 10, 1);
    this.engine.scene.add(this.moonSprite);
  }

  /** A fixed field of point-sprites on the upper half of a large sphere —
   *  simple, cheap (one draw call for all of them), and never recomputed
   *  after creation; only their shared material's opacity changes, via
   *  `starVisibility`. */
  _buildStars() {
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const y = 0.15 + Math.random() * 0.85; // biased toward the upper sky, away from a cluttered horizon band
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(angle) * r * SKY_RADIUS;
      positions[i * 3 + 1] = y * SKY_RADIUS;
      positions[i * 3 + 2] = Math.sin(angle) * r * SKY_RADIUS;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: starSpriteTexture(),
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(geometry, material);
    this.engine.scene.add(this.stars);
  }

  /** A handful of sprite clouds drifting with the wind — cheap, and
   *  "moving clouds" without anything as heavy as a real volumetric or
   *  particle system. Positions are relative to the camera and wrapped
   *  the same "effectively infinite, never actually infinite" way the
   *  ground already is (see update()), so clouds stay visible no matter
   *  how far from the origin something eventually gets built. */
  _buildClouds() {
    this._cloudData = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: cloudBlobTexture(), transparent: true, depthWrite: false, opacity: 0 })
      );
      const scale = 10 + Math.random() * 9;
      sprite.scale.set(scale, scale * 0.55, 1);
      this.engine.scene.add(sprite);
      this._cloudData.push({
        sprite,
        // Offsets from the camera, not world-space coordinates — see update().
        offsetX: (Math.random() - 0.5) * CLOUD_HALF_RANGE * 2,
        offsetZ: (Math.random() - 0.5) * CLOUD_HALF_RANGE * 2,
        height: 12 + Math.random() * 9,
        opacityJitter: 0.7 + Math.random() * 0.3,
      });
    }
  }

  /** Used by BuildModeSystem so outdoor placement works the same way indoor placement does. */
  getGroundMesh() {
    return this.groundMesh;
  }

  /** Driven by the Settings app's "Render Distance" — scales both the
   *  camera's far plane and the fog's far distance together, so the world
   *  fades into the sky at roughly the same point it actually stops being
   *  drawn, rather than either popping visibly or fading well before the
   *  cutoff. See docs/PERFORMANCE.md. Stored as the *base* fog range;
   *  weather's own fog density (see _onEnvironmentChanged) is layered on
   *  top of this, not instead of it. */
  setRenderDistance(metres) {
    this.engine.camera.far = metres;
    this.engine.camera.updateProjectionMatrix();
    this._baseFogFar = metres;
    this._baseFogNear = Math.min(18, metres * 0.2);
    this._applyFog();
  }

  _applyFog() {
    if (!this.engine.scene.fog) return;
    // fogDensity 0 -> the base render-distance-driven range, unchanged.
    // fogDensity 1 -> a genuinely thick fog, much closer on both ends —
    // "Fog"/"Mist" should feel like weather, not just a slightly hazier
    // version of a clear day.
    const density = this._weatherFogDensity;
    this.engine.scene.fog.near = this._baseFogNear * (1 - density * 0.75);
    this.engine.scene.fog.far = Math.max(this.engine.scene.fog.near + 4, this._baseFogFar * (1 - density * 0.88));
  }

  _onTimeChanged({ skyColor, sunDirection, moonDirection, moonIllumination, starVisibility }) {
    this.engine.scene.background = new THREE.Color(skyColor);
    if (this.engine.scene.fog) this.engine.scene.fog.color.set(skyColor);

    this._sunDirection.copy(sunDirection);
    this._moonDirection.copy(moonDirection);
    this.sunSprite.visible = sunDirection.y > -0.08;
    this.moonSprite.visible = moonDirection.y > -0.08;
    // A new moon is genuinely dim, not just "the same disc, less lit" —
    // moonIllumination scales both how visible it is and how much it
    // stands out against the night sky.
    this.moonSprite.material.opacity = 0.25 + moonIllumination * 0.65;
    this.stars.material.opacity = starVisibility * 0.85;
  }

  _onEnvironmentChanged({ fogDensity, cloudCoverage, windSpeed, windDirectionRad }) {
    this._weatherFogDensity = fogDensity ?? 0;
    this._cloudCoverage = cloudCoverage ?? 0.1;
    this._windSpeed = windSpeed ?? 0.1;
    this._windDirectionRad = windDirectionRad ?? 0;
    this._applyFog();
  }

  update(dt) {
    const camera = this._cameraSystem;
    const camPos = camera?.position;

    if (camera) {
      const dx = camera.position.x - this.groundMesh.position.x;
      const dz = camera.position.z - this.groundMesh.position.z;
      if (dx * dx + dz * dz > RECENTER_THRESHOLD * RECENTER_THRESHOLD) {
        this.groundMesh.position.x = Math.round(camera.position.x / RECENTER_GRID) * RECENTER_GRID;
        this.groundMesh.position.z = Math.round(camera.position.z / RECENTER_GRID) * RECENTER_GRID;
      }
    }

    // Sun, moon, and stars are all positioned relative to the camera every
    // frame, not the world origin — see SKY_RADIUS's own comment. Distance
    // from the camera is what matters for both "stays inside the far
    // plane" and "always overhead no matter where you've walked to."
    if (camPos) {
      this.sunSprite.position.copy(this._sunDirection).multiplyScalar(SKY_RADIUS).add(camPos);
      this.moonSprite.position.copy(this._moonDirection).multiplyScalar(SKY_RADIUS).add(camPos);
      this.stars.position.copy(camPos);
    }

    // Clouds drift with the wind — genuinely imperceptible on a still day,
    // clearly moving in a storm — wrapped in a box centred on the camera
    // (via their own offsetX/offsetZ) so they're always somewhere
    // overhead. Opacity eases toward cloudCoverage rather than snapping,
    // so a change in conditions reads as clouds gathering/clearing, not a
    // light switch.
    const windX = Math.cos(this._windDirectionRad);
    const windZ = Math.sin(this._windDirectionRad);
    const driftSpeed = 0.15 + this._windSpeed * 1.6;
    for (const cloud of this._cloudData) {
      cloud.offsetX += windX * driftSpeed * dt;
      cloud.offsetZ += windZ * driftSpeed * dt;
      if (cloud.offsetX > CLOUD_HALF_RANGE) cloud.offsetX -= CLOUD_HALF_RANGE * 2;
      else if (cloud.offsetX < -CLOUD_HALF_RANGE) cloud.offsetX += CLOUD_HALF_RANGE * 2;
      if (cloud.offsetZ > CLOUD_HALF_RANGE) cloud.offsetZ -= CLOUD_HALF_RANGE * 2;
      else if (cloud.offsetZ < -CLOUD_HALF_RANGE) cloud.offsetZ += CLOUD_HALF_RANGE * 2;
      if (camPos) cloud.sprite.position.set(camPos.x + cloud.offsetX, cloud.height, camPos.z + cloud.offsetZ);
      const targetOpacity = this._cloudCoverage * 0.75 * cloud.opacityJitter;
      cloud.sprite.material.opacity += (targetOpacity - cloud.sprite.material.opacity) * Math.min(1, dt * 0.5);
    }
  }
}
