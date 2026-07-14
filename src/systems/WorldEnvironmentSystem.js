import * as THREE from "three";
import { Materials } from "../utils/PlaceholderFactory.js";
import { radialGlowTexture, cloudBlobTexture, starSpriteTexture } from "../utils/ProceduralTexture.js";
import { CameraSystem } from "./CameraSystem.js";
import { InteriorSystem } from "./InteriorSystem.js";

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
const RAIN_COUNT = 220;
const RAIN_HALF_RANGE = 16; // falls within this box around the camera, horizontally
const RAIN_TOP = 7;
const RAIN_BOTTOM = -0.5;
const RAIN_STREAK_LENGTH = 0.35;

const _scratchShootingHead = new THREE.Vector3();
const _scratchShootingTail = new THREE.Vector3();

// A tint blended into the time-of-day sky colour per weather state — see
// _applySkyColor(). Distinct from fogDensity/cloudCoverage: those already
// existed and did their job, but a fog day and an overcast day with
// similar fog numbers still looked like the same grey sky with a
// slightly different haze, not genuinely different weather. `null` means
// "no tint" — clear/partlyCloudy/windy read as clean, ordinary sky days,
// exactly as they should.
const WEATHER_SKY_TINT = {
  overcast: { color: "#9aa3ac", strength: 0.5 },
  drizzle: { color: "#8b95a0", strength: 0.4 },
  lightRain: { color: "#7c8790", strength: 0.5 },
  heavyRain: { color: "#5f6a74", strength: 0.65 },
  fog: { color: "#c7c7c7", strength: 0.8 }, // flatter, greyer — fog scatters colour out of the air
  mist: { color: "#dde6ec", strength: 0.4 }, // lighter, cooler-white — a thinner haze than fog
  storm: { color: "#454b53", strength: 0.75 }, // the darkest, coldest sky of any condition
};
const STAR_COUNT = 320;
const CLOUD_COUNT = 12; // the low, denser layer — genuine weather-bearing cloud
const HIGH_CLOUD_COUNT = 7; // a second, higher, thinner layer — cirrus-like, drifts faster, never fully opaque

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
 * overwhelming": a modest, fixed number of clouds (two layers — see
 * _buildClouds()) and stars, soft glow sprites rather than lit 3D
 * spheres for the sun/moon, and every effect (cloud opacity, star
 * visibility, fog density) fades in proportion to the condition driving
 * it rather than switching on abruptly.
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
    this._starVisibility = 0;
    this._baseSkyColor = new THREE.Color("#bfe6ff");
    this._weatherTint = null; // { color: THREE.Color, strength } — see _applySkyColor()
    this._precipitation = 0;
    this._rainData = null; // { points, positions } — see _buildRain()
    // Atmosphere phase additions — see _updateCloudTint()/_applyCelestialVisibility()/_applyFog().
    this._cloudTintColor = new THREE.Color("#ffffff");
    this._starVisibilityBase = 0; // TimeOfDaySystem's own value, before cloud cover dims it further
    this._moonIllumBase = 0.6;
    this._hour = 12;
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem); // resolved once — see CameraSystem.js's own init() comment on why this is safe regardless of registration order
    this._interiorSystem = engine.getSystem(InteriorSystem);

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
    this._buildShootingStar();
    this._buildClouds();
    this._buildRain();

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

  /** "Occasional shooting stars during clear nights... these effects
   *  should remain subtle. The goal is quiet realism rather than
   *  spectacle." One reusable streak (a two-point line, the same
   *  cheap-geometry approach the rain particles already use), triggered
   *  at a random, unhurried interval and only when the sky is actually
   *  dark and clear — see _maybeTriggerShootingStar(). Nothing about this
   *  claims to be an astronomically accurate meteor shower; it's a rare,
   *  brief flourish, not a simulation. */
  _buildShootingStar() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.shootingStar = new THREE.LineSegments(geometry, material);
    this.shootingStar.frustumCulled = false;
    this.engine.scene.add(this.shootingStar);
    this._shootingStarState = null; // null while inactive; see _maybeTriggerShootingStar()
    this._shootingStarCooldown = this._randomShootingStarCooldown();
  }

  _randomShootingStarCooldown() {
    return 14 + Math.random() * 40; // occasional — roughly once every 15-55 seconds when conditions allow one at all
  }

  _maybeTriggerShootingStar(dt) {
    if (this._shootingStarState) return; // one at a time
    this._shootingStarCooldown -= dt;
    if (this._shootingStarCooldown > 0) return;
    this._shootingStarCooldown = this._randomShootingStarCooldown();

    const clearEnough = this._cloudCoverage < 0.25 && this._precipitation < 0.05;
    if (!clearEnough || this._starVisibility < 0.6) return; // only dark, clear nights

    const y = 0.35 + Math.random() * 0.5; // upper sky, well clear of the horizon
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    const start = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
    const travelAngle = angle + (Math.random() - 0.5) * 1.2;
    const end = new THREE.Vector3(Math.cos(travelAngle) * r, y - 0.15 - Math.random() * 0.15, Math.sin(travelAngle) * r).normalize();
    this._shootingStarState = { start, end, elapsed: 0, duration: 0.5 + Math.random() * 0.4 };
  }

  _updateShootingStar(dt, camPos) {
    this._maybeTriggerShootingStar(dt);
    if (!this._shootingStarState || !camPos) {
      if (this.shootingStar.material.opacity > 0) this.shootingStar.material.opacity = 0;
      return;
    }
    const state = this._shootingStarState;
    state.elapsed += dt;
    const t = state.elapsed / state.duration;
    if (t >= 1) {
      this._shootingStarState = null;
      this.shootingStar.material.opacity = 0;
      return;
    }

    // A short streak sliding along the path — the "head" leads, a "tail"
    // trails a little behind it, both travelling the same arc.
    const headPoint = _scratchShootingHead.lerpVectors(state.start, state.end, t).normalize().multiplyScalar(SKY_RADIUS).add(camPos);
    const tailPoint = _scratchShootingTail.lerpVectors(state.start, state.end, Math.max(0, t - 0.06)).normalize().multiplyScalar(SKY_RADIUS).add(camPos);
    const positions = this.shootingStar.geometry.attributes.position.array;
    positions[0] = tailPoint.x; positions[1] = tailPoint.y; positions[2] = tailPoint.z;
    positions[3] = headPoint.x; positions[4] = headPoint.y; positions[5] = headPoint.z;
    this.shootingStar.geometry.attributes.position.needsUpdate = true;
    // A quick fade in over the first ~12% of its travel, then a gradual fade out.
    this.shootingStar.material.opacity = Math.min(1, t * 8) * (1 - t) * 0.9;
  }

  /** "Multiple cloud layers." Two independent fields sharing one build
   *  helper: a low, denser layer (unchanged from before this phase —
   *  genuine weather-bearing cloud, closely tied to `cloudCoverage`) and
   *  a second, higher, sparser, thinner one (cirrus-like — drifts
   *  faster, catches more of the sky's own colour since it's more
   *  translucent, and never reaches full opacity even at total overcast).
   *  Both wrap around the camera the same "effectively infinite" way
   *  the ground already does — see update(). */
  _buildClouds() {
    this._cloudData = [
      ...this._buildCloudLayer(CLOUD_COUNT, { minScale: 10, maxScale: 19, minHeight: 12, maxHeight: 21, driftMultiplier: 1, opacityScale: 1 }),
      ...this._buildCloudLayer(HIGH_CLOUD_COUNT, { minScale: 14, maxScale: 24, minHeight: 24, maxHeight: 30, driftMultiplier: 1.8, opacityScale: 0.4 }),
    ];
  }

  _buildCloudLayer(count, { minScale, maxScale, minHeight, maxHeight, driftMultiplier, opacityScale }) {
    const clouds = [];
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: cloudBlobTexture(), transparent: true, depthWrite: false, opacity: 0 })
      );
      const scale = minScale + Math.random() * (maxScale - minScale);
      sprite.scale.set(scale, scale * 0.55, 1);
      this.engine.scene.add(sprite);
      clouds.push({
        sprite,
        // Offsets from the camera, not world-space coordinates — see update().
        offsetX: (Math.random() - 0.5) * CLOUD_HALF_RANGE * 2,
        offsetZ: (Math.random() - 0.5) * CLOUD_HALF_RANGE * 2,
        height: minHeight + Math.random() * (maxHeight - minHeight),
        opacityJitter: (0.7 + Math.random() * 0.3) * opacityScale,
        driftMultiplier,
      });
    }
    return clouds;
  }

  /** A field of short falling line-segments, camera-relative and wrapped
   *  the same way clouds are — cheap (one draw call), and, unlike the
   *  window's own rain-streak overlay (still the honest representation
   *  for what's happening on the glass itself — see docs/WORLD.md), this
   *  is real geometry any camera can see, indoors or out: a solid wall or
   *  roof correctly occludes it via ordinary depth testing, so it doesn't
   *  need to know whether the player happens to be inside or outside. */
  _buildRain() {
    const positions = new Float32Array(RAIN_COUNT * 2 * 3); // 2 points (top+bottom) per streak
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: "#bcd2de",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false, // rain reads as itself even in thick fog, rather than vanishing into the same haze it's falling through
    });
    this.rain = new THREE.LineSegments(geometry, material);
    this.rain.frustumCulled = false; // positions update every frame in local space the bounding sphere is never recomputed for; avoids it vanishing at the wrong moment
    this.engine.scene.add(this.rain);

    this._rainDrops = [];
    for (let i = 0; i < RAIN_COUNT; i++) {
      this._rainDrops.push({
        x: (Math.random() - 0.5) * RAIN_HALF_RANGE * 2,
        y: RAIN_BOTTOM + Math.random() * (RAIN_TOP - RAIN_BOTTOM),
        z: (Math.random() - 0.5) * RAIN_HALF_RANGE * 2,
        speed: 5 + Math.random() * 3,
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
    const density = Math.max(this._weatherFogDensity, this._dawnMistStrength());
    this.engine.scene.fog.near = this._baseFogNear * (1 - density * 0.75);
    this.engine.scene.fog.far = Math.max(this.engine.scene.fog.near + 4, this._baseFogFar * (1 - density * 0.88));
  }

  /** "Morning mist." A soft, low ground haze specifically around sunrise
   *  — real morning mist is overnight radiative cooling, not a weather
   *  *state* at all, so it's a small standalone contribution layered
   *  against whatever the current weather's fog density already is
   *  (`Math.max`, in `_applyFog()` — the stronger of the two wins, they
   *  don't stack into something thicker than either alone) rather than a
   *  new WEATHER_STATES entry. Fixed local-hour window, not sun-altitude
   *  — the same honest simplification `sunColor`'s own dawn/dusk blend in
   *  `TimeOfDaySystem.js` already uses, and for the same reason: this is
   *  a small atmospheric flourish, not something that needs to be exact
   *  to the minute or correct at every latitude. Suppressed once real
   *  precipitation is already falling — a rainstorm reads as itself, not
   *  as "misty." */
  _dawnMistStrength() {
    if (this._hour < 4 || this._hour > 9) return 0;
    const t = 1 - Math.min(1, Math.abs(this._hour - 6) / 2.5);
    return t * 0.3 * (1 - Math.min(1, this._precipitation * 2));
  }

  _onTimeChanged({ skyColor, sunDirection, moonDirection, moonIllumination, starVisibility, hour }) {
    this._baseSkyColor.set(skyColor);
    this._hour = hour;
    this._applySkyColor();
    this._updateCloudTint();
    if (this.engine.scene.fog) this.engine.scene.fog.color.copy(this.engine.scene.background);
    this._applyFog(); // dawn mist depends on `hour` — see its own comment

    this._sunDirection.copy(sunDirection);
    this._moonDirection.copy(moonDirection);
    this.sunSprite.visible = sunDirection.y > -0.08;
    this.moonSprite.visible = moonDirection.y > -0.08;
    this._starVisibilityBase = starVisibility;
    this._moonIllumBase = moonIllumination;
    this._applyCelestialVisibility();
    // "Stars mapped to the real night sky where practical" — not a full
    // constellation catalogue (a genuinely different-scale undertaking),
    // but the star field does turn slowly with the hour, the same
    // apparent motion the real sky has from Earth's own rotation, rather
    // than sitting frozen in one arrangement all night regardless of
    // time. A simplified rotation about the world's vertical axis, not a
    // properly latitude-tilted polar one — believable, not an
    // observatory-grade planetarium.
    this.stars.rotation.y = (hour / 24) * Math.PI * 2;
  }

  /** Blends the current weather's own sky tint (see WEATHER_SKY_TINT) into
   *  the time-of-day base colour that would otherwise be the whole story —
   *  "each weather condition should have its own distinct visual
   *  identity", not just a fog-density number. Called from both
   *  _onTimeChanged and _onEnvironmentChanged, since either the time of
   *  day or the weather can change independently and both need to
   *  recombine against whichever the other last was. */
  _applySkyColor() {
    const background = this.engine.scene.background instanceof THREE.Color ? this.engine.scene.background : new THREE.Color();
    background.copy(this._baseSkyColor);
    if (this._weatherTint) background.lerp(this._weatherTint.color, this._weatherTint.strength);
    this.engine.scene.background = background;
  }

  /** "Better cloud lighting." Clouds read as lit by the same sky they sit
   *  in — mostly white, but picking up whatever hue the sky itself
   *  currently has (a warm blush at golden hour, a cool blue-grey at
   *  night) and however grey a storm or overcast day already tints the
   *  background — rather than a single flat white regardless of
   *  conditions. Reacts to state that already exists (`_baseSkyColor`,
   *  `_weatherTint`); nothing new is computed here. */
  _updateCloudTint() {
    this._cloudTintColor.set("#ffffff").lerp(this._baseSkyColor, 0.35);
    if (this._weatherTint) this._cloudTintColor.lerp(this._weatherTint.color, this._weatherTint.strength * 0.6);
  }

  /** "Cloud cover influence" on the night sky. Stars and the moon each
   *  have their own base visibility from TimeOfDaySystem (how dark it is,
   *  what phase the moon's in) — this layers real cloud cover over that,
   *  the way an actually overcast night genuinely does hide the sky,
   *  without either signal needing to know about the other. Called from
   *  both _onTimeChanged and _onEnvironmentChanged, same reasoning as
   *  _applySkyColor() above. */
  _applyCelestialVisibility() {
    const clearFactor = 1 - this._cloudCoverage * 0.7;
    this.moonSprite.material.opacity = (0.25 + this._moonIllumBase * 0.65) * clearFactor;
    this.stars.material.opacity = this._starVisibilityBase * 0.85 * clearFactor;
    this._starVisibility = this._starVisibilityBase * clearFactor;
  }

  _onEnvironmentChanged({ id, fogDensity, cloudCoverage, windSpeed, windDirectionRad, precipitation }) {
    this._weatherFogDensity = fogDensity ?? 0;
    this._cloudCoverage = cloudCoverage ?? 0.1;
    this._windSpeed = windSpeed ?? 0.1;
    this._windDirectionRad = windDirectionRad ?? 0;
    this._precipitation = precipitation ?? 0;
    const tintDef = WEATHER_SKY_TINT[id];
    this._weatherTint = tintDef ? { color: new THREE.Color(tintDef.color), strength: tintDef.strength } : null;
    this._applySkyColor();
    this._updateCloudTint();
    this._applyCelestialVisibility();
    if (this.engine.scene.fog) this.engine.scene.fog.color.copy(this.engine.scene.background);
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
    // light switch. Each cloud's own driftMultiplier (see
    // _buildCloudLayer()) lets the high, thin layer visibly outrun the
    // low one — real high cirrus does exactly this, no separate wind
    // value needed for it.
    const windX = Math.cos(this._windDirectionRad);
    const windZ = Math.sin(this._windDirectionRad);
    const driftSpeed = 0.15 + this._windSpeed * 1.6;
    for (const cloud of this._cloudData) {
      const speed = driftSpeed * cloud.driftMultiplier;
      cloud.offsetX += windX * speed * dt;
      cloud.offsetZ += windZ * speed * dt;
      if (cloud.offsetX > CLOUD_HALF_RANGE) cloud.offsetX -= CLOUD_HALF_RANGE * 2;
      else if (cloud.offsetX < -CLOUD_HALF_RANGE) cloud.offsetX += CLOUD_HALF_RANGE * 2;
      if (cloud.offsetZ > CLOUD_HALF_RANGE) cloud.offsetZ -= CLOUD_HALF_RANGE * 2;
      else if (cloud.offsetZ < -CLOUD_HALF_RANGE) cloud.offsetZ += CLOUD_HALF_RANGE * 2;
      if (camPos) cloud.sprite.position.set(camPos.x + cloud.offsetX, cloud.height, camPos.z + cloud.offsetZ);
      const targetOpacity = this._cloudCoverage * 0.75 * cloud.opacityJitter;
      cloud.sprite.material.opacity += (targetOpacity - cloud.sprite.material.opacity) * Math.min(1, dt * 0.5);
      cloud.sprite.material.color.copy(this._cloudTintColor);
    }
    // Rain falls continuously whenever precipitation is active and the
    // camera isn't inside a registered interior volume (InteriorSystem —
    // see its own comment for why this is architectural, not
    // Workshop-specific). That check matters for a real reason, not just
    // tidiness: raindrops spawn within a box centred on the camera, so if
    // the camera is standing inside an enclosed room, a good number of
    // them end up inside that same enclosed space too — genuinely
    // co-located with the player, not behind a wall or roof from their
    // perspective at all. Depth testing only ever occludes geometry that
    // actually sits *between* the camera and a particle; it does nothing
    // for a particle that was never behind anything to begin with, which
    // is exactly what "rain falling inside enclosed buildings" turned out
    // to be. Offsets (x/z) are relative to the camera, like clouds; y is
    // real world height, since rain falls toward the ground, not toward
    // wherever the player's own head happens to be.
    const indoors = camPos ? (this._interiorSystem?.isInside(camPos) ?? false) : false;
    const targetRainOpacity = indoors ? 0 : Math.min(1, this._precipitation * 1.15) * 0.55;
    this.rain.material.opacity += (targetRainOpacity - this.rain.material.opacity) * Math.min(1, dt * 2);
    if (camPos && this.rain.material.opacity > 0.01) {
      const positions = this.rain.geometry.attributes.position.array;
      const fallSpeedMultiplier = 1 + this._windSpeed * 0.5;
      const driftX = Math.cos(this._windDirectionRad) * this._windSpeed * 0.7;
      const driftZ = Math.sin(this._windDirectionRad) * this._windSpeed * 0.7;
      for (let i = 0; i < this._rainDrops.length; i++) {
        const drop = this._rainDrops[i];
        drop.y -= drop.speed * fallSpeedMultiplier * dt;
        drop.x += driftX * dt;
        drop.z += driftZ * dt;
        if (drop.y < RAIN_BOTTOM) {
          drop.y = RAIN_TOP;
          drop.x = (Math.random() - 0.5) * RAIN_HALF_RANGE * 2;
          drop.z = (Math.random() - 0.5) * RAIN_HALF_RANGE * 2;
        }
        if (drop.x > RAIN_HALF_RANGE) drop.x -= RAIN_HALF_RANGE * 2;
        else if (drop.x < -RAIN_HALF_RANGE) drop.x += RAIN_HALF_RANGE * 2;
        if (drop.z > RAIN_HALF_RANGE) drop.z -= RAIN_HALF_RANGE * 2;
        else if (drop.z < -RAIN_HALF_RANGE) drop.z += RAIN_HALF_RANGE * 2;

        const worldX = camPos.x + drop.x;
        const worldZ = camPos.z + drop.z;
        const base = i * 6;
        positions[base] = worldX;
        positions[base + 1] = drop.y;
        positions[base + 2] = worldZ;
        positions[base + 3] = worldX;
        positions[base + 4] = drop.y - RAIN_STREAK_LENGTH;
        positions[base + 5] = worldZ;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    this._updateShootingStar(dt, camPos);
  }
}
