import * as THREE from "three";
import { damp, clamp, shortestAngleLerp, wrapAngle, lerp } from "../utils/MathUtils.js";
import { DEFAULT_SPAWN } from "../data/layoutDefault.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";
import { FurnitureSystem } from "./FurnitureSystem.js";
import { WorldObjectsSystem } from "../worldbuilder/WorldObjectsSystem.js";
import { LadderSystem } from "./LadderSystem.js";
import { PlayerAnimationSystem } from "../player/PlayerAnimationSystem.js";

const WALK_SPEED = 2.3; // metres/second
const RUN_MULTIPLIER = 1.8;
const CROUCH_SPEED_MULTIPLIER = 0.55;
const PLAYER_RADIUS = 0.32;
// A fallback only — see "Player Height" in the class doc comment below.
// The real standing eye height is dynamic, read every frame from
// PlayerCharacterSystem's own current rig, since a taller or shorter
// character genuinely needs a different one.
const DEFAULT_STANDING_EYE_HEIGHT = 1.65;
const CROUCH_HEIGHT_REDUCTION = 0.5; // how much crouching lowers the eyes below whatever the standing height currently is — proportional to the character, not a fixed absolute number
// The Wardrobe's own proportion sliders (0.4x-2x per body part) can
// combine to produce a rig eye height around 3.76m at their extremes —
// comfortably above the workshop's own 3m ceiling. Clamping here means
// fixing "a taller character's feet end up below the floor" doesn't
// simply trade it for "a very tall character's camera clips through the
// ceiling instead" — the rig itself still builds at its full requested
// height (nothing about appearance/proportions is touched), only the
// camera's own eye height is bounded, the same "believable over
// physically exact" trade already made elsewhere in this project.
const MAX_STANDING_EYE_HEIGHT = 2.0;
const EYE_HEIGHT_DAMPING = 10; // how quickly standing<->crouch eye height eases, not a snap
const GRAVITY = 15.5; // metres/second² — tuned for snappy, game-y jump/fall arcs, not real-world 9.8
const JUMP_HEIGHT = 0.55; // metres — the actual design parameter; JUMP_VELOCITY below is derived from it
const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
const STEP_TOLERANCE = 0.6; // metres a surface can sit above the player's own feet and still count as reachable ground — see _computeGroundHeight()
const LAND_STATE_DURATION = 0.16; // seconds "land" holds before yielding to whatever movement calls for next
const LADDER_CLIMB_SPEED = 1.6; // metres/second
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.05;
const THIRD_PERSON_DISTANCE = 3.2; // metres behind the player
const THIRD_PERSON_HEIGHT = 0.85; // additional height above the standing eye height — comfortably under the workshop's 3m ceiling (see ROOM_DIMENSIONS in layoutDefault.js) even for a noticeably taller character
const THIRD_PERSON_LOOK_DROP = 0.35; // looks slightly down at the player rather than dead-level

/**
 * CameraSystem
 * ------------
 * Drives `engine.camera` directly (the room only ever has one camera), and
 * — since "Movement & Expression" — is also the Workshop's entire
 * movement controller: walking, running, crouching, jumping, falling,
 * landing, and climbing a ladder all live here, as one continuous state
 * machine built on top of the walk mode that already existed. Two modes:
 *
 *   "walk"  - default. WASD/virtual-joystick movement + pointer-lock
 *             mouse-look or touch-drag-look, circle-vs-box collision
 *             against the room walls and furniture/Builder-object
 *             footprints, plus real vertical movement (gravity, jumping,
 *             standing on top of Builder-created structures, climbing a
 *             ladder) — see `_updateWalk`/`_computeGroundHeight`.
 *   "focus" - entered when an interaction provides a focusPose (e.g. sitting
 *             at the computer desk). Movement and look are locked while the
 *             camera eases to the given position/orientation; exitFocus()
 *             eases back to wherever the player was standing.
 *
 * **"The movement controller should simply request animations from the
 * Animation System... avoid tightly coupling animation logic directly
 * into the movement controller."** This file has never seen an animation
 * clip, a pose, or a pivot name, and never will — every frame, it computes
 * one plain string ("idle"/"walk"/"run"/"jump"/"fall"/"land"/"crouch"/
 * "ladderClimb") describing what the player is *doing*, and hands it to
 * `PlayerAnimationSystem.setMovementState()`. What that state actually
 * looks like — which clip plays, how it blends, whether an emote is
 * currently overriding it — is entirely that system's own concern. See
 * docs/PLAYER.md's "Movement and animation" section for the full account.
 *
 * **Vertical movement** tracks a separate foot-level height (`_footY`)
 * from the eye-height offset added on top of it (`this.position.y =
 * _footY + _currentEyeHeight`) — gravity and jumping operate on the
 * former, crouching smoothly eases the latter, and third person/focus
 * mode never needed to know either exists, since both still only ever
 * read `this.position` as one combined number, same as before.
 * `_computeGroundHeight()` is a simple heightmap-style query, not real
 * physics: the base floor (y=0), plus the top surface of any nearby
 * Builder-object footprint the player could reasonably step onto or land
 * on — "favour believable over physically perfect" applies here exactly
 * as much as it does to reflections.
 *
 * A separate `viewMode` ("first" | "third") sits on top of whichever mode
 * above is active: `this.position`/`yaw`/`pitch` always represent the
 * player's own logical position and facing — where they're actually
 * standing, what movement/collision/focus-easing all operate on — and
 * third-person is purely a *rendering* choice layered on top in
 * `_applyCameraTransform()`, easing `engine.camera`'s own position/
 * rotation back behind the player rather than exactly onto them. Nothing
 * about movement, collision, or focus poses needed to change at all;
 * third person only ever exists in "walk" mode (see `toggleViewMode`) —
 * "the Workshop should continue being designed primarily for first-person
 * gameplay," so it doesn't apply mid-interaction, only while exploring.
 * The camera's own wall/furniture collision is reused as-is (see
 * `_resolveCollisions`) to keep the third-person view from clipping
 * through a wall, rather than introducing a second collision system for it.
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
    this.viewMode = "first"; // "first" | "third" — see toggleViewMode(). Deliberately not persisted: every session starts first-person, matching "the Workshop should continue being designed primarily for first-person gameplay" as the default you always land back on, not just an initial one.
    this._viewBlend = 0; // 0 = first person, 1 = third person — eased toward viewMode's target every frame, see update()
    // Vertical movement — see this class's own doc comment on _footY vs.
    // this.position.y. Spawns "grounded" at the default spawn height.
    this._footY = DEFAULT_SPAWN.position[1] - DEFAULT_STANDING_EYE_HEIGHT;
    this._verticalVelocity = 0;
    this._grounded = true;
    this._currentEyeHeight = DEFAULT_STANDING_EYE_HEIGHT;
    this._crouching = false;
    this._landTimer = 0;
    this._onLadder = false;
    this._characterSystem = null; // set via setCharacterSystem() from main.js — see "Player Height" in this class's own doc comment for why not a direct import
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
    this._worldObjectsSystem = engine.getSystem(WorldObjectsSystem);
    this._ladderSystem = engine.getSystem(LadderSystem);
    this._animationSystem = engine.getSystem(PlayerAnimationSystem);
    // Scratch objects reused every frame in _updateWalk/_resolveCollisions
    // instead of allocating a fresh Vector2/Vector3 each call — walking is
    // the workshop's default, continuous state, so this is the hottest
    // per-frame path in the whole engine.
    this._scratchForward = new THREE.Vector3();
    this._scratchRight = new THREE.Vector3();
    this._scratchWish = new THREE.Vector2();
    this._scratchNext = new THREE.Vector3();
    // Third-person blending — see _applyCameraTransform().
    this._scratchFPQuat = new THREE.Quaternion();
    this._scratchEuler = new THREE.Euler(0, 0, 0, "YXZ");
    this._scratchThirdDesired = new THREE.Vector3();
    this._scratchThirdLookAt = new THREE.Vector3();
    // A real (if never rendered) camera, not a plain Object3D — see the
    // comment where this is used in _applyCameraTransform() for why that
    // distinction actually matters here, not just for tidiness.
    this._scratchThirdDummy = new THREE.PerspectiveCamera();
    this.engine.events.on("persistence:save", (bag) => {
      bag.camera = { position: this.position.toArray(), yaw: this.yaw, pitch: this.pitch };
    });
    this.engine.events.on("persistence:load", (bag) => {
      if (!bag?.camera) return;
      this.position.fromArray(bag.camera.position);
      this.yaw = bag.camera.yaw;
      this.pitch = bag.camera.pitch;
      // Crouch/vertical-velocity state isn't meaningful to persist across
      // sessions — every load lands standing, on whatever the loaded
      // height implies for its own footing.
      this._footY = this.position.y - this._getStandingEyeHeight();
      this._currentEyeHeight = this._getStandingEyeHeight();
      this._verticalVelocity = 0;
      this._grounded = true;
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

  /** Third person only ever applies in "walk" mode — see this class's own
   *  doc comment. Toggling while focused (sitting at the computer, say)
   *  is simply a no-op rather than a state a future exitFocus() would
   *  need to unwind. */
  /** Wired from main.js, not a direct import — PlayerCharacterSystem
   *  already imports CameraSystem (to follow its position/yaw), so this
   *  system importing PlayerCharacterSystem back would create a genuine
   *  circular import between the two files, the same situation
   *  PlayerAnimationSystem's own constructor-injected reference already
   *  avoids for the same reason. main.js constructs both and wires this
   *  one reference through directly. */
  setCharacterSystem(characterSystem) {
    this._characterSystem = characterSystem;
  }

  /** "Player Height" — the actual eye height a standing player should
   *  have right now, read fresh from the live rig every time this is
   *  called rather than assumed to be a universal constant. A taller or
   *  shorter character genuinely needs a different eye height; treating
   *  1.65m as the same number for every body is what let a taller
   *  character end up with their feet pushed below the floor — the rig
   *  itself always computed the correct number
   *  (`PlayerCharacterSystem.getEyeHeight()`), this system just wasn't
   *  asking it. Falls back to a fixed default before the character
   *  system exists yet (this class's own constructor) or before the very
   *  first rig has finished building. */
  _getStandingEyeHeight() {
    const rigHeight = this._characterSystem?.getEyeHeight() ?? DEFAULT_STANDING_EYE_HEIGHT;
    return Math.min(rigHeight, MAX_STANDING_EYE_HEIGHT);
  }

  toggleViewMode() {
    if (this.mode === "focus") return;
    this.viewMode = this.viewMode === "first" ? "third" : "first";
  }

  /** The "I'm Lost!" button's entire job — a pure quality-of-life escape
   *  hatch, not something the Workshop itself ever triggers on its own.
   *  Resets every piece of position-related state this system owns, not
   *  just `this.position` — `_footY`/`_verticalVelocity`/`_grounded` all
   *  need to agree with the new position too, or the very next frame's
   *  gravity would immediately start acting on stale values (falling
   *  from whatever height the player used to be at, say). Cancels focus
   *  mode outright if it happened to be active, rather than trying to
   *  ease out of it — being lost is exactly the situation where a
   *  guaranteed-safe reset matters more than a smooth transition. */
  recoverToSpawn() {
    this.mode = "walk";
    this.locked = false;
    this._preFocus = null;
    this._focusPose = null;
    this.position.set(...DEFAULT_SPAWN.position);
    this.yaw = DEFAULT_SPAWN.yaw;
    this.pitch = 0;
    this._footY = DEFAULT_SPAWN.position[1] - this._getStandingEyeHeight();
    this._verticalVelocity = 0;
    this._grounded = true;
    this._crouching = false;
    this._currentEyeHeight = this._getStandingEyeHeight();
    this._landTimer = 0;
    this._onLadder = false;
    this.viewMode = "first";
    this._viewBlend = 0;
    this.engine.events.emit("persistence:saveRequested");
  }

  update(dt) {
    if (!this.locked && this.engine.input?.wasJustPressed("toggleView")) this.toggleViewMode();

    if (this.mode === "focus") this._updateFocus(dt);
    else if (!this.locked) this._updateWalk(dt);

    const thirdPersonActive = this.viewMode === "third" && this.mode === "walk";
    this._viewBlend = damp(this._viewBlend, thirdPersonActive ? 1 : 0, 6, dt);
    this._applyCameraTransform();
  }

  /** Where `engine.camera` actually ends up — always derived from
   *  `this.position`/`yaw`/`pitch` (the player's real, logical state),
   *  never the other way around. Blends smoothly toward/from the
   *  third-person offset via `_viewBlend` rather than snapping, so
   *  toggling view mode reads as one continuous camera move — "keep
   *  switching between first and third person smooth and unobtrusive." */
  _applyCameraTransform() {
    const camera = this.engine.camera;
    if (this._viewBlend < 0.001) {
      camera.position.copy(this.position);
      camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      return;
    }

    this._scratchFPQuat.setFromEuler(this._scratchEuler.set(this.pitch, this.yaw, 0, "YXZ"));

    // "Behind" the player is the opposite of _updateWalk's own forward
    // vector (Math.sin(yaw), 0, Math.cos(yaw)) rather than its negation.
    const desired = this._scratchThirdDesired.set(
      this.position.x + Math.sin(this.yaw) * THIRD_PERSON_DISTANCE,
      this.position.y + THIRD_PERSON_HEIGHT,
      this.position.z + Math.cos(this.yaw) * THIRD_PERSON_DISTANCE
    );
    // Reuses the exact same wall/furniture push-out the player's own
    // movement already does — not a second collision system, just the
    // desired camera point treated as a "next position" like any other.
    this._resolveCollisions(desired);

    const lookAt = this._scratchThirdLookAt.set(this.position.x, this.position.y - THIRD_PERSON_LOOK_DROP, this.position.z);
    this._scratchThirdDummy.position.copy(desired);
    // `Object3D.lookAt()` has a genuine, easy-to-miss gotcha: internally,
    // it swaps which point is the "eye" and which is the "target" for
    // anything that isn't a camera or light (`this.isCamera`/`isLight`) —
    // meaning a *plain* Object3D used purely as a lookAt-math scratch
    // helper computes an orientation exactly 180° from what a camera
    // actually needs to face that same target. This was that bug: "the
    // third-person camera... is rotated away from the player" — fixed by
    // making `_scratchThirdDummy` a real PerspectiveCamera (constructor
    // above), never rendered, purely so `isCamera` is true and `lookAt()`
    // uses the correct convention.
    this._scratchThirdDummy.lookAt(lookAt);

    camera.position.lerpVectors(this.position, desired, this._viewBlend);
    camera.quaternion.slerpQuaternions(this._scratchFPQuat, this._scratchThirdDummy.quaternion, this._viewBlend);
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
    const moving = wish.lengthSq() > 0.0004;

    const ladderZone = this._ladderSystem?.getZoneAt(this.position.x, this._footY + 0.1, this.position.z) ?? null;
    this._onLadder = !!ladderZone;

    let movementState;
    if (this._onLadder) {
      movementState = this._updateLadderMovement(dt, ladderZone, input);
    } else {
      movementState = this._updateGroundMovement(dt, wish, moving, input);
    }

    this._animationSystem?.setMovementState(movementState);
  }

  /** Ordinary horizontal movement, gravity, jumping, crouching, and
   *  standing on Builder-created structures — everything that isn't
   *  climbing a ladder. Returns the movement state string for this frame. */
  _updateGroundMovement(dt, wish, moving, input) {
    const running = input.isHeld("run") && !this._crouching && moving;
    const speed = WALK_SPEED * (this._crouching ? CROUCH_SPEED_MULTIPLIER : running ? RUN_MULTIPLIER : 1);

    this._velocity.x = damp(this._velocity.x, wish.x * speed, 10, dt);
    this._velocity.y = damp(this._velocity.y, wish.y * speed, 10, dt);

    const next = this._scratchNext.copy(this.position);
    next.x += this._velocity.x * dt;
    next.z += this._velocity.y * dt;
    this._resolveCollisions(next);
    this.position.x = next.x;
    this.position.z = next.z;

    // Crouching is only ever entered/held while grounded — crouching
    // mid-air has no meaning here and would just fight with the jump/fall
    // states below.
    const crouchHeld = input.isHeld("crouch");
    this._crouching = this._grounded && crouchHeld;

    const wasGrounded = this._grounded;
    if (this._grounded && input.wasJustPressed("jump") && !this._crouching) {
      this._verticalVelocity = JUMP_VELOCITY;
      this._grounded = false;
    }

    if (!this._grounded) this._verticalVelocity -= GRAVITY * dt;
    this._footY += this._verticalVelocity * dt;

    const groundHeight = this._computeGroundHeight(this.position.x, this.position.z);
    if (this._footY <= groundHeight) {
      this._footY = groundHeight;
      this._verticalVelocity = 0;
      this._grounded = true;
      if (!wasGrounded) this._landTimer = LAND_STATE_DURATION;
    } else {
      this._grounded = false;
    }

    const standingEyeHeight = this._getStandingEyeHeight();
    const targetEyeHeight = this._crouching ? standingEyeHeight - CROUCH_HEIGHT_REDUCTION : standingEyeHeight;
    this._currentEyeHeight = damp(this._currentEyeHeight, targetEyeHeight, EYE_HEIGHT_DAMPING, dt);
    this.position.y = this._footY + this._currentEyeHeight;

    if (!this._grounded) return this._verticalVelocity > 0.3 ? "jump" : "fall";
    if (this._landTimer > 0) {
      this._landTimer -= dt;
      return "land";
    }
    if (this._crouching) return "crouch";
    if (moving) return running ? "run" : "walk";
    return "idle";
  }

  /** Vertical movement along a ladder zone — forward/back input climbs up/
   *  down (facing the ladder to climb up reads more naturally than a
   *  dedicated key, and needs no new input binding at all), gravity is
   *  suspended, and horizontal drift stays gentle so the player doesn't
   *  need to fight to stay near the rungs while climbing. */
  _updateLadderMovement(dt, zone, input) {
    this._verticalVelocity = 0;
    this._crouching = false;
    this._currentEyeHeight = damp(this._currentEyeHeight, this._getStandingEyeHeight(), EYE_HEIGHT_DAMPING, dt);

    // input.moveVector.y is "how much forward input", relative to the
    // player's own facing — not wish.y, which is wish's *world-space* Z
    // component after the yaw transform below already applied. Using
    // wish.y here would only actually correlate with "pressing forward"
    // when facing exactly north or south; at any other facing it would
    // read as close to zero even while holding W, since a sideways-facing
    // "forward" barely moves along world Z at all.
    const climbInput = input.moveVector.y;
    this._footY = clamp(this._footY + climbInput * LADDER_CLIMB_SPEED * dt, zone.min.y, zone.max.y);

    // Gentle horizontal drift only — strafe a little, but a ladder isn't a
    // place to wander away from while still inside its own zone. Uses
    // just the strafe component (this._scratchRight, already computed by
    // _updateWalk before this was called, scaled by the raw strafe
    // input) rather than wish, which mixes in the forward component too
    // — forward input is fully spoken for by climbing here, and
    // arbitrarily zeroing world-space Z instead would be wrong at any
    // facing angle that isn't exactly north or south.
    const next = this._scratchNext.copy(this.position);
    next.x += this._scratchRight.x * input.moveVector.x * WALK_SPEED * 0.4 * dt;
    next.z += this._scratchRight.z * input.moveVector.x * WALK_SPEED * 0.4 * dt;
    this._resolveCollisions(next);
    this.position.x = next.x;
    this.position.z = next.z;
    this.position.y = this._footY + this._currentEyeHeight;

    return Math.abs(climbInput) > 0.05 ? "ladderClimb" : "idle";
  }

  /** A simple heightmap-style query, not real physics: the base floor
   *  (y=0), plus the top surface of any nearby Builder-object footprint
   *  (`WorldObjectsSystem.getFootprints()` specifically — real,
   *  per-object bounding boxes, unlike furniture's own footprints, which
   *  are a fixed 0-2.2m collision column rather than the piece's actual
   *  height; see WorldObjectsSystem.js). A surface only counts if it's
   *  within `STEP_TOLERANCE` of the player's current feet — close enough
   *  to step up onto or land on, not a distant platform floating far
   *  overhead that would otherwise teleport the player up onto it the
   *  moment they walked underneath it. */
  _computeGroundHeight(x, z) {
    let best = 0;
    for (const box of this._worldObjectsSystem?.getFootprints?.() ?? []) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (box.max.y > best && box.max.y <= this._footY + STEP_TOLERANCE) best = box.max.y;
    }
    return best;
  }

  _resolveCollisions(next) {
    for (const wallBox of this._roomSystem?.getWallColliders?.() ?? []) {
      this._pushOutOfBox(next, wallBox);
    }
    for (const footprint of this._furnitureSystem?.getFootprints?.() ?? []) {
      this._pushOutOfBox(next, footprint);
    }
    for (const footprint of this._worldObjectsSystem?.getFootprints?.() ?? []) {
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
