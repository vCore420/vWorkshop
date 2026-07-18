import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { RoomLayoutSystem } from "../systems/RoomLayoutSystem.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { defaultGhostPoint } from "../worldbuilder/GhostPreview.js";

const ROTATE_STEP = Math.PI / 8;
const FLOOR_Y = 0; // the Workshop's own floor-level convention every other system already anchors to

/**
 * BeingSpawnerSystem
 * --------------------
 * "This should behave similarly to the Builder placement workflow.
 * Players should: select a saved Being, see a ghost preview, move the
 * preview around the world, click to place." The same ghost-then-confirm
 * shape `BuildModeSystem.js` already established, deliberately not
 * reusing that class directly — a Being ghost only ever needs to rest on
 * the floor (a living creature standing somewhere, not an object resting
 * on any surface including furniture tops), so a single floor-plane
 * raycast replaces `BuildModeSystem`'s own multi-surface gathering
 * entirely. Keeping this as its own small system is also exactly what
 * "avoid tightly coupling these systems together" asks for — the Being
 * system doesn't reach into Builder's own ghost machinery, and Builder's
 * own placement is untouched by anything here.
 *
 * Confirming a placement creates a `BeingInstanceStore` entry and nothing
 * more — `BeingController.js`'s own `instances:changed` listener is what
 * actually spawns the live, moving Being a moment later. This file's job
 * ends the instant the record exists.
 */
export class BeingSpawnerSystem {
  constructor({ beingLibrary, beingInstanceStore }) {
    this.beingLibrary = beingLibrary;
    this.beingInstanceStore = beingInstanceStore;
    this.active = false;
    this._ghost = null; // { object3D, definition, rotationY }
    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();
    this._hasPointer = false;
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this._hud = document.createElement("div");
    this._hud.className = "hud-prompt";
    document.getElementById("hud-root")?.appendChild(this._hud);

    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onKeyDown = (e) => {
      if (!this.active) return;
      if (e.key === "Escape") this.cancelPlacement();
      else if (e.key === "r" || e.key === "R") this.rotateGhost();
    };
    engine.canvas.addEventListener("pointermove", this._onPointerMove);
    engine.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("keydown", this._onKeyDown);
  }

  /** The one real entry point — "select a saved Being" — called from
   *  `BeingSpawnerApp.js`'s own library list. */
  beginPlacement(definitionId) {
    const definition = this.beingLibrary.get(definitionId);
    if (!definition) return;
    const interactionSystem = this.engine.getSystem(InteractionSystem);
    if (interactionSystem?.active) return; // can't place a Being while sitting at the computer, etc.

    this._cancelGhost();
    this.active = true;
    this._cameraSystem?.lock();
    this.engine.input?.exitPointerLock();

    const preview = this._buildGhostMesh();
    const point = this._raycastFloor() ?? this._defaultFloorPoint();
    preview.position.copy(point);
    this.engine.scene.add(preview);
    this._ghost = { object3D: preview, definition, rotationY: 0 };
    this._updateHud();
    this.engine.events.emit("beingSpawner:entered");
  }

  _buildGhostMesh() {
    // A simple, honest translucent capsule — matching ModelLoader's own
    // placeholder shape rather than trying to preview the Being's real
    // model here, since loading and cloning it just for a ghost that
    // might get cancelled is wasted work; the real spawned Being (via
    // BeingController) loads the actual model properly once placed.
    const geometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
    const material = new THREE.MeshBasicMaterial({ color: "#7fd8c4", transparent: true, opacity: 0.5 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.55;
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }

  _raycastFloor() {
    if (!this._hasPointer) return null;
    const floorMesh = this.engine.getSystem(RoomLayoutSystem)?.getFloorMesh();
    if (!floorMesh) return null;
    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);
    const hits = this._raycaster.intersectObject(floorMesh, true);
    return hits[0]?.point ?? null;
  }

  /** "See a ghost preview, move the preview around the world" quietly
   *  assumed the floor raycast always hits *something* — it doesn't. A
   *  perfectly horizontal (or upward) look ray, entirely ordinary the
   *  instant placement begins, can never intersect a floor plane below
   *  eye level, so `_raycastFloor()` genuinely returns `null` until the
   *  player happens to tilt the camera down far enough. The ghost used
   *  to fall back to the literal world origin in that case (and simply
   *  stop updating at all on every subsequent frame the raycast kept
   *  failing) — invisible or badly placed depending on where the player
   *  was actually standing, and confirming it there is exactly what
   *  "the app recognises it's been placed, but we never see it" was:
   *  a real instance, genuinely spawned, just somewhere nobody was
   *  looking. `defaultGhostPoint()` (`GhostPreview.js`) is
   *  `BuildModeSystem`'s own already-proven answer to this same
   *  question — straight ahead of the camera at a comfortable distance —
   *  reused here rather than re-invented, with its own Y forced back to
   *  floor level since (unlike a Builder object, which can rest on any
   *  surface a ghost hovers over) a Being can only ever stand on the
   *  floor. Applied on *every* pointer move here, not just on entry —
   *  `BuildModeSystem`'s own multi-surface raycast rarely fails at all in
   *  practice, but this system's single floor-only raycast fails any
   *  time the player simply isn't looking down, which is often. */
  _defaultFloorPoint() {
    const point = defaultGhostPoint(this.engine.camera);
    point.y = FLOOR_Y;
    return point;
  }

  _handlePointerMove(event) {
    if (!this.active || !this._ghost) return;
    const rect = this.engine.canvas.getBoundingClientRect();
    this._pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._hasPointer = true;
    const point = this._raycastFloor() ?? this._defaultFloorPoint();
    this._ghost.object3D.position.copy(point);
  }

  _handlePointerDown(event) {
    if (!this.active || !this._ghost || event.button !== 0) return;
    this._confirmGhost();
  }

  rotateGhost() {
    if (!this._ghost) return;
    this._ghost.rotationY += ROTATE_STEP;
    this._ghost.object3D.rotation.y = this._ghost.rotationY;
  }

  _confirmGhost() {
    const ghost = this._ghost;
    if (!ghost) return;
    const position = [ghost.object3D.position.x, ghost.object3D.position.y, ghost.object3D.position.z];
    this.beingInstanceStore.create({
      definitionId: ghost.definition.id,
      position,
      rotationY: ghost.rotationY,
      homePosition: position,
      homeRadius: ghost.definition.homeRadius,
    });
    this._exit();
  }

  cancelPlacement() {
    this._exit();
  }

  _cancelGhost() {
    if (this._ghost) {
      this.engine.scene.remove(this._ghost.object3D);
      this._ghost = null;
    }
  }

  _exit() {
    this._cancelGhost();
    this.active = false;
    this._cameraSystem?.unlock();
    this.engine.input?.requestPointerLock();
    if (this._hud) this._hud.classList.remove("visible");
    this.engine.events.emit("beingSpawner:exited");
  }

  _updateHud() {
    if (!this._hud || !this._ghost) return;
    this._hud.classList.add("visible");
    this._hud.textContent = `Placing "${this._ghost.definition.name}" \u2014 click to place \u00b7 R to rotate \u00b7 Escape to cancel`;
  }

  update(_dt) {
    // All state changes here happen through direct event listeners
    // (pointer, keydown) registered in init() — nothing needs polling
    // every frame.
  }

  dispose() {
    this.engine.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.engine.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("keydown", this._onKeyDown);
    if (this._hud) this._hud.remove();
  }
}
