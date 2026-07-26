import * as THREE from "three";
import { radialGlowTexture, cloudBlobTexture, starSpriteTexture } from "../utils/ProceduralTexture.js";
import { CONSTELLATIONS, raDecToSpherePosition } from "../utils/Astronomy.js";
import { CameraSystem } from "./CameraSystem.js";
import { InteriorSystem } from "./InteriorSystem.js";

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
// Version 4, Phase 9b ("Falling Snow") — a separate box/count from
// rain's own, not shared: fewer flakes than raindrops (SNOW_COUNT <
// RAIN_COUNT) since each one is individually larger and more visible, not
// aiming for rain's own density. Same TOP/BOTTOM vertical range as rain —
// no reason for snow to fall through a different vertical volume.
const SNOW_COUNT = 180;
const SNOW_HALF_RANGE = 16;
const SNOW_TOP = 7;
const SNOW_BOTTOM = -0.5;
// Version 4, Phase 9c ("Lightning + Thunder") — LIGHTNING_DECAY_RATE is
// deliberately the SAME numeric rate LightingSystem's own
// `_lightningFlash` decays at (`dt * 3.5`), duplicated here rather than
// shared/imported: the visual bolt and the light-level pulse move at the
// same tempo without coupling the two systems together. If
// LightingSystem's own decay rate is ever retuned, this constant needs
// updating to match — not a shared value by accident.
const LIGHTNING_DECAY_RATE = 3.5;
const LIGHTNING_BOLT_POINTS = 7; // enough to read as a jagged channel without being fussy

const _scratchShootingHead = new THREE.Vector3();
const _scratchShootingTail = new THREE.Vector3();
const _scratchLightningPoint = new THREE.Vector3();

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
  // Cooler/whiter than the rain tints above — a snow sky reads as flatter
  // and colder, not the same grey-blue an ordinary rain sky does.
  lightSnow: { color: "#c9d3da", strength: 0.55 },
  heavySnow: { color: "#aab4bc", strength: 0.7 },
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
 * EnvironmentSystem *compute*: the sky colour and fog, the sun and moon
 * discs, the stars, and two layers of drifting clouds. Neither of those
 * two systems touches the scene directly — this is deliberately the only
 * place `scene.background`/`scene.fog`/any of these meshes get created
 * or changed, the same "compute state, emit an event, let one dedicated
 * renderer react" split the whole environment stack uses (see
 * docs/WORLD.md's Environment System section). The Workshop's actual
 * ground is `TerrainSystem.js`'s own job entirely, since the Workshop
 * Reliability phase — see that file's own top comment for why one
 * system, not two, now owns it.
 *
 * Nothing here is aware that a Workshop, or any other building, exists —
 * the sky and every effect below apply to the *scene*, not to any one
 * structure in it. That's what makes "Builder compatibility... without
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
    this._isSnowing = false; // see update()'s own rain/snow opacity-target split
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

    // Workshop Reliability phase — "there should no longer be two
    // separate ground layers." The flat, infinitely-recentring outdoor
    // ground that used to be built here is gone; `TerrainSystem.js` is
    // now the Workshop's one and only ground (a large editable patch
    // plus a much larger non-editable skirt, both owned by that one
    // class — see its own top comment). This system still owns the sky,
    // fog, sun/moon/stars, clouds, and rain, exactly as before; it just
    // no longer also draws a second ground underneath all of it.

    engine.scene.fog = new THREE.Fog("#bfe6ff", this._baseFogNear, this._baseFogFar);

    this._buildSunMoon();
    this._buildStars();
    this._buildConstellationStars();
    this._buildConstellationLines();
    this._buildShootingStar();
    this._buildLightningBolt();
    this._buildClouds();
    this._buildRain();
    this._buildSnow();

    engine.events.on("timeofday:changed", (state) => this._onTimeChanged(state));
    engine.events.on("environment:changed", (state) => this._onEnvironmentChanged(state));
    // Version 4, Phase 9c — LightingSystem owns *when* a flash happens
    // (storm state, timer, cadence); this system only reacts visually.
    // The event's own `distance` payload drives LightingSystem's own
    // thunder-delay math and isn't needed here — a bolt's own shape
    // doesn't depend on how far away the strike is.
    engine.events.on("lightning:flash", () => this._triggerLightningBolt());
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

  /** Version 4, Phase 9 ("Atmosphere, Continued") — a real, modest
   *  constellation catalogue (see `Astronomy.js`'s own `CONSTELLATIONS`).
   *  A second, separate `THREE.Points` object rather than appending into
   *  `_buildStars()`'s own random background buffer: it lets the
   *  catalogued stars read as subtly brighter (real named stars mostly
   *  are the brighter ones — `size: 2.4` vs. the background field's
   *  `1.6`, a deliberate, modest step up, not a spotlight) without
   *  touching that method at all, and keeps `_buildConstellationLines()`
   *  simple — each edge just resolves its own endpoint positions directly
   *  rather than tracking offsets into a shared buffer. */
  _buildConstellationStars() {
    const allStars = CONSTELLATIONS.flatMap((c) => c.stars);
    const positions = new Float32Array(allStars.length * 3);
    const scratch = new THREE.Vector3();
    allStars.forEach((star, i) => {
      raDecToSpherePosition(star.ra, star.dec, SKY_RADIUS, scratch);
      positions[i * 3] = scratch.x;
      positions[i * 3 + 1] = scratch.y;
      positions[i * 3 + 2] = scratch.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: starSpriteTexture(),
      size: 2.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.constellationStars = new THREE.Points(geometry, material);
    this.engine.scene.add(this.constellationStars);
  }

  /** Version 4, Phase 9 — the asterism lines connecting each catalogued
   *  constellation's own stars into its recognizable pattern (the Big
   *  Dipper's chain, Cassiopeia's W...). Follows `_buildShootingStar()`'s
   *  own precedent below: a second small, cheap `THREE.LineSegments`
   *  object, static after creation (only its shared transform changes
   *  frame to frame, same as `this.stars`) — no `frustumCulled = false`
   *  needed here the way the shooting star and rain need it, since this
   *  geometry's vertex data never moves after `init()`. */
  _buildConstellationLines() {
    const positions = [];
    const scratch = new THREE.Vector3();
    for (const constellation of CONSTELLATIONS) {
      for (const [a, b] of constellation.edges) {
        for (const index of [a, b]) {
          const star = constellation.stars[index];
          raDecToSpherePosition(star.ra, star.dec, SKY_RADIUS, scratch);
          positions.push(scratch.x, scratch.y, scratch.z);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    const material = new THREE.LineBasicMaterial({
      color: "#cfe0ff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.constellationLines = new THREE.LineSegments(geometry, material);
    this.engine.scene.add(this.constellationLines);
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

  /** Version 4, Phase 9c ("Lightning + Thunder") — "a visible lightning
   *  bolt... timed together" with LightingSystem's own existing flash.
   *  A single jagged `THREE.Line` (a connected polyline, not
   *  `LineSegments` — no need to duplicate points into segment pairs for
   *  one continuous channel), rebuilt fresh each trigger rather than
   *  travelling like the shooting star: a bolt's own shape is static
   *  once it flashes, only its camera-relative anchor needs to follow
   *  the player (see update()'s own recenter, matching the
   *  constellation-lines pattern — build the shape once, move the whole
   *  object — rather than rain/snow's per-vertex rewrite, which exists
   *  because those particles genuinely move independently frame to
   *  frame). Deliberately a single channel, no branching forks — "avoid
   *  making the room feel smoky or busy" applies here too. */
  _buildLightningBolt() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LIGHTNING_BOLT_POINTS * 3), 3));
    const material = new THREE.LineBasicMaterial({ color: "#eaf3ff", transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.lightningBolt = new THREE.Line(geometry, material);
    this.lightningBolt.frustumCulled = false; // positions rewritten on trigger, same reasoning as the shooting star
    this.engine.scene.add(this.lightningBolt);
    this._lightningBoltOpacity = 0;
  }

  /** Triggered by `LightingSystem`'s own `"lightning:flash"` event (see
   *  init()) — a jagged path descending from high in the sky toward the
   *  horizon, a stylised flash-then-fade rather than a strike-to-ground
   *  animation. Built once, in local (camera-anchor) unit-direction
   *  space — deliberately NOT rotated with time-of-day the way the star
   *  field is; a bolt has no real celestial position to track. */
  _triggerLightningBolt() {
    const positions = this.lightningBolt.geometry.attributes.position.array;
    const azimuth = Math.random() * Math.PI * 2;
    for (let i = 0; i < LIGHTNING_BOLT_POINTS; i++) {
      const t = i / (LIGHTNING_BOLT_POINTS - 1);
      const y = 0.92 - t * 0.72; // descends from high overhead (~0.92) toward the horizon (~0.2)
      const jitter = (Math.random() - 0.5) * 0.18 * (1 - t * 0.5); // wider jitter near the top, narrowing toward the base — reads as a jagged channel, not a random scribble
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      _scratchLightningPoint
        .set(Math.cos(azimuth) * r, y, Math.sin(azimuth) * r)
        .normalize()
        .multiplyScalar(SKY_RADIUS);
      const base = i * 3;
      positions[base] = _scratchLightningPoint.x + jitter * SKY_RADIUS;
      positions[base + 1] = _scratchLightningPoint.y;
      positions[base + 2] = _scratchLightningPoint.z + jitter * SKY_RADIUS;
    }
    this.lightningBolt.geometry.attributes.position.needsUpdate = true;
    this._lightningBoltOpacity = 1;
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
   *  is real geometry any camera can see, not a 2D screen effect.
   *  **Corrected, Version 4 Phase 9b:** this used to claim ordinary
   *  depth testing alone was enough to keep rain out of view indoors —
   *  not true, since raindrops spawn in a box centred on the *camera*,
   *  so a good number of them end up genuinely co-located with an indoor
   *  player rather than ever being behind anything to begin with; depth
   *  testing only occludes geometry actually *between* the camera and a
   *  particle. `update()`'s own `indoors` check (shared with the new
   *  `_buildSnow()` below) is what actually keeps this honest — see its
   *  own comment for the full reasoning. */
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

  /** Version 4, Phase 9b ("Falling Snow") — a real dedicated snow
   *  visual, replacing the old approximation where a snow-mapped weather
   *  state just borrowed rain's own look by intensity (see
   *  `WeatherProvider.js`'s own `WMO_CODE_MAP`). A `THREE.Points` field
   *  rather than `_buildRain()`'s `LineSegments` — flakes read as soft
   *  falling dots, not streaks — reusing `starSpriteTexture()` directly
   *  rather than a new texture, the same reuse Wave 1's constellation
   *  stars already established. `sizeAttenuation: true` (unlike the star
   *  field's own `false`): snow is real, near-depth geometry that should
   *  grow larger as it nears the camera, not effectively-at-infinity like
   *  stars. Mutually exclusive with rain at the render level — see
   *  `update()`'s own `_isSnowing` branch — since `lightSnow`/`heavySnow`
   *  and every rain-family state are already mutually exclusive weather
   *  states; both fields exist simultaneously only to make crossfading
   *  between them (a direct rain→snow transition, say) a smooth opacity
   *  ease rather than a hard cut. */
  _buildSnow() {
    const positions = new Float32Array(SNOW_COUNT * 3); // one point per flake, not a two-point streak like rain
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: starSpriteTexture(),
      size: 5,
      sizeAttenuation: true,
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false, // snow reads as itself even in thick fog, same reasoning as rain
    });
    this.snow = new THREE.Points(geometry, material);
    this.snow.frustumCulled = false; // positions update every frame in local space, same as rain
    this.engine.scene.add(this.snow);

    this._snowFlakes = [];
    for (let i = 0; i < SNOW_COUNT; i++) {
      this._snowFlakes.push({
        x: (Math.random() - 0.5) * SNOW_HALF_RANGE * 2,
        y: SNOW_BOTTOM + Math.random() * (SNOW_TOP - SNOW_BOTTOM),
        z: (Math.random() - 0.5) * SNOW_HALF_RANGE * 2,
        speed: 0.6 + Math.random() * 0.5, // roughly an order of magnitude slower than rain's own 5-8 — the single biggest lever for reading as visually distinct, not "rain but renamed"
        drift: (Math.random() - 0.5) * 0.6, // per-flake sideways wobble magnitude — a cheap, honest touch so falling snow reads as less mechanically uniform than rain
        driftPhase: Math.random() * Math.PI * 2,
      });
    }
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
    // The star field turns slowly with the hour, the same apparent motion
    // the real sky has from Earth's own rotation, rather than sitting
    // frozen in one arrangement all night regardless of time. A
    // simplified rotation about the world's vertical axis, not a
    // properly latitude-tilted polar one — believable, not an
    // observatory-grade planetarium. Version 4, Phase 9 added a real,
    // modest constellation catalogue (`Astronomy.js`'s own
    // `CONSTELLATIONS`, rendered via `_buildConstellationStars()`/
    // `_buildConstellationLines()`) layered onto this exact same
    // rotation, unchanged — only the *position* source moved from random
    // to real RA/Dec, per that catalogue's own docstring on what that
    // does and doesn't correct for.
    const starRotationY = (hour / 24) * Math.PI * 2;
    this.stars.rotation.y = starRotationY;
    this.constellationStars.rotation.y = starRotationY;
    this.constellationLines.rotation.y = starRotationY;
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
    // The catalogued stars share the background field's own opacity
    // ceiling (brightness differentiation already comes from `size`, not
    // extra opacity budget); the lines connecting them sit at half that —
    // "a subtle enhancement," per this file's own restraint principle,
    // not a bold overlay on top of an already-restrained sky.
    this.constellationStars.material.opacity = this._starVisibilityBase * 0.85 * clearFactor;
    this.constellationLines.material.opacity = this._starVisibilityBase * 0.85 * clearFactor * 0.5;
    this._starVisibility = this._starVisibilityBase * clearFactor;
  }

  _onEnvironmentChanged({ id, fogDensity, cloudCoverage, windSpeed, windDirectionRad, precipitation }) {
    this._weatherFogDensity = fogDensity ?? 0;
    this._cloudCoverage = cloudCoverage ?? 0.1;
    this._windSpeed = windSpeed ?? 0.1;
    this._windDirectionRad = windDirectionRad ?? 0;
    this._precipitation = precipitation ?? 0;
    // Which of rain/snow (already mutually-exclusive weather states)
    // should be the active precipitation visual right now — see
    // update()'s own rain/snow opacity-target split.
    this._isSnowing = id === "lightSnow" || id === "heavySnow";
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

    // Sun, moon, and stars are all positioned relative to the camera every
    // frame, not the world origin — see SKY_RADIUS's own comment. Distance
    // from the camera is what matters for both "stays inside the far
    // plane" and "always overhead no matter where you've walked to."
    if (camPos) {
      this.sunSprite.position.copy(this._sunDirection).multiplyScalar(SKY_RADIUS).add(camPos);
      this.moonSprite.position.copy(this._moonDirection).multiplyScalar(SKY_RADIUS).add(camPos);
      this.stars.position.copy(camPos);
      this.constellationStars.position.copy(camPos);
      this.constellationLines.position.copy(camPos);
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
    // Rain (or, per Version 4 Phase 9b, snow — see below) falls
    // continuously whenever precipitation is active and the camera isn't
    // inside a registered interior volume (InteriorSystem — see its own
    // comment for why this is architectural, not Workshop-specific). That
    // check matters for a real reason, not just tidiness: drops/flakes
    // spawn within a box centred on the camera, so if the camera is
    // standing inside an enclosed room, a good number of them end up
    // inside that same enclosed space too — genuinely co-located with the
    // player, not behind a wall or roof from their perspective at all.
    // Depth testing only ever occludes geometry that actually sits
    // *between* the camera and a particle; it does nothing for a particle
    // that was never behind anything to begin with, which is exactly what
    // "precipitation falling inside enclosed buildings" turned out to be.
    // Offsets (x/z) are relative to the camera, like clouds; y is real
    // world height, since precipitation falls toward the ground, not
    // toward wherever the player's own head happens to be. Rain and snow
    // share this one `indoors`/`precipOpacity` computation — they're
    // already mutually-exclusive weather states (see `_isSnowing`,
    // set in `_onEnvironmentChanged`), so exactly one of the two targets
    // below is ever non-zero at a time; both still ease independently so
    // a direct rain→snow (or snow→rain) transition crossfades smoothly
    // rather than cutting.
    const indoors = camPos ? (this._interiorSystem?.isInside(camPos) ?? false) : false;
    const precipOpacity = indoors ? 0 : Math.min(1, this._precipitation * 1.15) * 0.55;
    const targetRainOpacity = this._isSnowing ? 0 : precipOpacity;
    const targetSnowOpacity = this._isSnowing ? precipOpacity : 0;
    this.rain.material.opacity += (targetRainOpacity - this.rain.material.opacity) * Math.min(1, dt * 2);
    this.snow.material.opacity += (targetSnowOpacity - this.snow.material.opacity) * Math.min(1, dt * 2);
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
    if (camPos && this.snow.material.opacity > 0.01) {
      const positions = this.snow.geometry.attributes.position.array;
      // Less wind-accelerated in fall speed than rain (0.3 vs 0.5) but
      // drifts sideways more (1.1 vs 0.7) — lighter flakes catch the wind
      // more than they're driven straight down by it, the inverse
      // emphasis from rain's own heavier, faster drops.
      const fallSpeedMultiplier = 1 + this._windSpeed * 0.3;
      const driftX = Math.cos(this._windDirectionRad) * this._windSpeed * 1.1;
      const driftZ = Math.sin(this._windDirectionRad) * this._windSpeed * 1.1;
      for (let i = 0; i < this._snowFlakes.length; i++) {
        const flake = this._snowFlakes[i];
        flake.driftPhase += dt * 0.8;
        flake.y -= flake.speed * fallSpeedMultiplier * dt;
        flake.x += (driftX + Math.sin(flake.driftPhase) * flake.drift) * dt;
        flake.z += (driftZ + Math.cos(flake.driftPhase) * flake.drift) * dt;
        if (flake.y < SNOW_BOTTOM) {
          flake.y = SNOW_TOP;
          flake.x = (Math.random() - 0.5) * SNOW_HALF_RANGE * 2;
          flake.z = (Math.random() - 0.5) * SNOW_HALF_RANGE * 2;
        }
        if (flake.x > SNOW_HALF_RANGE) flake.x -= SNOW_HALF_RANGE * 2;
        else if (flake.x < -SNOW_HALF_RANGE) flake.x += SNOW_HALF_RANGE * 2;
        if (flake.z > SNOW_HALF_RANGE) flake.z -= SNOW_HALF_RANGE * 2;
        else if (flake.z < -SNOW_HALF_RANGE) flake.z += SNOW_HALF_RANGE * 2;

        const base = i * 3;
        positions[base] = camPos.x + flake.x;
        positions[base + 1] = flake.y;
        positions[base + 2] = camPos.z + flake.z;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    this._updateShootingStar(dt, camPos);

    // Version 4, Phase 9c — the bolt's own shape is static once
    // triggered (see _triggerLightningBolt()'s own comment); only its
    // opacity (matching LightingSystem's own flash decay rate — see
    // LIGHTNING_DECAY_RATE) and its camera-relative anchor need updating
    // each frame, the same "build once, recentre the whole object"
    // pattern the constellation lines already use.
    if (this._lightningBoltOpacity > 0) {
      this._lightningBoltOpacity = Math.max(0, this._lightningBoltOpacity - dt * LIGHTNING_DECAY_RATE);
      this.lightningBolt.material.opacity = this._lightningBoltOpacity;
      if (camPos) this.lightningBolt.position.copy(camPos);
    }
  }
}
