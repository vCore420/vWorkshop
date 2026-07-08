import * as THREE from "three";
import { FurnitureSystem } from "../systems/FurnitureSystem.js";
import { damp, clamp, lerp } from "../utils/MathUtils.js";
import { makeRectCorners, projectRect } from "../utils/ScreenProjector.js";
import { WorkstationPanel } from "./WorkstationPanel.js";
import { buildApps } from "./apps/registry.js";

const TRANSITION_SMOOTHING = 7; // higher = faster; ~0.5-0.6s to visually settle
const STANDBY_EMISSIVE = 0.05;
const FULL_EMISSIVE = 1.5;
const SCREEN_LIGHT_MAX = 0.85;
const DESK_LAMP_INTENSITY = 0.55; // constant — see ComputerDesk.js's comment on why this stays on
const PANEL_REVEAL_START = 0.35; // panel stays invisible below this progress...
const PANEL_REVEAL_END = 1.0; // ...and is fully shown by this progress

/**
 * ComputerSystem
 * ---------------
 * This is the computer, as a system: everything about sitting down,
 * standing up, the screen's light, and the on-screen panel lives here.
 * `ComputerDesk.js` only builds geometry and emits `computer:activate` /
 * `computer:deactivate` — this file could be deleted (or replaced) without
 * the desk itself needing to change, and nothing outside this file needs to
 * know a computer exists at all beyond those two event names.
 *
 * `progress` (0 = off, 1 = fully on) drives everything continuously: the
 * screen's emissive glow, its light, the room vignette, and — only in the
 * last portion of the transition, once the camera is nearly head-on — the
 * workstation panel's opacity. See ScreenProjector.js for why that ordering
 * matters. Camera focus easing (CameraSystem) and this progress value are
 * deliberately independent but tuned to finish around the same time, so
 * "the monitor powers on" reads as one continuous gesture with "sitting
 * down" rather than two separate animations that happen to overlap.
 */
export class ComputerSystem {
  constructor(deps) {
    this.deps = deps; // { projectsStore, notesStore, musicSystem, lightingSystem, timeOfDaySystem, weatherSystem, settingsStore }
    this.active = false;
    this.progress = 0;
    this.lastAppId = "projects";
    this._panelClosed = true;
  }

  init(engine) {
    this.engine = engine;

    const desk = engine.getSystem(FurnitureSystem)?.getPiece("computerDesk");
    if (!desk) {
      console.warn("[ComputerSystem] no computer desk found — the computer will be inert this session.");
      return;
    }
    this.deskObject = desk.entity.object3D;
    this.screenMesh = this.deskObject.userData.screenGlowMesh;
    this.screenMaterial = this.screenMesh.material;
    // Screen is a 0.6 × 0.36 × 0.03 box; the player sits at +z looking
    // toward -z, so the viewer-facing surface is the +z side of the box.
    this._screenCorners = makeRectCorners(0.3, 0.18, 0.016);

    this.screenLight = new THREE.PointLight("#7fd8c4", 0, 2.4, 2);
    this.screenLight.position.set(0, 0, 0.12); // local to the screen mesh — in front of the glass, toward the chair
    this.screenMesh.add(this.screenLight);

    const lampSocket = this.deskObject.userData.deskLampSocket;
    if (lampSocket) {
      this.deskLampLight = new THREE.PointLight("#ffcf8c", DESK_LAMP_INTENSITY, 2.6, 2);
      this.deskLampLight.position.copy(lampSocket);
      this.deskObject.add(this.deskLampLight);
    }

    const apps = buildApps(this.deps);
    this.panel = new WorkstationPanel(document.getElementById("computer-root"), apps, engine);
    this.vignetteEl = document.getElementById("computer-vignette");

    engine.events.on("computer:activate", () => this.activate());
    engine.events.on("computer:deactivate", () => this.deactivate());
    engine.events.on("computer:appChanged", ({ appId }) => {
      this.lastAppId = appId;
    });

    engine.events.on("persistence:save", (bag) => {
      bag.computer = { lastAppId: this.lastAppId };
    });
    engine.events.on("persistence:load", (bag) => {
      if (bag?.computer?.lastAppId) this.lastAppId = bag.computer.lastAppId;
    });
  }

  activate() {
    if (this.active || !this.screenMesh) return;
    this.active = true;
    this._panelClosed = false;
    this.panel.open(this.lastAppId);
    this.engine.input?.exitPointerLock();
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    this.panel.setInteractive(false);
    // Attempt to re-lock the mouse cursor for walking; this can be silently
    // rejected by the browser if it falls outside a user-gesture window, in
    // which case clicking the canvas (already wired in main.js) covers it.
    this.engine.input?.requestPointerLock();
  }

  update(dt) {
    if (!this.screenMesh) return;

    const target = this.active ? 1 : 0;
    this.progress = damp(this.progress, target, TRANSITION_SMOOTHING, dt);
    if (Math.abs(this.progress - target) < 0.002) this.progress = target;

    this.screenMaterial.emissiveIntensity = lerp(STANDBY_EMISSIVE, FULL_EMISSIVE, this.progress);
    this.screenLight.intensity = lerp(0, SCREEN_LIGHT_MAX, this.progress);
    this.vignetteEl.style.opacity = String(this.progress);

    if (this.progress > 0.001) {
      const rect = projectRect(this.screenMesh, this._screenCorners, this.engine.camera, window.innerWidth, window.innerHeight);
      const panelOpacity = clamp((this.progress - PANEL_REVEAL_START) / (PANEL_REVEAL_END - PANEL_REVEAL_START), 0, 1);
      this.panel.updateRect(rect, panelOpacity);
    }

    if (!this.active && this.progress === 0 && !this._panelClosed) {
      this.panel.close();
      this._panelClosed = true;
    }
  }
}
