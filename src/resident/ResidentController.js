import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { ResidentMovement, IDLE_LOCATIONS } from "./ResidentMovement.js";
import { ResidentRenderer } from "./ResidentRenderer.js";
import { createResidentEntity } from "./ResidentEntity.js";

const EXPRESSION_CHECK_INTERVAL = 0.5; // seconds — expression/awake checks don't need to run every single frame

/**
 * ResidentController
 * ---------------------
 * "This is not an AI assistant. It is the Workshop's first resident." The
 * one engine system that makes the others (`ResidentMovement`,
 * `ResidentBehaviour`, `ResidentRenderer`) actually happen every frame —
 * itself owning as little logic as possible, mostly just reading one
 * system's output and feeding it into the next: player distance into
 * `ResidentBehaviour.update()`, its own `awarenessBlend` into the look
 * target `ResidentRenderer.update()` receives, `ResidentConnection.isAwake`
 * into both `ResidentBehaviour.computeExpression()` and
 * `ResidentRenderer.setAwake()`.
 *
 * "The resident should exist inside the Workshop at all times... when
 * the player enters the Workshop the resident should already be
 * present." There's no spawn/despawn logic anywhere in this file — the
 * resident is created once in `init()`, exactly like every piece of
 * furniture, and simply exists for the rest of the session.
 */
export class ResidentController {
  constructor({ residentState, residentBehaviour, residentConnection, residentProfileStore }) {
    this.residentState = residentState;
    this.residentBehaviour = residentBehaviour;
    this.residentConnection = residentConnection;
    this.residentProfileStore = residentProfileStore;
    this._wasAwake = null; // null so the very first frame always applies the correct awake/asleep visual, rather than assuming
    this._expressionTimer = 0;
    this._playerPos = new THREE.Vector3();
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);

    if (!this.residentState.idleLocationId) this.residentState.setIdleLocation(IDLE_LOCATIONS[0].id);
    this.movement = new ResidentMovement(this.residentState.idleLocationId);
    this.renderer = new ResidentRenderer();
    createResidentEntity({ engine, root: this.renderer.root });
  }

  update(dt) {
    if (!this.renderer) return;

    const isAwake = this.residentConnection.isAwake;
    if (isAwake !== this._wasAwake) {
      this._wasAwake = isAwake;
      this.renderer.setAwake(isAwake);
    }

    const isConversing = this.residentBehaviour.mode === "conversing";
    if (!isConversing) {
      const currentId = this.residentState.idleLocationId;
      const newId = this.movement.maybePickNewLocation(dt, currentId);
      if (newId) this.residentState.setIdleLocation(newId);
    }

    const playerDistance = this._computePlayerDistance();
    this.residentBehaviour.update(dt, playerDistance);

    const motion = this.movement.update(dt, { thinking: this.residentBehaviour.isThinking });
    const lookTarget = motion.lookAt.clone();
    if (playerDistance !== null) lookTarget.lerp(this._playerPos, this.residentBehaviour.awarenessBlend);

    this.renderer.update(dt, { position: motion.position, idleRotationY: motion.idleRotationY, scale: motion.scale, lookTarget });

    this._expressionTimer -= dt;
    if (this._expressionTimer <= 0) {
      this._expressionTimer = EXPRESSION_CHECK_INTERVAL;
      const expression = this.residentBehaviour.computeExpression(isAwake, this.residentState.mood);
      this.renderer.setExpression(expression);
    }
  }

  _computePlayerDistance() {
    if (!this._cameraSystem) return null;
    this._playerPos.copy(this._cameraSystem.position);
    return this._playerPos.distanceTo(this.movement.currentPosition);
  }
}
