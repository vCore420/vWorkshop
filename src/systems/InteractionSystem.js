import * as THREE from "three";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { CameraSystem } from "./CameraSystem.js";

const SCAN_INTERVAL = 0.08; // ~12.5Hz — see the class comment on why this doesn't need to run every frame

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
 * The proximity scan — the one part of this system that has to look at
 * every interactable in the room — is throttled to `SCAN_INTERVAL`
 * (~12.5Hz) rather than running at full frame rate. A prompt appearing up
 * to ~80ms later than the frame you actually walked into range is not
 * something anyone can perceive; redoing the same distance check to every
 * interactable in the room 60 times a second was pure waste, and became
 * real waste rather than theoretical waste once the world could hold an
 * unbounded number of Builder-placed objects (see docs/PERFORMANCE.md).
 * The interact-key check itself still runs every frame, against whatever
 * the last scan found — it's a cheap check, and delaying *that* would be
 * an actual, perceptible input lag, not just a theoretical one.
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
    this._scanAccumulator = 0;
  }

  init(engine) {
    this.engine = engine;
    this._camera = engine.getSystem(CameraSystem); // resolved once — every system already exists by the time any init() runs, only initialized *state* is order-dependent, and this is just a reference
    engine.events.on("interaction:exitRequested", () => this.exitActive());
    engine.events.on("buildmode:entered", () => {
      this._suspended = true;
      this.engine.events.emit("hud:prompt", { visible: false });
    });
    engine.events.on("buildmode:exited", () => {
      this._suspended = false;
    });
  }

  update(dt) {
    if (this._suspended) return; // Build Mode owns input entirely while active

    if (this.active) {
      if (this.engine.input?.wasJustPressed("cancel")) this.exitActive();
      return; // suppress new prompts/interactions while something is open
    }

    this._scanAccumulator += dt;
    if (this._scanAccumulator >= SCAN_INTERVAL) {
      this._scanAccumulator = 0;
      this._scanForNearest();
    }

    if (this._nearest && this.engine.input?.wasJustPressed("interact")) {
      this._trigger(this._nearest);
    }
  }

  _scanForNearest() {
    if (!this._camera) return;
    const playerPos = this._camera.position;

    let nearest = null;
    let nearestDist = Infinity;
    for (const entity of this.engine.entities.byComponent(InteractableComponent)) {
      const interactable = entity.getComponent(InteractableComponent);
      if (!interactable.enabled) continue;
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
  }

  _trigger({ entity, interactable }) {
    const camera = this._camera;
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
    const camera = this._camera;
    if (camera?.isFocused) camera.exitFocus();
    camera?.unlock();
    interactable.onExit?.({ engine: this.engine });
    this.engine.events.emit("overlay:close");
    this.active = null;
  }
}
