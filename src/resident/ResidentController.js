import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { ResidentMovement, IDLE_LOCATIONS, MIN_REST_SECONDS } from "./ResidentMovement.js";
import { ResidentRenderer } from "./ResidentRenderer.js";
import { createResidentEntity } from "./ResidentEntity.js";

const EXPRESSION_CHECK_INTERVAL = 0.5; // seconds — expression/awake checks don't need to run every single frame
const FOLLOW_DISTANCE = 1.3; // metres — "Follow Me" stops closing the gap once this near, hovering companionably rather than stepping right up to the player's own eye position
const DRAG_LOOK_COS_THRESHOLD = Math.cos((10 * Math.PI) / 180); // ~10° cone — a little more forgiving than the interaction one, since grabbing hold of something is a coarser gesture than a precise "talk to this" click
const DRAG_REACH = 3; // metres — how far away Bubble can be and still be grabbed
const DRAG_DISTANCE = 1.4; // metres in front of the camera Bubble is held at while dragged

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
 *
 * **Dragging** — "look directly at Bubble, click and hold, drag Bubble
 * naturally through 3D space, release anywhere" — is handled entirely
 * through raw mouse-button events (`pointerdown`/`pointerup` on the
 * canvas), deliberately never touching the "interact" key/action Talk
 * already uses. `InteractionSystem.js`'s own pipeline fires `onInteract`
 * immediately on key-down, with no way to tell a quick press from the
 * start of a hold before it's already happened — routing dragging
 * through an entirely separate input (the mouse button, not a bound
 * game action) sidesteps that rather than complicating the shared
 * interaction system for one object's own special case. While dragging,
 * Bubble is held at a fixed distance in front of the camera and eased
 * toward wherever the player is currently looking, not warped there
 * instantly — "gently reposition," not teleport. Releasing simply stops
 * moving it — `ResidentMovement`'s own `currentPosition` (and
 * `ResidentState`'s persisted copy) already reflect wherever it was
 * let go, so "the next time it chooses to move, it should simply
 * continue from the nearest point" is true with no special-casing at
 * all: the next wander target is chosen relative to the resident's own
 * current position exactly like any other time.
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
    this._dragging = false;
    this._dragTarget = new THREE.Vector3();
    this._scratchForward = new THREE.Vector3();
    this._scratchDirection = new THREE.Vector3();
    // "Stay Here, Follow Me, Return Home" (Bubble Phone app) — null is
    // ordinary autonomous wandering, "stay" simply skips ever picking a
    // new idle destination, "follow" steps toward the player every frame
    // instead. Return Home isn't a persistent mode at all — see
    // returnHome() below.
    this.playerCommand = null; // null | "stay" | "follow"
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);

    if (!this.residentState.idleLocationId) this.residentState.setIdleLocation(IDLE_LOCATIONS[0].id);
    // "Reloading the Workshop should restore the resident naturally to
    // where it was when the player last left" — passing the persisted
    // position resumes it exactly there (including mid-travel) rather
    // than snapping to idleLocationId's own fixed point; see
    // ResidentMovement.js's own constructor comment.
    this.movement = new ResidentMovement(this.residentState.idleLocationId, this.residentState.currentPosition);
    this.renderer = new ResidentRenderer();
    createResidentEntity({ engine, root: this.renderer.root });

    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerUp = () => this._stopDragging();
    engine.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointerup", this._onPointerUp);

    // "Bubble should begin feeling like an independent resident...
    // continue moving between favourite locations... arrive at a
    // believable location when the Workshop loads." See
    // _applyContinuity()'s own comment for the actual reasoning.
    engine.events.on("world:continuity", (continuity) => this._applyContinuity(continuity));
  }

  /** "What should I have been doing while the player was away?" — not a
   *  real simulation of every idle-location hop that would have happened
   *  (the player never saw any of them, so modelling each one has no
   *  payoff), just a single, honest answer: has enough time passed that
   *  Bubble would plausibly have moved on from exactly where it was left?
   *  Below `MIN_REST_SECONDS` (the shortest it would ever actually rest
   *  somewhere), the answer is no — reopening the Workshop seconds after
   *  closing it should show Bubble exactly where it was, not somewhere
   *  new, or "nothing should feel scripted" stops being true. Past that,
   *  it picks one new idle location (never the one it was already at)
   *  and arrives there directly — no visible travel animation plays,
   *  since whatever journey led there happened while nobody was watching;
   *  only the destination needs to be believable, not the route. */
  _applyContinuity({ cappedElapsedSeconds, isFirstSession }) {
    if (isFirstSession || cappedElapsedSeconds < MIN_REST_SECONDS) return;

    const currentId = this.residentState.idleLocationId;
    const candidates = IDLE_LOCATIONS.filter((loc) => loc.id !== currentId);
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? IDLE_LOCATIONS[0];
    this.residentState.setIdleLocation(next.id);
    this.movement.setDraggedPosition(next.position); // arrives directly — see comment above on why no travel animation plays
    this.movement.setDraggedLookAt(next.lookAt ?? next.position);
  }

  _handlePointerDown(event) {
    if (event.button !== 0) return; // left button only
    if (!this.engine.input?.pointerLocked) return; // "using the normal interaction reticle (not mouse cursor mode)"
    if (this.residentBehaviour.mode === "conversing") return; // don't start dragging out from under an open conversation
    if (!this._isLookingAtBubble()) return;
    this._dragging = true;
  }

  _isLookingAtBubble() {
    if (!this._cameraSystem || !this.engine.camera) return false;
    const playerPos = this._cameraSystem.position;
    const bubblePos = this.movement.currentPosition;
    const dist = playerPos.distanceTo(bubblePos);
    if (dist > DRAG_REACH) return false;
    this.engine.camera.getWorldDirection(this._scratchForward);
    this._scratchDirection.subVectors(bubblePos, playerPos).normalize();
    return this._scratchDirection.dot(this._scratchForward) >= DRAG_LOOK_COS_THRESHOLD;
  }

  _stopDragging() {
    this._dragging = false;
  }

  /** "Stay Here" (Bubble Phone app) — simply stops ever picking a new
   *  idle destination; whatever it's doing right now (resting, or
   *  mid-journey) finishes naturally, it just never starts another one
   *  on its own until told otherwise. */
  stayHere() {
    this.playerCommand = "stay";
  }

  /** "Follow Me" — steps toward the player every frame (see
   *  `ResidentMovement.stepToward()`) instead of choosing its own idle
   *  destinations, stopping a comfortable distance short rather than
   *  overlapping the player. */
  followMe() {
    this.playerCommand = "follow";
  }

  /** "Return Home" — not a persistent mode at all, just a one-time
   *  request: clears whatever command was active and starts an ordinary
   *  idle-location journey toward the very first idle location
   *  (`IDLE_LOCATIONS[0]`, "beside the computer") — after arriving, it
   *  simply resumes normal autonomous wandering, exactly like any other
   *  idle-location arrival. */
  returnHome() {
    this.playerCommand = null;
    this.movement.travelTo(IDLE_LOCATIONS[0].id);
    this.residentState.setIdleLocation(IDLE_LOCATIONS[0].id);
  }

  /** Clears Stay/Follow, returning to ordinary autonomous wandering
   *  without also forcing a trip home the way returnHome() does. */
  resumeWandering() {
    this.playerCommand = null;
  }

  update(dt) {
    if (!this.renderer) return;

    const isAwake = this.residentConnection.isAwake;
    if (isAwake !== this._wasAwake) {
      this._wasAwake = isAwake;
      this.renderer.setAwake(isAwake);
    }

    if (this._dragging) {
      this._updateDragging(dt);
      return;
    }

    const playerDistance = this._computePlayerDistance();
    const isConversing = this.residentBehaviour.mode === "conversing";
    if (this.playerCommand === "follow" && playerDistance !== null && playerDistance > FOLLOW_DISTANCE) {
      this.movement.stepToward(this._playerPos, dt);
    } else if (!isConversing && this.playerCommand !== "stay") {
      const currentId = this.residentState.idleLocationId;
      const newId = this.movement.maybePickNewLocation(dt, currentId);
      if (newId) this.residentState.setIdleLocation(newId);
    }

    this.residentBehaviour.update(dt, playerDistance);

    const motion = this.movement.update(dt, { thinking: this.residentBehaviour.isThinking });
    const lookTarget = motion.lookAt.clone();
    if (playerDistance !== null) lookTarget.lerp(this._playerPos, this.residentBehaviour.awarenessBlend);

    this._syncPersistedState();
    this.renderer.update(dt, { position: motion.position, idleRotationY: motion.idleRotationY, scale: motion.scale, lookTarget });

    this._expressionTimer -= dt;
    if (this._expressionTimer <= 0) {
      this._expressionTimer = EXPRESSION_CHECK_INTERVAL;
      const expression = this.residentBehaviour.computeExpression(isAwake, this.residentState.mood);
      this.renderer.setExpression(expression);
      this.residentState.expression = expression;
    }
  }

  /** "Drag Bubble naturally through 3D space" — held at a fixed distance
   *  in front of the camera, eased toward that point rather than snapped
   *  there instantly, matching "gently reposition." Movement/idle-location
   *  logic is entirely bypassed for the duration (see `update()`'s own
   *  early return above) — a dragged Bubble isn't wandering or resting,
   *  it's being carried. */
  _updateDragging(dt) {
    if (!this.engine.input?.pointerLocked || !this.engine.camera) {
      this._stopDragging();
      return;
    }
    this.engine.camera.getWorldDirection(this._scratchForward);
    this._dragTarget.copy(this._cameraSystem.position).addScaledVector(this._scratchForward, DRAG_DISTANCE);
    this.movement.currentPosition.lerp(this._dragTarget, Math.min(1, dt * 6));
    this.movement.setDraggedPosition(this.movement.currentPosition);
    this.movement.setDraggedLookAt(this._cameraSystem.position);

    this._syncPersistedState();
    this.renderer.update(dt, {
      position: this.movement.currentPosition,
      idleRotationY: this.renderer.root.rotation.y,
      scale: new THREE.Vector3(1, 1, 1),
      lookTarget: this._cameraSystem.position,
    });
  }

  /** The plain-field persistence writes shared by both the normal update
   *  path and dragging — see ResidentState.js's own comment on why these
   *  don't emit "persistence:saveRequested" every frame, and on why
   *  facingDirection/expression/connectionState are snapshots only. */
  _syncPersistedState() {
    const p = this.movement.currentPosition;
    this.residentState.currentPosition = { x: p.x, y: p.y, z: p.z };
    this.residentState.facingDirection = this.renderer.root.rotation.y;
    this.residentState.connectionState = this.residentConnection.status;
  }

  _computePlayerDistance() {
    if (!this._cameraSystem) return null;
    this._playerPos.copy(this._cameraSystem.position);
    return this._playerPos.distanceTo(this.movement.currentPosition);
  }

  dispose() {
    this.engine.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointerup", this._onPointerUp);
  }
}
