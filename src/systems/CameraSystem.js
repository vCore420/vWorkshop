import * as THREE from "three";
import { damp, clamp, shortestAngleLerp, wrapAngle } from "../utils/MathUtils.js";
import { DEFAULT_SPAWN } from "../data/layoutDefault.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";
import { FurnitureSystem } from "./FurnitureSystem.js";

const WALK_SPEED = 2.3; // metres/second
const PLAYER_RADIUS = 0.32;
const EYE_HEIGHT = 1.65;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.05;

/**
 * CameraSystem
 * ------------
 * Drives `engine.camera` directly (the room only ever has one camera).
 * Two modes:
 *
 *   "walk"  - default. WASD/virtual-joystick movement + pointer-lock
 *             mouse-look or touch-drag-look, simple circle-vs-box collision
 *             against the room walls and furniture footprints.
 *   "focus" - entered when an interaction provides a focusPose (e.g. sitting
 *             at the computer desk). Movement and look are locked while the
 *             camera eases to the given position/orientation; exitFocus()
 *             eases back to wherever the player was standing.
 *
 * All input is read through `engine.input` (InputManager) rather than raw
 * DOM events, which is exactly what let touch support (joystick, drag-look,
 * a tappable interact button) arrive later as changes to InputManager
 * alone — this file didn't need to change to support a second input
 * modality, only to stop assuming "pointer-locked" was the only way
 * rotation could be active (see `lookActive`).
 */
export class CameraSystem {
  constructor() {
    this.position = new THREE.Vector3(...DEFAULT_SPAWN.position);
    this.yaw = DEFAULT_SPAWN.yaw;
    this.pitch = 0;
    this.mode = "walk";
    this.locked = false;
    this._preFocus = null;
    this._focusPose = null;
    this._focusT = 0;
  }

  init(engine) {
    this.engine = engine;
    this._velocity = new THREE.Vector2();
    // Resolved once — cheap references that never change after startup, so
    // there's no reason for _resolveCollisions (which runs every frame
    // while walking) to re-run Engine.getSystem's linear search on every
    // single call. See docs/PERFORMANCE.md.
    this._roomSystem = engine.getSystem(RoomLayoutSystem);
    this._furnitureSystem = engine.getSystem(FurnitureSystem);
    // Scratch objects reused every frame in _updateWalk/_resolveCollisions
    // instead of allocating a fresh Vector2/Vector3 each call — walking is
    // the workshop's default, continuous state, so this is the hottest
    // per-frame path in the whole engine.
    this._scratchForward = new THREE.Vector3();
    this._scratchRight = new THREE.Vector3();
    this._scratchWish = new THREE.Vector2();
    this._scratchNext = new THREE.Vector3();
    this.engine.events.on("persistence:save", (bag) => {
      bag.camera = { position: this.position.toArray(), yaw: this.yaw, pitch: this.pitch };
    });
    this.engine.events.on("persistence:load", (bag) => {
      if (!bag?.camera) return;
      this.position.fromArray(bag.camera.position);
      this.yaw = bag.camera.yaw;
      this.pitch = bag.camera.pitch;
    });
    this._applyImmediate();
  }

  enterFocus(pose) {
    if (this.mode === "focus") return;
    this._preFocus = { position: this.position.clone(), yaw: this.yaw, pitch: this.pitch };
    this._focusPose = pose;
    this._focusFrom = { position: this.position.clone(), yaw: this.yaw, pitch: this.pitch };
    this._focusT = 0;
    this.mode = "focus";
  }

  exitFocus() {
    if (this.mode !== "focus") return;
    this._returning = true;
    this._focusFrom = { position: this.position.clone(), yaw: this.yaw, pitch: this.pitch };
    this._focusT = 0;
  }

  get isFocused() {
    return this.mode === "focus";
  }

  /** Stops walk/look input entirely (used while any overlay is open, even ones without a focus pose). */
  lock() {
    this.locked = true;
  }

  unlock() {
    this.locked = false;
  }

  update(dt) {
    if (this.mode === "focus") this._updateFocus(dt);
    else if (!this.locked) this._updateWalk(dt);

    this.engine.camera.position.copy(this.position);
    this.engine.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  _updateWalk(dt) {
    const input = this.engine.input;
    if (!input) return;

    if (input.lookActive) {
      this.yaw -= input.lookDelta.x * LOOK_SENSITIVITY;
      this.pitch -= input.lookDelta.y * LOOK_SENSITIVITY;
      this.pitch = clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
      this.yaw = wrapAngle(this.yaw);
    }

    const move = input.moveVector; // x = strafe, y = forward
    const forward = this._scratchForward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(-1);
    const right = this._scratchRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = this._scratchWish.set(
      forward.x * move.y + right.x * move.x,
      forward.z * move.y + right.z * move.x
    );
    if (wish.lengthSq() > 1) wish.normalize();

    this._velocity.x = damp(this._velocity.x, wish.x * WALK_SPEED, 10, dt);
    this._velocity.y = damp(this._velocity.y, wish.y * WALK_SPEED, 10, dt);

    const next = this._scratchNext.copy(this.position);
    next.x += this._velocity.x * dt;
    next.z += this._velocity.y * dt;

    this._resolveCollisions(next);
    this.position.x = next.x;
    this.position.z = next.z;
    this.position.y = EYE_HEIGHT;
  }

  _resolveCollisions(next) {
    for (const wallBox of this._roomSystem?.getWallColliders?.() ?? []) {
      this._pushOutOfBox(next, wallBox);
    }
    for (const footprint of this._furnitureSystem?.getFootprints?.() ?? []) {
      this._pushOutOfBox(next, footprint);
    }
  }

  /** Circle-vs-AABB push-out, shared by wall and furniture collision — walls
   *  are no longer a hard rectangular clamp; they're just more boxes, with
   *  real gaps left at the door and windows (see WorkshopRoom.js). That's
   *  what makes walking outside possible at all. */
  _pushOutOfBox(next, box) {
    const closestX = clamp(next.x, box.min.x, box.max.x);
    const closestZ = clamp(next.z, box.min.z, box.max.z);
    const dx = next.x - closestX;
    const dz = next.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = PLAYER_RADIUS - dist;
      next.x += (dx / dist) * push;
      next.z += (dz / dist) * push;
    }
  }

  _updateFocus(dt) {
    this._focusT = Math.min(1, this._focusT + dt / 0.6);
    const t = 1 - Math.pow(1 - this._focusT, 3); // ease-out cubic

    if (this._returning) {
      const target = this._preFocus;
      this.position.lerpVectors(this._focusFrom.position, target.position, t);
      this.yaw = shortestAngleLerp(this._focusFrom.yaw, target.yaw, t);
      this.pitch = THREE.MathUtils.lerp(this._focusFrom.pitch, target.pitch, t);
      if (this._focusT >= 1) {
        this.mode = "walk";
        this._returning = false;
        this._preFocus = null;
      }
      return;
    }

    const targetPos = this._scratchNext.set(...this._focusPose.position);
    this.position.lerpVectors(this._focusFrom.position, targetPos, t);

    const dir = this._scratchForward.set(...this._focusPose.lookAt).sub(this.position).normalize();
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    const targetPitch = Math.asin(clamp(dir.y, -1, 1));
    this.yaw = shortestAngleLerp(this._focusFrom.yaw, targetYaw, t);
    this.pitch = THREE.MathUtils.lerp(this._focusFrom.pitch, targetPitch, t);
  }

  _applyImmediate() {
    this.engine.camera.position.copy(this.position);
    this.engine.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}
