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
 * or raining — TimeOfDaySystem and WeatherSystem emit events describing
 * that, and LightingSystem just reacts: updating the sun's direction/colour
 * and dimming practical fixtures. This split means a future system (say,
 * seasonal changes) can influence lighting just by emitting an event, with
 * no direct dependency on this file.
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
    engine.events.on("weather:changed", (state) => this._onWeatherChanged(state));

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
      this.engine.scene.add(lampLight);
      this.practicalLights.push(lampLight);
    }

    this._applyLightsOn();
  }

  _buildLightSwitch() {
    const switchEntity = new Entity("lightSwitch").tag("structural");
    const plate = box(0.08, 0.12, 0.02, Materials.matte("#e7e2d6"));
    plate.position.set(-3.9, 1.3, 2.6);
    switchEntity.addComponent(new MeshComponent(plate, this.engine.scene));
    switchEntity.addComponent(
      new InteractableComponent({
        prompt: "Flip the light switch",
        radius: 2.0, // small object — see docs/WORLD.md's interaction-distance pass
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
      light.intensity = this.lightsOn ? light.userData.baseIntensity : 0;
    }
  }

  _onTimeChanged({ sunDirection, sunIntensity, sunColor, hemiIntensity, ambientIntensity }) {
    this.sun.position.copy(sunDirection).multiplyScalar(10);
    this.sun.target.position.set(0, 0, 0);
    const dampening = 1 - this._weatherDampening;
    this.sun.intensity = sunIntensity * dampening;
    this.sun.color.set(sunColor);
    this.hemi.intensity = hemiIntensity * (0.7 + 0.3 * dampening);
    this.ambientFill.intensity = ambientIntensity;
    this._lastSunIntensity = sunIntensity;
  }

  _onWeatherChanged({ lightDampening }) {
    this._weatherDampening = lightDampening ?? 0;
    if (this._lastSunIntensity !== undefined) {
      this.sun.intensity = this._lastSunIntensity * (1 - this._weatherDampening);
    }
  }

  update(_dt) {
    // Reserved for future subtle effects (flicker, lightning flashes on
    // storm weather, etc). Intentionally empty for now.
  }
}
