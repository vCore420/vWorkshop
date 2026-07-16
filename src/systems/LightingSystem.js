import * as THREE from "three";
import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { box, Materials } from "../utils/PlaceholderFactory.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";
import { FurnitureSystem } from "./FurnitureSystem.js";
import { AudioSystem } from "./AudioSystem.js";

/**
 * LightingSystem
 * --------------
 * Owns every light in the scene. It doesn't decide *when* it's day or night
 * or what the weather is — TimeOfDaySystem and EnvironmentSystem emit events
 * describing that, and LightingSystem just reacts: updating the sun's
 * direction/colour and dimming practical fixtures. This split means a
 * future system (say, seasonal changes) can influence lighting just by
 * emitting an event, with no direct dependency on this file.
 *
 * Practical lights (ceiling pendants + the workbench lamp) are gated by a
 * physical light switch by the door — flipping it is a real interaction,
 * and its state is persisted.
 *
 * Registration order matters: this system must be added to the Engine
 * *after* RoomLayoutSystem and FurnitureSystem, since it attaches fixtures
 * to geometry they create.
 */
export class LightingSystem {
  constructor() {
    this.lightsOn = true;
    this.practicalLights = [];
    this._weatherDampening = 0;
    this._lightingQuality = "medium"; // "low" | "medium" | "high" — see setLightingQuality
    this._shadowQuality = "medium"; // "off" | "low" | "medium" | "high" — see setShadowQuality
    this._baseHemiIntensity = 0.55;
    this._baseAmbientIntensity = 0.18;
    this._stormActive = false;
    this._lightningTimer = 0;
    this._lightningFlash = 0; // 0-1, decays after each flash — see update()
    // Sound & Presence phase — see _checkClockChime()'s own comment.
    this._lastChimeHour = null;
  }

  /** Lets another system's own light (built and owned there, since that
   *  system already knows exactly where it needs to sit — see
   *  `ComputerSystem.js`'s own desk lamp) participate in the Workshop
   *  light switch without `LightingSystem` needing to know how to build
   *  it. "Connect the desk lamp to the Workshop lighting system" is
   *  exactly this: one call, from wherever the light already lives. */
  /** Read by Settings' own Diagnostics page — see SettingsApp.js's
   *  renderDiagnostics(). Kept as a real getter rather than the page
   *  reaching into `_shadowQuality` directly, respecting the same
   *  privacy convention every other underscore-prefixed field here
   *  implies. */
  getShadowQuality() {
    return this._shadowQuality;
  }

  registerPracticalLight(light, { isLampLight = false } = {}) {
    light.userData.baseIntensity = light.intensity;
    light.userData.isLampLight = isLampLight;
    this.practicalLights.push(light);
    this._applyLightsOn();
  }

  init(engine) {
    this.engine = engine;

    // "Open spaces without nearby walls remain noticeably dark... the
    // goal is not brighter lighting, the goal is more believable
    // lighting." The ground colour (light bounced up off the floor, in a
    // hemisphere light's own model) was a dark, nearly-black brown —
    // brightened to a warmer, lighter tone so floor-facing surfaces get
    // genuine indirect fill even far from any point light, rather than
    // uniformly raising intensity everywhere (which would also brighten
    // areas that already read fine).
    this.hemi = new THREE.HemisphereLight("#bcd7e6", "#5f4c38", 0.55);
    engine.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff2df", 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    // "Improve shadow quality by expanding shadow coverage... shadow
    // distance." The original ±6/far-20 frustum matched the Workshop
    // room's own footprint exactly, leaving any Builder-created structure
    // further out in the wider outdoor world with no shadow coverage at
    // all. Expanded in stages across later phases to the current
    // ±13/far-34 — map size (see setLightingQuality) is deliberately left
    // unchanged, so this trades a little per-pixel shadow crispness for
    // genuinely covering more of the world, rather than also increasing
    // GPU cost to compensate. (None of these expansions actually took
    // effect until this phase — see the `updateProjectionMatrix()` call
    // below and its own comment.)
    this.sun.shadow.camera.far = 34;
    this.sun.shadow.camera.left = -13;
    this.sun.shadow.camera.right = 13;
    this.sun.shadow.camera.top = 13;
    this.sun.shadow.camera.bottom = -13;
    // "Shadow radius... shadow consistency." radius softens shadow edges
    // (only visible with PCFSoftShadowMap, already the default — see
    // Engine.js) rather than leaving them at a harsh, aliased default;
    // bias/normalBias avoid shadow acne (faint self-shadowing stripes on
    // flat surfaces from floating-point precision, which read as
    // inconsistent — flickering slightly as the camera moves — rather
    // than a stable, believable shadow).
    this.sun.shadow.radius = 2;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    // Visual Identity phase — "the terrain correctly receives lighting but
    // no longer receives dynamic shadows... determine why shadow reception
    // was lost." The actual cause: every property set above
    // (near/far/left/right/top/bottom) only ever changes the plain JS
    // fields on `OrthographicCamera` — it does *not* recompute
    // `projectionMatrix` itself, and three.js's own shadow-map render path
    // (`LightShadow.updateMatrices()`) reads `camera.projectionMatrix`
    // directly rather than deriving it fresh. Without this call, the
    // shadow camera silently kept using the *construction-time* default
    // projection matrix (a DirectionalLightShadow's own default camera is
    // `±5, near 0.5, far 500`) no matter what this file set those
    // properties to — meaning every "expand shadow coverage" pass in this
    // system's own history (±6 → ±9 → the ±13 above) never actually took
    // effect. That mismatch was always there, but only became this
    // visible once the terrain grew from a small, roughly room-sized
    // patch to a real 200m ground: a ±5 frustum pinned to the origin
    // covers a small patch almost by accident, but leaves nearly all of a
    // 200m terrain permanently outside the shadow camera's own view,
    // exactly the symptom reported. One call fixes it for every future
    // change to these properties too, not just this one.
    this.sun.shadow.camera.updateProjectionMatrix();
    engine.scene.add(this.sun, this.sun.target);

    this.ambientFill = new THREE.AmbientLight("#4a3a2c", 0.18);
    engine.scene.add(this.ambientFill);

    this._attachPracticalLights();
    this._buildLightSwitch();

    engine.events.on("timeofday:changed", (state) => this._onTimeChanged(state));
    engine.events.on("environment:changed", (state) => this._onEnvironmentChanged(state));

    engine.events.on("persistence:save", (bag) => {
      bag.lighting = { lightsOn: this.lightsOn };
    });
    engine.events.on("persistence:load", (bag) => {
      if (bag?.lighting) this.setLightsOn(!!bag.lighting.lightsOn);
    });
  }

  _attachPracticalLights() {
    const roomSystem = this.engine.getSystem(RoomLayoutSystem);
    const sockets = roomSystem?.room?.ceilingLightSockets ?? [];
    for (const pos of sockets) {
      const light = new THREE.PointLight("#ffe4b8", 0.9, 6, 2);
      light.position.copy(pos);
      light.userData.baseIntensity = 0.9;
      this.engine.scene.add(light);
      this.practicalLights.push(light);
    }

    // Workshop Interior phase — "wall lights." Exactly the same shape as
    // the ceiling sockets above, just a second array from the room and a
    // slightly warmer, gentler fixture (a sconce sits close to head
    // height, not up at the ceiling — a pendant's own intensity would
    // read as glaring this close).
    const wallSockets = roomSystem?.room?.wallLightSockets ?? [];
    for (const pos of wallSockets) {
      const light = new THREE.PointLight("#ffcf9c", 0.5, 3.5, 2);
      light.position.copy(pos);
      light.userData.baseIntensity = 0.5;
      this.engine.scene.add(light);
      this.practicalLights.push(light);
    }

    // Decorative Details phase — "clocks." Cached here (not looked up
    // fresh every time) the same way every other room-provided mesh
    // reference in this method already is.
    this.clockHourHand = roomSystem?.room?.clockHourHand ?? null;
    this.clockMinuteHand = roomSystem?.room?.clockMinuteHand ?? null;

    const furnitureSystem = this.engine.getSystem(FurnitureSystem);
    const workbench = furnitureSystem?.getPiece("workbench");
    const lampSocket = workbench?.entity?.object3D?.userData?.lampSocket;
    if (lampSocket) {
      const worldPos = workbench.entity.object3D.localToWorld(lampSocket.clone());
      const lampLight = new THREE.PointLight("#ffe9c2", 0.9, 3, 2);
      lampLight.position.copy(worldPos);
      lampLight.userData.baseIntensity = 0.9;
      lampLight.userData.isLampLight = true; // see setLightingQuality — the one practical light "low" skips
      this.engine.scene.add(lampLight);
      this.practicalLights.push(lampLight);
    }

    this._applyLightsOn();
  }

  _buildLightSwitch() {
    const switchEntity = new Entity("lightSwitch").tag("structural");
    // Workshop Interior phase — "material quality... plastic." A light
    // switch plate is moulded plastic in practically every real building;
    // this one was sharing matte()'s numbers since phase 1.
    const plate = box(0.08, 0.12, 0.02, Materials.plastic("#e7e2d6"));
    // On the south wall, on the far side of the front doors from where it
    // used to sit — the doors sit at x=0, spanning ±1.3 (see
    // WORKSHOP_DOOR in layoutDefault.js), and a doorway genuinely splits
    // a wall into two separate segments either side of it, which is what
    // "the opposite wall" means here rather than a literally different
    // wall. z nudged to 2.845 — closer still to the wall's actual
    // interior face (~2.85) than before, sitting flush against it rather
    // than with a small, noticeable gap, while still avoiding z-fighting.
    plate.position.set(1.5, 1.3, 2.935);

    // Workshop Interior phase — "small interaction sounds... a switch
    // that actually does something." A real rocker toggle, physically
    // flipped by setLightsOn() rather than a flat plate implying a switch
    // exists somewhere unseen. Parented to the plate so it inherits the
    // plate's own world transform for free.
    this.switchToggle = box(0.03, 0.06, 0.015, Materials.plastic("#2c2c2c"));
    this.switchToggle.position.set(0, 0.02, 0.017);
    plate.add(this.switchToggle);
    this._applySwitchToggle();

    switchEntity.addComponent(new MeshComponent(plate, this.engine.scene));
    switchEntity.addComponent(
      new InteractableComponent({
        prompt: "Flip the light switch",
        radius: 0.9, // deliberately tighter than the standard "small object" 2.0m tier; see docs/REFINEMENT.md
        onInteract: () => this.setLightsOn(!this.lightsOn),
      })
    );
    this.engine.entities.create(switchEntity);
  }

  /** The toggle rocks between a small up/down tilt and vertical offset —
   *  cheap enough to just set outright rather than damp, since a light
   *  switch flips instantly in reality, unlike the fixtures it controls. */
  _applySwitchToggle() {
    if (!this.switchToggle) return;
    this.switchToggle.position.y = this.lightsOn ? 0.02 : -0.02;
    this.switchToggle.rotation.x = this.lightsOn ? 0.25 : -0.25;
  }

  setLightsOn(on) {
    this.lightsOn = on;
    this._applyLightsOn();
  }

  _applyLightsOn() {
    for (const light of this.practicalLights) {
      const skippedForQuality = this._lightingQuality === "low" && light.userData.isLampLight;
      light.intensity = this.lightsOn && !skippedForQuality ? light.userData.baseIntensity : 0;
    }
    this._applySwitchToggle();
  }

  /** "low" | "medium" | "high" — resolution of the sun's shadow map, plus
   *  (at "low") skipping the workbench lamp's own point light — a small,
   *  honest reduction in per-fragment light count, not just a cosmetic
   *  label. Distinct from shadow *quality* (whether shadows render at all,
   *  and how soft their edges are) — see setShadowQuality. */
  setLightingQuality(quality) {
    if (quality === this._lightingQuality) return;
    this._lightingQuality = quality;
    const size = { low: 512, medium: 1024, high: 2048 }[quality] ?? 1024;
    this.sun.shadow.mapSize.set(size, size);
    // Three.js caches the shadow map render target at whatever size it was
    // first created; changing mapSize alone has no effect until the
    // existing one is thrown away so it gets rebuilt at the new size.
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this._applyLightsOn();
  }

  /** "off" | "low" | "medium" | "high" — whether shadows render at all,
   *  and the filtering technique (hard-edged vs. soft) used if they do. */
  setShadowQuality(quality) {
    if (quality === this._shadowQuality) return;
    this._shadowQuality = quality;
    if (quality === "off") {
      this.engine.renderer.shadowMap.enabled = false;
      return;
    }
    this.engine.renderer.shadowMap.enabled = true;
    this.engine.renderer.shadowMap.type = quality === "low" ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    // Existing shadow materials need telling that the shadow technique
    // itself changed, or they'll keep using whatever was baked in before.
    for (const material of this._collectMaterials()) material.needsUpdate = true;
  }

  _collectMaterials() {
    const materials = [];
    this.engine.scene.traverse((obj) => {
      if (obj.material) materials.push(...(Array.isArray(obj.material) ? obj.material : [obj.material]));
    });
    return materials;
  }

  _onTimeChanged({ sunDirection, sunIntensity, sunColor, hemiIntensity, ambientIntensity, hour }) {
    this.sun.position.copy(sunDirection).multiplyScalar(10);
    this.sun.target.position.set(0, 0, 0);
    const dampening = 1 - this._weatherDampening;
    this.sun.intensity = sunIntensity * dampening;
    this.sun.color.set(sunColor);
    this._baseHemiIntensity = hemiIntensity * (0.7 + 0.3 * dampening);
    this._baseAmbientIntensity = ambientIntensity;
    this._lastSunIntensity = sunIntensity;
    this._updateClockHands(hour);
  }

  /** Decorative Details phase — "clocks." `hour` is the exact same 0-24
   *  value `TimeOfDaySystem` already broadcasts for the sun; the clock
   *  is just one more consumer of it, not a second source of truth for
   *  what time it is. Standard 12-hour clock-hand geometry: the hour
   *  hand completes one full turn every 12 hours, the minute hand every
   *  1. Negated because a positive Z rotation sweeps counter-clockwise
   *  toward the viewer this clock faces — real clock hands sweep the
   *  other way. */
  _updateClockHands(hour) {
    if (!this.clockHourHand || !this.clockMinuteHand) return;
    const hourAngle = ((hour % 12) / 12) * Math.PI * 2;
    const minuteAngle = (hour % 1) * Math.PI * 2;
    this.clockHourHand.rotation.z = -hourAngle;
    this.clockMinuteHand.rotation.z = -minuteAngle;
    this._checkClockChime(hour);
  }

  /** Sound & Presence phase — "clock sounds." A soft chime exactly when
   *  the clock's own hands cross into a new hour, not a continuous tick
   *  — see `AudioSynth.playClockChime()`'s own comment for why. This
   *  only ever runs on `_onTimeChanged`'s own throttled sample (roughly
   *  4 times a second — see `TimeOfDaySystem.update()`), so the exact
   *  instant an hour turns over would usually be missed entirely;
   *  comparing the *integer* hour against the last-seen one instead
   *  reliably catches every crossing within one sample either way, which
   *  is more than close enough for a chime nobody's timing with a
   *  stopwatch. `_lastChimeHour` starts `null` specifically so the very
   *  first sample after load never chimes for simply *starting* at
   *  whatever hour the Workshop already happens to be at — only a real
   *  crossing counts. */
  _checkClockChime(hour) {
    const wholeHour = Math.floor(hour) % 24;
    if (this._lastChimeHour !== null && this._lastChimeHour !== wholeHour) {
      const position = this.clockHourHand.getWorldPosition(new THREE.Vector3());
      this.engine.getSystem(AudioSystem)?.playInteractionSound("clockChime", { position });
    }
    this._lastChimeHour = wholeHour;
  }

  _onEnvironmentChanged({ lightDampening, id }) {
    this._weatherDampening = lightDampening ?? 0;
    if (this._lastSunIntensity !== undefined) {
      this.sun.intensity = this._lastSunIntensity * (1 - this._weatherDampening);
    }
    // A storm gets occasional lightning: a brief, bright flash layered on
    // top of the hemisphere/ambient fill (see update()), not a change to
    // the sun itself — a flash reads as ambient sky-wide light, not a
    // single directional source suddenly changing angle.
    const wasStormActive = this._stormActive;
    this._stormActive = id === "storm";
    if (this._stormActive && !wasStormActive) this._lightningTimer = 2 + Math.random() * 5;
  }

  update(dt) {
    if (this._stormActive) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningFlash = 1;
        this._lightningTimer = 5 + Math.random() * 14; // next flash, a good while off — storms flash occasionally, not constantly
      }
    }
    if (this._lightningFlash > 0) this._lightningFlash = Math.max(0, this._lightningFlash - dt * 3.5); // a quick, sharp decay rather than a slow fade
    const boost = this._lightningFlash * 1.6;
    this.hemi.intensity = this._baseHemiIntensity + boost;
    this.ambientFill.intensity = this._baseAmbientIntensity + boost * 0.5;
  }
}
