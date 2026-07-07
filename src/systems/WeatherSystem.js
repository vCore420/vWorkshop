import * as THREE from "three";
import { rainStreakTexture } from "../utils/ProceduralTexture.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";

/**
 * WeatherSystem
 * -------------
 * Owns the current weather state and everything that visibly/audibly
 * follows from it. It doesn't render an exterior world (the windows are
 * placeholder inset panes, not true holes into a rendered outside — see
 * WorkshopRoom.js) so "rain" is represented honestly within that
 * constraint: streaks on the glass, a dimmer sky tint (via `lightDampening`,
 * consumed by LightingSystem), and a rain ambience (consumed by
 * AudioSystem). A future pass that gives the room a real exterior view
 * could upgrade this to actual falling particles without changing the
 * public contract (`weather:changed` event, `WEATHER_STATES` shape).
 *
 * Weather is changed by looking out a window (see RoomLayoutSystem) — a
 * small interactable panel, not a HUD menu.
 */
export const WEATHER_STATES = {
  clear: { label: "Clear", lightDampening: 0, ambience: null },
  cloudy: { label: "Cloudy", lightDampening: 0.28, ambience: "wind" },
  rain: { label: "Rain", lightDampening: 0.55, ambience: "rain" },
};

export class WeatherSystem {
  constructor() {
    this.current = "clear";
    this.autoCycle = false;
    this._rainMeshes = [];
    this._rainScroll = 0;
  }

  init(engine) {
    this.engine = engine;
    this._buildRainOverlays();
    this._emit();

    engine.events.on("persistence:save", (bag) => {
      bag.weather = { current: this.current, autoCycle: this.autoCycle };
    });
    engine.events.on("persistence:load", (bag) => {
      if (bag?.weather) {
        this.current = bag.weather.current ?? this.current;
        this.autoCycle = !!bag.weather.autoCycle;
        this._emit();
      }
    });
  }

  _buildRainOverlays() {
    const roomSystem = this.engine.getSystem(RoomLayoutSystem);
    const panes = roomSystem?.getWindowPanes?.() ?? [];
    const streakTexture = rainStreakTexture();
    for (const { mesh } of panes) {
      const overlayMat = new THREE.MeshBasicMaterial({
        map: streakTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const overlay = new THREE.Mesh(mesh.geometry.clone(), overlayMat);
      overlay.position.copy(mesh.position);
      overlay.position.z += mesh.position.z > 0 ? 0.01 : -0.01;
      this.engine.scene.add(overlay);
      this._rainMeshes.push(overlay);
    }
  }

  setWeather(id) {
    if (!WEATHER_STATES[id]) return;
    this.current = id;
    this._emit();
  }

  setAutoCycle(enabled) {
    this.autoCycle = enabled;
  }

  getState() {
    return { current: this.current, autoCycle: this.autoCycle, options: Object.keys(WEATHER_STATES) };
  }

  _emit() {
    const def = WEATHER_STATES[this.current];
    this.engine.events.emit("weather:changed", {
      id: this.current,
      lightDampening: def.lightDampening,
      ambience: def.ambience,
    });
    const rainOpacity = this.current === "rain" ? 0.55 : 0;
    for (const mesh of this._rainMeshes) mesh.material.opacity = rainOpacity;
  }

  update(dt) {
    if (this.current === "rain") {
      this._rainScroll += dt * 0.6;
      for (const mesh of this._rainMeshes) mesh.material.map.offset.y = this._rainScroll % 1;
    }
  }
}
