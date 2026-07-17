import * as THREE from "three";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { CameraSystem } from "./CameraSystem.js";

const SCAN_INTERVAL = 0.08; // ~12.5Hz — see the class comment on why this doesn't need to run every frame
const LOOK_AT_COS_THRESHOLD = Math.cos((7 * Math.PI) / 180); // ~7° cone — "the reticle is directly over it," forgiving enough to be usable on a small, moving target without feeling like a precise raycast hit-test

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
 * The Workshop Phone suspends this system entirely for as long as it's
 * open, purely via two event names (`phone:opened` / `phone:closed`) —
 * see the `_suspended` listeners in init() below. Because Build Mode is
 * itself a Phone app now (see `BuilderPhoneApp.js`), that one mechanism
 * covers it too — this file used to listen for a dedicated
 * `buildmode:entered`/`buildmode:exited` pair back when Build Mode owned
 * its own shell, and this docstring described that for two phases after
 * it stopped being true (found and corrected in the v2.2.3d independent
 * review — the same "a docstring is a promise" drift shape
 * docs/HISTORY.md's own retrospective names). This file never imports
 * PhoneSystem or BuildModeSystem; the mutual-exclusion check in the
 * other direction ("don't open the phone while sitting at the computer")
 * lives in `PhoneSystem.open()` itself.
 */
export class InteractionSystem {
  constructor() {
    this.active = null; // { entity, interactable } currently "open"
    this._nearest = null;
    this._suspended = false;
    this._scratch = new THREE.Vector3();
    this._scratchDirection = new THREE.Vector3();
    this._scratchCameraForward = new THREE.Vector3();
    this._scanAccumulator = 0;
  }

  init(engine) {
    this.engine = engine;
    this._camera = engine.getSystem(CameraSystem); // resolved once — every system already exists by the time any init() runs, only initialized *state* is order-dependent, and this is just a reference
    engine.events.on("interaction:exitRequested", () => this.exitActive());
    // "The Phone is for using" — whichever app is currently open (not
    // just Builder specifically any more) owns the mouse and the world's
    // own interaction prompts while it's open. See PhoneSystem.js's own
    // comment on why "phone:opened"/"phone:closed" replaced the old
    // Build-Mode-specific pair here.
    engine.events.on("phone:opened", () => {
      this._suspended = true;
      this.engine.events.emit("hud:prompt", { visible: false });
    });
    engine.events.on("phone:closed", () => {
      this._suspended = false;
    });
  }

  update(dt) {
    if (this._suspended) return; // The Phone owns input entirely while open

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
    if (!this._camera || !this.engine.camera) return;
    const playerPos = this._camera.position;
    this.engine.camera.getWorldDirection(this._scratchCameraForward);

    let nearest = null;
    let nearestDist = Infinity;
    for (const entity of this.engine.entities.byComponent(InteractableComponent)) {
      const interactable = entity.getComponent(InteractableComponent);
      if (!interactable.enabled) continue;
      const worldPos = interactable.worldPosition(this._scratch);
      const dist = worldPos.distanceTo(playerPos);
      if (dist > interactable.radius || dist >= nearestDist) continue;
      if (interactable.requiresLookAt && !this._isLookingAt(worldPos, playerPos)) continue;
      nearest = { entity, interactable };
      nearestDist = dist;
    }

    if (nearest?.entity !== this._nearest?.entity) {
      this._nearest = nearest;
      this.engine.events.emit("hud:prompt", nearest ? { visible: true, text: nearest.interactable.prompt } : { visible: false });
    } else if (nearest) {
      // Prompt text can change (e.g. door: "Open" <-> "Close") even for the same entity.
      this.engine.events.emit("hud:prompt", { visible: true, text: nearest.interactable.prompt });
    }
  }

  /** "The player's reticle is directly over it" — a forgiving angular
   *  cone test against the camera's own actual forward direction, not a
   *  precise raycast hit-test against the target's own geometry. A small,
   *  gently moving target (Bubble) would be a frustrating raycast to
   *  land exactly on; a several-degree cone reads as "looking at it"
   *  without demanding pixel precision. */
  _isLookingAt(targetWorldPos, playerPos) {
    this._scratchDirection.subVectors(targetWorldPos, playerPos).normalize();
    return this._scratchDirection.dot(this._scratchCameraForward) >= LOOK_AT_COS_THRESHOLD;
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
