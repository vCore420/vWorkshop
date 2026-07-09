import * as THREE from "three";
import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { box, Materials } from "../utils/PlaceholderFactory.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";
import { FurnitureSystem } from "./FurnitureSystem.js";

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
  }

  init(engine) {
    this.engine = engine;

    this.hemi = new THREE.HemisphereLight("#bcd7e6", "#4a3a2c", 0.55);
    engine.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff2df", 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 20;
    this.sun.shadow.camera.left = -6;
    this.sun.shadow.camera.right = 6;
    this.sun.shadow.camera.top = 6;
    this.sun.shadow.camera.bottom = -6;
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

    const furnitureSystem = this.engine.getSystem(FurnitureSystem);
    const workbench = furnitureSystem?.getPiece("workbench");
    const lampSocket = workbench?.entity?.object3D?.userData?.lampSocket;
    if (lampSocket) {
      const worldPos = workbench.entity.object3D.localToWorld(lampSocket.clone());
      const lampLight = new THREE.PointLight("#ffe9c2", 0.7, 3, 2);
      lampLight.position.copy(worldPos);
      lampLight.userData.baseIntensity = 0.7;
      lampLight.userData.isLampLight = true; // see setLightingQuality — the one practical light "low" skips
      this.engine.scene.add(lampLight);
      this.practicalLights.push(lampLight);
    }

    this._applyLightsOn();
  }

  _buildLightSwitch() {
    const switchEntity = new Entity("lightSwitch").tag("structural");
    const plate = box(0.08, 0.12, 0.02, Materials.matte("#e7e2d6"));
    // On the south wall, on the far side of the front doors from where it
    // used to sit — the doors sit at x=0, spanning ±1.3 (see
    // WORKSHOP_DOOR in layoutDefault.js), and a doorway genuinely splits
    // a wall into two separate segments either side of it, which is what
    // "the opposite wall" means here rather than a literally different
    // wall. z is nudged from 2.8 to 2.83 — closer to the wall's actual
    // interior face (~2.85) without quite touching it, avoiding z-fighting
    // while sitting visibly flush rather than with a noticeable gap.
    plate.position.set(1.8, 1.3, 2.83);
    switchEntity.addComponent(new MeshComponent(plate, this.engine.scene));
    switchEntity.addComponent(
      new InteractableComponent({
        prompt: "Flip the light switch",
        radius: 1.3, // deliberately tighter than the standard "small object" 2.0m tier; see docs/REFINEMENT.md
        onInteract: () => this.setLightsOn(!this.lightsOn),
      })
    );
    this.engine.entities.create(switchEntity);
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

  _onTimeChanged({ sunDirection, sunIntensity, sunColor, hemiIntensity, ambientIntensity }) {
    this.sun.position.copy(sunDirection).multiplyScalar(10);
    this.sun.target.position.set(0, 0, 0);
    const dampening = 1 - this._weatherDampening;
    this.sun.intensity = sunIntensity * dampening;
    this.sun.color.set(sunColor);
    this._baseHemiIntensity = hemiIntensity * (0.7 + 0.3 * dampening);
    this._baseAmbientIntensity = ambientIntensity;
    this._lastSunIntensity = sunIntensity;
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
