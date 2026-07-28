import * as THREE from "three";
import { damp, clamp, shortestAngleLerp, wrapAngle, lerp } from "../utils/MathUtils.js";
import { prefersReducedMotion } from "../utils/motionPreference.js";
import { DEFAULT_SPAWN } from "../data/layoutDefault.js";
import { RoomLayoutSystem } from "./RoomLayoutSystem.js";
import { FurnitureSystem } from "./FurnitureSystem.js";
import { WorldObjectsSystem } from "../worldbuilder/WorldObjectsSystem.js";
import { LadderSystem } from "./LadderSystem.js";
import { PlayerAnimationSystem } from "../player/PlayerAnimationSystem.js";
import { TerrainSystem } from "./TerrainSystem.js";
import { FIRST_PERSON_HIDDEN_LAYER } from "../player/PlayerCharacter.js";

const WALK_SPEED = 2.3; // metres/second
const RUN_MULTIPLIER = 1.8;
const CROUCH_SPEED_MULTIPLIER = 0.55;
const PLAYER_RADIUS = 0.32;
// Version 3, Phase 5 ("Beyond One Building") — a fixed, generous
// approximation for collision purposes only (real standing eye height is
// dynamic, read from the current rig — see DEFAULT_STANDING_EYE_HEIGHT's
// own comment below), used solely to decide whether the player could be
// standing fully clear underneath a raised World Object; see
// _pushOutOfBox()'s own comment.
const PLAYER_HEIGHT = 1.9;
// A fallback only — see "Player Height" in the class doc comment below.
// The real standing eye height is dynamic, read every frame from
// PlayerCharacterSystem's own current rig, since a taller or shorter
// character genuinely needs a different one.
const DEFAULT_STANDING_EYE_HEIGHT = 1.65;
// Workshop Refinement phase (Pass A) — "recent crouching adjustments
// lowered the camera too far into the player model... find a better
// compromise." This constant's own comment always claimed the crouch
// reduction was "proportional to the character" — but the code
// subtracted a fixed 0.5m from *any* standing height, never actually
// proportional to anything. That mismatch is the real root cause: a
// flat 0.5m off a typical ~1.65m standing height is a much bigger
// relative drop than a genuinely proportional reduction would be, which
// is what was pushing the camera low enough to feel like it was sinking
// into the model. Fixed to be what the comment always said it should
// be — a ratio of the character's own standing height, not a fixed
// absolute subtraction — which resolves the complaint for every body
// proportion at once rather than just retuning one fixed number for the
// default-sized case.
const CROUCH_HEIGHT_RATIO = 0.78; // crouched eye height, as a fraction of standing — genuinely proportional to the character, unlike the fixed-subtraction constant this replaces
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
const JUMP_HEIGHT = 0.95; // metres — raised again (0.55 → 0.8 → 0.95) so a jump comfortably clears the top of typical Builder-created furniture and structures, not just a small step; JUMP_VELOCITY below is derived from it
const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
const STEP_TOLERANCE = 0.6; // metres a surface can sit above the player's own feet and still count as reachable ground — see _computeGroundHeight()
const LAND_STATE_DURATION = 0.16; // seconds "land" holds before yielding to whatever movement calls for next
const LADDER_CLIMB_SPEED = 1.6; // metres/second
const LOOK_SENSITIVITY = 0.0022;
const DEFAULT_FOV = 62; // matches Engine.js's own PerspectiveCamera construction — the one place this number is otherwise hardcoded
const ZOOM_FOV = 38; // a comfortable, noticeable zoom without feeling like a sniper scope
const MAX_PITCH = Math.PI / 2 - 0.05;
const THIRD_PERSON_DISTANCE = 3.2; // metres behind the player
const THIRD_PERSON_HEIGHT = 0.85; // additional height above the standing eye height — comfortably under the workshop's 3m ceiling (see ROOM_DIMENSIONS in layoutDefault.js) even for a noticeably taller character
const THIRD_PERSON_LOOK_DROP = 0.35; // looks slightly down at the player rather than dead-level
// v4.0.9e — Minecraft-style head turn: the reticle/camera can swivel this
// far past the body's own facing (this.yaw) before the body is dragged
// along with it. A bit more generous than LookAtIK.js's own NPC-awareness
// cone (0.4 rad) — matching Minecraft's own snappier feel for a player's
// own look, not an NPC noticing something.
const PLAYER_HEAD_YAW_MAX = Math.PI * 0.44;
// Version 4, Phase 11 ("The Player's Own Body") — "the player's body needs
// to start rotating when the head/camera gets to 35 degrees, not complete
// 90 before the body turns."
//
// This is a *different mechanism* from the clamp above, not a smaller
// value for it, and that distinction is the whole point. Before this
// phase the body was completely still until the head hit its own limit
// and was then dragged 1:1 by the excess — so an ordinary look-around
// never turned the body at all, and going past the limit turned it
// abruptly. Now the body begins easing toward the head the moment the
// offset passes this threshold, continuously, and `PLAYER_HEAD_YAW_MAX`
// stays as the hard backstop it always was for a fast flick that
// outruns the ease.
const BODY_FOLLOW_THRESHOLD = Math.PI * (35 / 180); // exactly the 35° asked for
// How briskly the body catches up once past that threshold. Tuned to read
// as "turning to follow where you're looking" rather than either a snap
// or a drift — the same `damp()` helper every other easing in this file
// uses, so it stays frame-rate independent.
const BODY_FOLLOW_RATE = 6;
// Version 4, Phase 11 — "when the player [is] moving forward the body
// should snap back to the direction the camera is facing and start walking
// that way." Deliberately faster than BODY_FOLLOW_RATE: this one is a
// direct response to a movement input rather than ambient catch-up, so it
// should feel immediate without being instantaneous (an instant snap makes
// the whole world lurch sideways).
const BODY_SNAP_ON_MOVE_RATE = 14;

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
    this._lookPaused = false; // see pauseLook()/resumeLook() — the Workshop Phone's own, less restrictive alternative to lock()
    this._zoomBlend = 0; // 0-1, eased toward whether "zoom" is currently held — see _updateZoom()
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
    // v4.0.9e — signed radians, camera-look-yaw minus body-yaw (this.yaw).
    // Accumulated by _updateWalk()'s own mouse-look block, clamped to
    // ±PLAYER_HEAD_YAW_MAX; read by _applyCameraTransform() (added onto
    // this.yaw for the rendered first-person view) and by
    // PlayerAnimationSystem (via getHeadYawOffset(), layered on right
    // after applyPose() each frame — see that file's own comment on why
    // it's read there and not by PlayerCharacterSystem) to turn the
    // visible rig's own head pivot the same amount.
    this._headYawOffset = 0;
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
    this._terrainSystem = engine.getSystem(TerrainSystem);
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

  /** "Using the phone should NOT freeze the player... the mouse should
   *  temporarily stop controlling the camera. Keyboard movement should
   *  continue functioning normally." Deliberately a separate, narrower
   *  pair from `lock()`/`unlock()` — those stop *everything*, including
   *  WASD movement, which is exactly right for Build Mode's own
   *  "stand still while placing something" need but wrong for the phone.
   *  `_updateWalk()`'s own mouse-look block checks this flag specifically;
   *  every other line in that function (movement, running, jumping,
   *  crouching, ladders) runs completely unaffected by it. */
  pauseLook() {
    this._lookPaused = true;
  }

  resumeLook() {
    this._lookPaused = false;
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

  /** The *current* eye height — standing or eased partway/fully into a
   *  crouch, whichever this frame's own `_currentEyeHeight` actually is.
   *  Distinct from `_getStandingEyeHeight()` (always the standing value,
   *  used to compute where a crouch even eases *from*). See
   *  `PlayerCharacterSystem.update()`'s own comment for why this one
   *  specifically — not the standing height — is what the rig's own
   *  root position needs to subtract. */
  getCurrentEyeHeight() {
    return this._currentEyeHeight;
  }

  /** v4.0.9e — signed radians the camera's own look-yaw currently leads
   *  the body's facing (this.yaw) by; see `_updateWalk()`'s own
   *  accumulate-then-overflow-to-body block. Read by
   *  `PlayerAnimationSystem` to turn the visible rig's own head pivot the
   *  same amount the rendered first-person view already turns by. */
  getHeadYawOffset() {
    return this._headYawOffset;
  }

  /** v4.0.9e — how far the camera has already eased down for a crouch
   *  right now (0 standing, positive while crouched/easing), reusing the
   *  exact same `_currentEyeHeight` easing crouch already drives — not a
   *  second, independently-tuned number. `PlayerAnimationSystem` applies
   *  this identical amount to the visible torso/head pivot's own world Y
   *  (and, since `FootIK.js`'s own `applyCrouchFootIK()` reads the
   *  torso's live world position too, feeds through to the legs' own
   *  target that same frame), so the rig genuinely lowers with the camera
   *  instead of only the legs bending to reach a torso that secretly
   *  never moved. */
  getCrouchDrop() {
    return this._getStandingEyeHeight() - this._currentEyeHeight;
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
    this._zoomBlend = 0;
    this.engine.camera.fov = DEFAULT_FOV;
    this.engine.camera.updateProjectionMatrix();
    this.engine.events.emit("persistence:saveRequested");
  }

  update(dt) {
    if (!this.locked && this.engine.input?.wasJustPressed("toggleView")) this.toggleViewMode();

    if (this.mode === "focus") this._updateFocus(dt);
    else if (!this.locked) this._updateWalk(dt);

    const thirdPersonActive = this.viewMode === "third" && this.mode === "walk";
    // Version 3, Phase 12 — the first/third-person switch is a real
    // perspective change, not just a number easing; snap instead of
    // ease under prefers-reduced-motion, same reasoning as _updateFocus.
    this._viewBlend = prefersReducedMotion() ? (thirdPersonActive ? 1 : 0) : damp(this._viewBlend, thirdPersonActive ? 1 : 0, 6, dt);
    // Version 3, Phase 1 ("Completing Promises") — "crouching should
    // restore a comfortable first-person camera without animation
    // artefacts obscuring the view." Standing has always relied on a
    // coincidence to hide the player's own head from their own eyes: the
    // first-person camera sits precisely inside the head mesh, so ordinary
    // backface culling hides it. Crouching moves the camera
    // (CROUCH_HEIGHT_RATIO above) without moving the rig at all — nothing
    // in this rig ever translates, only rotates (see PlayerCharacter.js's
    // applyPose()) — so the camera ends up inside the torso instead, and
    // the head it left behind floats visibly above it. Excluding
    // FIRST_PERSON_HIDDEN_LAYER from the camera exactly whenever
    // `thirdPersonActive` is false replaces that coincidence with
    // something that holds at every crouch depth, not just while
    // standing — and correctly covers focus mode too (sitting down always
    // eases back to first person regardless of `viewMode`, same as this
    // value already does above). ReflectionSystem.js re-enables this layer
    // on every mirror's own camera, since a reflection should always show
    // the full character.
    this.engine.camera.layers[thirdPersonActive ? "enable" : "disable"](FIRST_PERSON_HIDDEN_LAYER);
    this._updateZoom(dt);
    this._applyCameraTransform();
  }

  /** "Holding the Z key should smoothly zoom the camera in. Releasing
   *  the key should smoothly return the camera to its normal field of
   *  view. This should work naturally in both first-person and
   *  third-person views where appropriate." A held key, not a toggle —
   *  `isHeld`, not `wasJustPressed` — and a smooth `damp()` on the
   *  camera's own FOV rather than a snap, matching every other eased
   *  transition this class already uses (view-mode blending, focus
   *  poses). Deliberately does nothing while sitting down (`mode ===
   *  "focus"`, at the Computer or Workbench) — the camera is fixed on a
   *  screen there, and "where appropriate" is exactly this: zoom is a
   *  walking-around gesture, not something that means anything while
   *  already looking at a screen. */
  _updateZoom(dt) {
    const held = this.mode === "walk" && !this.locked && (this.engine.input?.isHeld("zoom") ?? false);
    // Version 3, Phase 12 — snap straight to the held/released FOV under
    // prefers-reduced-motion rather than easing toward it.
    this._zoomBlend = prefersReducedMotion() ? (held ? 1 : 0) : damp(this._zoomBlend, held ? 1 : 0, 8, dt);
    const fov = DEFAULT_FOV + (ZOOM_FOV - DEFAULT_FOV) * this._zoomBlend;
    if (Math.abs(this.engine.camera.fov - fov) > 0.01) {
      this.engine.camera.fov = fov;
      this.engine.camera.updateProjectionMatrix();
    }
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
      // v4.0.9e — the head-turn-before-body offset (see _updateWalk())
      // reaches the actual rendered view here.
      camera.rotation.set(this.pitch, this.yaw + this._headYawOffset, 0, "YXZ");
      return;
    }

    // Same offset folded in here too, so the rotation is continuous across
    // the `_viewBlend < 0.001` threshold above rather than popping the
    // instant a third-person transition begins — this is still the
    // "first-person" endpoint of the slerp below, not the orbit itself
    // (which deliberately stays keyed to body yaw alone, see `desired`).
    this._scratchFPQuat.setFromEuler(this._scratchEuler.set(this.pitch, this.yaw + this._headYawOffset, 0, "YXZ"));

    // "Introduce vertical camera orbit... look upwards, look downwards,
    // orbit around the player smoothly." Reuses the exact same `pitch`
    // that already drives first-person looking, so third person always
    // shows roughly the same direction the player is actually looking.
    // Ordinary spherical coordinates — cos(pitch) shrinks the horizontal
    // distance as the camera swings toward directly overhead/underneath,
    // sin(pitch) grows the vertical offset by the same amount, so the
    // camera always stays the same true distance from the player
    // regardless of pitch.
    //
    // **Version 4, Phase 11 — the vertical term is negated, fixing "1st
    // person and 3rd person mouse/touch movements are inverted from each
    // other."** This block used to add `+ sin(pitch)` and its comment
    // asserted "positive pitch (looking down, in this project's own
    // convention)". That convention claim was simply wrong, and measuring
    // it settled the matter: with the `"YXZ"` Euler order used a few lines
    // above, a camera at `rotation.x = +0.5` has a forward vector of
    // `(0, +0.479, -0.878)` — positive pitch looks **up**. Meanwhile
    // `+ sin(pitch)` raised the orbit camera for positive pitch, which
    // frames the player from above, i.e. looking **down**. So the two view
    // modes genuinely did respond to the same mouse movement in opposite
    // vertical directions, exactly as reported. First person is the
    // reference — it is what `invertLook` is tuned against and what a
    // player spends most time in — so the orbit is what changes here.
    const orbitHorizontalDistance = THIRD_PERSON_DISTANCE * Math.cos(this.pitch);
    const orbitVerticalOffset = THIRD_PERSON_HEIGHT - THIRD_PERSON_DISTANCE * Math.sin(this.pitch);
    // **Version 4, Phase 11 — the orbit now follows the head, not just the
    // body:** "3rd person view needs to move with the head movement not
    // the body movement, as done [with] the compass."
    //
    // This deliberately reverses a Phase 9e decision. That phase kept the
    // orbit keyed to `this.yaw` alone and said so explicitly, reasoning
    // that the camera position should be stable while only the head
    // turned. In practice that means looking around in third person moves
    // nothing until the body follows, which reads as an unresponsive
    // camera rather than a stable one. The HUD compass already tracks the
    // full look direction, which is why Vi's note names it as the
    // reference — the orbit was the outlier, not the compass.
    const orbitYaw = this.yaw + this._headYawOffset;
    // "Behind" the player is the opposite of _updateWalk's own forward
    // vector (Math.sin(yaw), 0, Math.cos(yaw)) rather than its negation.
    const desired = this._scratchThirdDesired.set(
      this.position.x + Math.sin(orbitYaw) * orbitHorizontalDistance,
      this.position.y + orbitVerticalOffset,
      this.position.z + Math.cos(orbitYaw) * orbitHorizontalDistance
    );
    // A floor clamp the horizontal-only wall/furniture push-out below
    // doesn't provide on its own — orbiting steeply upward (looking far
    // down) could otherwise put the desired camera position below the
    // actual floor for a crouched or short-statured moment.
    desired.y = Math.max(desired.y, 0.15);
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

    if (input.lookActive && !this._lookPaused) {
      // v4.0.9e — Minecraft-style: yaw look accumulates into the head
      // offset first, body facing (this.yaw) only follows once the
      // offset would exceed PLAYER_HEAD_YAW_MAX, and then only by the
      // excess — no easing/lag, so a fast turn past the clamp drags the
      // body 1:1 rather than rubber-banding it into place.
      this._headYawOffset -= input.lookDelta.x * LOOK_SENSITIVITY;
      if (this._headYawOffset > PLAYER_HEAD_YAW_MAX) {
        this.yaw = wrapAngle(this.yaw + (this._headYawOffset - PLAYER_HEAD_YAW_MAX));
        this._headYawOffset = PLAYER_HEAD_YAW_MAX;
      } else if (this._headYawOffset < -PLAYER_HEAD_YAW_MAX) {
        this.yaw = wrapAngle(this.yaw + (this._headYawOffset + PLAYER_HEAD_YAW_MAX));
        this._headYawOffset = -PLAYER_HEAD_YAW_MAX;
      }
      this.pitch -= input.lookDelta.y * LOOK_SENSITIVITY;
      this.pitch = clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
    }

    // Version 4, Phase 11 — the body follows the head, in two ways that
    // deliberately coexist rather than one replacing the other.
    //
    // Both work by moving `this.yaw` toward the head and reducing
    // `_headYawOffset` by exactly the same amount, so the *rendered* view
    // direction (`yaw + _headYawOffset`, see `_applyCameraTransform()`)
    // never changes as a result. That invariant is what makes this feel
    // like the body catching up rather than the camera being yanked: the
    // player's aim stays exactly where they put it throughout.
    const bodyFollow = (rate) => {
      const eased = damp(this._headYawOffset, 0, rate, dt);
      const applied = this._headYawOffset - eased;
      this.yaw = wrapAngle(this.yaw + applied);
      this._headYawOffset = eased;
    };

    const move = input.moveVector; // x = strafe, y = forward

    // Version 4, Phase 11 — apply the two body-follow behaviours before
    // the movement basis below is computed from `this.yaw`, so walking
    // forward genuinely goes where the camera is now pointing rather than
    // lagging a frame behind it.
    //
    // Walking *forward* brings the body all the way round to the camera
    // briskly. Strafing and walking backward deliberately do **not**:
    // strafing with your head turned is a real thing people do to look
    // where they're going while moving sideways, and force-turning the
    // body would fight that rather than serve it.
    //
    // **`move.y` is POSITIVE for forward**, which is worth stating because
    // the line below it reads as though the opposite were true: the
    // forward *vector* carries a `multiplyScalar(-1)`, so it is the basis
    // vector that is negated, not the input axis. This was written the
    // wrong way round on the first pass and caught by driving a real
    // `KeyW` event through `InputManager` and reading `moveVector.y`
    // (it is `+1`) rather than by inferring the sign from the maths below.
    const walkingForward = move.y > 0.01;
    if (walkingForward) {
      bodyFollow(BODY_SNAP_ON_MOVE_RATE);
    } else if (Math.abs(this._headYawOffset) > BODY_FOLLOW_THRESHOLD) {
      // Standing still (or strafing) and looking well off to one side: the
      // body turns to follow, but only the part of the offset that exceeds
      // the threshold — so the first 35° stays a free head-turn with the
      // body completely still, exactly as asked for, and beyond that the
      // body eases round until only 35° of head-turn is left.
      const sign = Math.sign(this._headYawOffset);
      const excess = Math.abs(this._headYawOffset) - BODY_FOLLOW_THRESHOLD;
      const easedExcess = damp(excess, 0, BODY_FOLLOW_RATE, dt);
      const applied = (excess - easedExcess) * sign;
      this.yaw = wrapAngle(this.yaw + applied);
      this._headYawOffset -= applied;
    }

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
    const belowGround = this._footY - groundHeight;

    if (belowGround <= 0) {
      // At or above the ground surface after this frame's own vertical
      // movement — resting exactly on it, or a rising slope carried the
      // foot up to meet it (unconditional — an upward step, however
      // steep, was never the reported problem).
      this._footY = groundHeight;
      this._verticalVelocity = 0;
      this._grounded = true;
      if (!wasGrounded) this._landTimer = LAND_STATE_DURATION;
    } else if (this._grounded && belowGround <= STEP_TOLERANCE) {
      // "Walking down gentle slopes or edited terrain should not enter a
      // falling state." `_footY` only ever integrates gravity — it
      // doesn't automatically track a *descending* ground height as the
      // player moves horizontally across it, so the ground can end up
      // very slightly below last frame's foot position on any downhill
      // slope, purely as an artefact of this frame's own horizontal
      // step, with no actual falling involved. Reusing STEP_TOLERANCE
      // (already the "how big a ledge can be stepped up onto" budget)
      // for "how big a drop still counts as walking, not falling" keeps
      // both directions of the same ordinary terrain-following behaviour
      // governed by one shared, already-tuned distance. Only real
      // freefall — a jump already in progress, or a drop bigger than
      // this — reaches the `else` below.
      //
      // Visual Identity phase — "jumping has stopped functioning
      // correctly... determine the underlying cause." This condition
      // originally read `wasGrounded` (captured above, *before* the
      // jump-input check runs) rather than `this._grounded` (the current
      // value). On the exact frame a jump starts, `this._grounded` is
      // already correctly `false` by the time execution reaches here —
      // but `wasGrounded` was captured one line earlier and still held
      // the pre-jump `true`. A single frame's worth of jump rise (a few
      // centimetres) is always far smaller than STEP_TOLERANCE (0.6m),
      // so this branch fired on every single jump's very first frame,
      // silently snapping the foot straight back to the ground and
      // zeroing the velocity that was just set two lines above — the
      // jump was cancelled before it ever rendered a single frame, every
      // time, unconditionally. This branch's own comment already
      // described the intended behaviour correctly ("a jump already in
      // progress" should skip this branch) — `this._grounded` is what
      // actually delivers that; `wasGrounded` only catches up one frame
      // too late. Ordinary walking is unaffected: nothing between the
      // `wasGrounded` capture and here ever changes `this._grounded`
      // except the jump check itself, so the two values are identical on
      // every frame that isn't a jump's own first frame.
      this._footY = groundHeight;
      this._verticalVelocity = 0;
      this._grounded = true;
    } else {
      this._grounded = false;
    }

    const standingEyeHeight = this._getStandingEyeHeight();
    const targetEyeHeight = this._crouching ? standingEyeHeight * CROUCH_HEIGHT_RATIO : standingEyeHeight;
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
    // "Smooth entering" — damping the vertical velocity out rather than
    // zeroing it instantly reads as smoothly catching the rungs (e.g.
    // grabbing on mid-fall) instead of an abrupt full stop the moment the
    // zone is entered.
    this._verticalVelocity = damp(this._verticalVelocity, 0, 14, dt);
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

    // Paused on the ladder (not actively climbing) still reports
    // "ladderClimb", not "idle" — a standing idle pose (relaxed arms at
    // the sides) would look clearly wrong for a character visually still
    // positioned vertically on the rungs; holding the climbing pose mid-
    // reach reads as "gripping the ladder," which is what's actually
    // happening. "Proper animation integration" applies here as much as
    // to the climbing motion itself.
    return "ladderClimb";
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
  /** "The surrounding world should feel just as thoughtfully designed as
   *  the Workshop itself" — walking across sculpted terrain needed to
   *  feel as solid as walking across a Builder-built floor. The base
   *  height is now `TerrainSystem.getHeightAt()` (bilinearly
   *  interpolated — smooth footing on a slope, not a staircase of flat
   *  triangles) wherever the terrain patch actually covers this point;
   *  `null` outside it (or with no TerrainSystem registered at all) falls
   *  back to the flat `0` this always used, unchanged. Standing on top of
   *  a Builder object placed *on* the terrain still works exactly as
   *  before — the footprint loop below simply compares against whichever
   *  base height won. */
  _computeGroundHeight(x, z) {
    let best = this._terrainSystem?.getHeightAt(x, z) ?? 0;
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
    const doorBox = this._roomSystem?.getDoorCollider?.();
    if (doorBox) this._pushOutOfBox(next, doorBox);
    for (const footprint of this._furnitureSystem?.getFootprints?.() ?? []) {
      this._pushOutOfBox(next, footprint);
    }
    for (const footprint of this._worldObjectsSystem?.getFootprints?.() ?? []) {
      this._pushOutOfBox(next, footprint, { respectHeight: true });
    }
  }

  /** Circle-vs-AABB push-out, shared by wall and furniture collision — walls
   *  are no longer a hard rectangular clamp; they're just more boxes, with
   *  real gaps left at the door and windows (see WorkshopRoom.js). That's
   *  what makes walking outside possible at all.
   *
   *  Version 3, Phase 5 ("Beyond One Building") — "a cube can be walked up
   *  to then stopped by box collisions, but the collisions go up
   *  vertically forever... climbing a ladder in front of a cube doesn't
   *  let you fall on top of it." Confirmed directly: this function never
   *  once looked at Y, for any box — every collider behaved like an
   *  infinite column regardless of the player's own height, which also
   *  meant jumping onto a low object was silently broken the same way,
   *  not just the ladder case. `respectHeight` (set only for
   *  `WorldObjectsSystem`'s own footprints below — real, variable-height
   *  geometry, unlike the Workshop's own walls or furniture's fixed
   *  0-2.2m column, both deliberately permanent full-height boundaries
   *  that should never stop blocking) skips the horizontal push entirely
   *  once the player is already standing at or above the box's own top,
   *  using the exact same `STEP_TOLERANCE` threshold
   *  `_computeGroundHeight()` already uses to decide "close enough to
   *  step onto" — the two now can never disagree, so there's no gap
   *  where the player is blocked sideways by something they could
   *  already legitimately be standing on. The mirror case (fully
   *  underneath a raised object) is the same "real geometry, but never
   *  an obstacle you can't actually reach" principle
   *  `WorldObjectsSystem._updateFootprint()`'s own `COLLISION_HEIGHT_LIMIT`
   *  check already applies to anything entirely above head height —
   *  applied here per-box instead of only at the "never collides at
   *  all" extreme. */
  _pushOutOfBox(next, box, { respectHeight = false } = {}) {
    if (respectHeight) {
      if (this._footY >= box.max.y - STEP_TOLERANCE) return; // already standing at/above its top
      if (this._footY + PLAYER_HEIGHT <= box.min.y) return; // fully clear underneath it
    }
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

  /** Version 3, Phase 12 ("Accessibility & Comfort Pass") — this is the
   *  one shared camera transition every "sit down" interaction in the
   *  Workshop routes through (Computer, Workbench, Reading Chair alike
   *  all just call `enterFocus()`/`exitFocus()`), so it's also the
   *  single highest-leverage place to honour `prefers-reduced-motion`:
   *  jumping straight to `_focusT = 1` collapses the 0.6s position/yaw/
   *  pitch ease into the exact same final camera state, just without the
   *  animated repositioning along the way — a big, sometimes-vertical,
   *  sometimes-rotating camera move being exactly the kind of motion
   *  this preference exists to avoid. */
  _updateFocus(dt) {
    this._focusT = prefersReducedMotion() ? 1 : Math.min(1, this._focusT + dt / 0.6);
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

    // "Mouse look should remain available" (the Quiet Corner) vs. the
    // Computer/Workbench's own fully-fixed camera, sitting in front of a
    // screen where looking away would make no sense — the one thing that
    // differs between them. Once the seating-down ease finishes, a focus
    // pose that opts in (`allowLookAround: true`) hands yaw/pitch back to
    // ordinary mouse input, exactly like `_updateWalk()`'s own handling,
    // while position stays locked to `_focusPose.position` forever after
    // — "walking should remain disabled until standing normally" is true
    // by construction, since nothing here ever moves `this.position`
    // again once seated.
    if (this._focusPose.allowLookAround && this._focusT >= 1) {
      const input = this.engine.input;
      if (input?.lookActive && !this._lookPaused) {
        this.yaw -= input.lookDelta.x * LOOK_SENSITIVITY;
        this.pitch -= input.lookDelta.y * LOOK_SENSITIVITY;
        this.pitch = clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
        this.yaw = wrapAngle(this.yaw);
      }
      return;
    }

    this.yaw = shortestAngleLerp(this._focusFrom.yaw, targetYaw, t);
    this.pitch = THREE.MathUtils.lerp(this._focusFrom.pitch, targetPitch, t);
  }

  _applyImmediate() {
    this.engine.camera.position.copy(this.position);
    this.engine.camera.rotation.set(this.pitch, this.yaw + this._headYawOffset, 0, "YXZ");
  }
}
