import * as THREE from "three";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { CameraSystem } from "./CameraSystem.js";

/**
 * InteractionSystem
 * ------------------
 * Every frame: find the nearest enabled InteractableComponent within its
 * radius of the player, and tell the HUD about it. On the interact key,
 * run that interactable's onInteract() and, if it declares a focusPose,
 * ease the camera into it. On cancel (Escape) — or a request from the UI
 * layer, e.g. an overlay's close button — reverse that: run onExit(),
 * release the camera focus, and tell the UI layer to close.
 *
 * This system knows nothing about *what* an interaction does (open a
 * desktop, toggle a light, open a notebook) — that's entirely up to the
 * onInteract callback each interactable was built with. That's the seam
 * that lets furniture, structural objects, and future plugin objects all
 * use the exact same interaction pipeline.
 *
 * Build Mode (src/worldbuilder/) suspends this system entirely for as long
 * as it's open, purely via two event names (`buildmode:entered` /
 * `buildmode:exited`) — this file never imports BuildModeSystem, and
 * BuildModeSystem never imports this one beyond a single "is something
 * already open?" check before it lets itself start.
 */
export class InteractionSystem {
  constructor() {
    this.active = null; // { entity, interactable } currently "open"
    this._nearest = null;
    this._suspended = false;
    this._scratch = new THREE.Vector3();
  }

  init(engine) {
    this.engine = engine;
    engine.events.on("interaction:exitRequested", () => this.exitActive());
    engine.events.on("buildmode:entered", () => {
      this._suspended = true;
      this.engine.events.emit("hud:prompt", { visible: false });
    });
    engine.events.on("buildmode:exited", () => {
      this._suspended = false;
    });
  }

  update(_dt) {
    if (this._suspended) return; // Build Mode owns input entirely while active

    if (this.active) {
      if (this.engine.input?.wasJustPressed("cancel")) this.exitActive();
      return; // suppress new prompts/interactions while something is open
    }

    const camera = this.engine.getSystem(CameraSystem);
    if (!camera) return;
    const playerPos = camera.position;

    let nearest = null;
    let nearestDist = Infinity;
    for (const entity of this.engine.entities.all()) {
      const interactable = entity.getComponent(InteractableComponent);
      if (!interactable || !interactable.enabled) continue;
      const worldPos = interactable.worldPosition(this._scratch);
      const dist = worldPos.distanceTo(playerPos);
      if (dist <= interactable.radius && dist < nearestDist) {
        nearest = { entity, interactable };
        nearestDist = dist;
      }
    }

    if (nearest?.entity !== this._nearest?.entity) {
      this._nearest = nearest;
      this.engine.events.emit("hud:prompt", nearest ? { visible: true, text: nearest.interactable.prompt } : { visible: false });
    } else if (nearest) {
      // Prompt text can change (e.g. door: "Open" <-> "Close") even for the same entity.
      this.engine.events.emit("hud:prompt", { visible: true, text: nearest.interactable.prompt });
    }

    if (nearest && this.engine.input?.wasJustPressed("interact")) {
      this._trigger(nearest);
    }
  }

  _trigger({ entity, interactable }) {
    const camera = this.engine.getSystem(CameraSystem);
    if (interactable.focusPose) camera.enterFocus(interactable.focusPose);
    interactable.onInteract?.({ engine: this.engine });
    if (interactable.opensOverlay || interactable.focusPose) {
      camera.lock();
      this.active = { entity, interactable };
      this.engine.events.emit("hud:prompt", { visible: false });
    }
  }

  exitActive() {
    if (!this.active) return;
    const { interactable } = this.active;
    const camera = this.engine.getSystem(CameraSystem);
    if (camera?.isFocused) camera.exitFocus();
    camera?.unlock();
    interactable.onExit?.({ engine: this.engine });
    this.engine.events.emit("overlay:close");
    this.active = null;
  }
}
