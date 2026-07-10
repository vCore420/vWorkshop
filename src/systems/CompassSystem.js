import * as THREE from "three";
import { CameraSystem } from "./CameraSystem.js";
import { directionToAzimuth } from "../utils/Astronomy.js";

const PIXELS_PER_DEGREE = 6;
const DIRECTIONS = [
  { label: "N", deg: 0 }, { label: "NE", deg: 45 }, { label: "E", deg: 90 }, { label: "SE", deg: 135 },
  { label: "S", deg: 180 }, { label: "SW", deg: 225 }, { label: "W", deg: 270 }, { label: "NW", deg: 315 },
];
// Three full cycles of labels (-360..+720°) so the strip never runs out
// of labels near the 0°/360° wrap, regardless of current heading.
const CYCLES = [-360, 0, 360];

const _scratchForward = new THREE.Vector3();

/**
 * CompassSystem
 * ---------------
 * "This should not remain permanently visible. Instead, it should behave
 * similarly to the existing Builder Phone and third-person camera
 * toggle." Toggled with **M**, a single translating strip of direction
 * labels rather than a circular dial or a minimap — "clean, minimal, easy
 * to read" reads as "glance, orient, dismiss," not a persistent HUD
 * element competing for attention.
 *
 * Reads the player's own facing the same way third person's own camera
 * math already does (`CameraSystem.yaw`), and converts it to a heading
 * via `directionToAzimuth()` — the exact same function
 * `TimeOfDaySystem`'s astronomy uses to place the sun and moon, so the
 * compass and the sky always agree about where north actually is; there
 * was never a second convention to keep in sync by hand.
 */
export class CompassSystem {
  constructor() {
    this.visible = false;
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this._buildDom();
  }

  _buildDom() {
    this.root = document.getElementById("compass-root");
    const card = document.createElement("div");
    card.className = "compass-card";

    this.strip = document.createElement("div");
    this.strip.className = "compass-strip";
    for (const cycleOffset of CYCLES) {
      for (const { label, deg } of DIRECTIONS) {
        const mark = document.createElement("span");
        mark.className = "compass-mark";
        mark.textContent = label;
        mark.style.left = `${(deg + cycleOffset) * PIXELS_PER_DEGREE}px`;
        this.strip.appendChild(mark);
      }
    }
    card.appendChild(this.strip);

    const needle = document.createElement("div");
    needle.className = "compass-needle";
    card.appendChild(needle);

    this.root.appendChild(card);
  }

  toggle() {
    this.visible = !this.visible;
    this.root.classList.toggle("visible", this.visible);
  }

  update(_dt) {
    const input = this.engine.input;
    if (input?.wasJustPressed("compass")) this.toggle();
    if (!this.visible || !this._cameraSystem) return;

    const yaw = this._cameraSystem.yaw;
    _scratchForward.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-1);
    const headingDeg = directionToAzimuth(_scratchForward);
    this.strip.style.transform = `translateX(${-headingDeg * PIXELS_PER_DEGREE}px)`;
  }
}
