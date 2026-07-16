import { applyPose } from "./PlayerCharacter.js";
import { MOVEMENT_STATE_TO_CLIP_ID } from "./AnimationClips.js";
import { advanceFrame, computeBlendedPose, ClipPlayer } from "./AnimationPlayback.js";
import { mergePoses, JOINT_GROUPS } from "./AnimationLayers.js";

/**
 * PlayerAnimationSystem
 * ------------------------
 * "The movement controller should simply request animations from the
 * Animation System. Please avoid tightly coupling animation logic
 * directly into the movement controller." That request is exactly one
 * method, `setMovementState(state)` — CameraSystem calls it every frame
 * with a plain string ("idle"/"walk"/"run"/"jump"/"fall"/"land"/"crouch"/
 * "ladderClimb") and knows nothing else about animation at all: not a
 * clip id, not a pose, not how playback or blending works. This system
 * owns the entire mapping from state to clip (`MOVEMENT_STATE_TO_CLIP_ID`
 * in AnimationClips.js) and everything downstream of it.
 *
 * **Two playback sources, one clear priority.** Movement state drives
 * playback by default. The Emote Wheel (or anything else later — a
 * chair, a Builder object, a future AI Resident; see this class's own
 * `play()`) can request a *specific* clip via `play(clipId)`, which takes
 * over as an override until either it finishes (non-looping) or genuine
 * movement interrupts it (walking cancels an emote — "looping animations
 * should continue until interrupted by player movement or another
 * animation"). `setMovementState()` itself is what does the interrupting:
 * it clears any active override whenever the *new* state represents
 * actual movement (anything other than idle), so playing an emote while
 * standing still, then walking away, naturally hands control back.
 *
 * **Frame advancement and pose blending** live in `AnimationPlayback.js`
 * as of the Advanced Animation phase — pure functions this class calls
 * rather than its own private math, so `BeingController.js` (this
 * phase's own new consumer) plays a clip identically without
 * reimplementing it. Interpolation itself is still plain linear
 * interpolation of Euler angles between a clip's two nearest frames, not
 * quaternion slerp — a deliberate simplification that holds up fine for
 * the modest rotation ranges ordinary locomotion and gestures actually
 * need. "Favour believable over physically perfect."
 *
 * **Animation Events, new this phase.** Any event a played clip's own
 * frames carry is emitted on `engine.events` as `"animation:event"` —
 * see this file's own `update()`.
 *
 * This system works identically regardless of which body model is
 * active — it only ever asks `PlayerCharacterSystem.getPivots()` for
 * *whichever* rig currently exists and applies rotations by pivot name;
 * nothing here has ever seen `BodyModels.js` and doesn't need to.
 */
export class PlayerAnimationSystem {
  constructor({ characterSystem, libraryStore }) {
    // Constructor-injected, not resolved via engine.getSystem() in init()
    // like most cross-system references in this project — CameraSystem
    // already needs to look *this* system up (to hand it a movement
    // state), and PlayerCharacterSystem needs CameraSystem, so resolving
    // this one via getSystem() too would create a genuine three-way
    // circular import between the three files. main.js already
    // constructs and wires all three together directly; passing the
    // reference straight through avoids the cycle entirely.
    this.characterSystem = characterSystem;
    this.libraryStore = libraryStore;
    this._movementState = "idle";
    this._activeClip = null;
    this._activeClipId = null;
    this._frameIndex = 0;
    this._frameT = 0;
    this._overriding = false; // true while an explicitly-requested (emote) clip is in control
    // "Procedural Animation Layers... walking while waving." A second,
    // independent ClipPlayer, restricted to a joint subset — see
    // playOverlay()/stopOverlay() below and AnimationLayers.js's own
    // comment. `null` whenever nothing is layered, which is most of the
    // time — this never affects ordinary playback until something
    // explicitly requests it.
    this._overlayClipPlayer = null;
    this._overlayJointNames = null;
  }

  init(engine) {
    this.engine = engine;
    this._playClipForState("idle");
  }

  /** Called every frame by CameraSystem — the entire movement->animation
   *  contract. Only actually changes what's playing if a) nothing is
   *  overriding playback right now, or b) the new state represents real
   *  movement, which always takes priority over an emote in progress. */
  setMovementState(state) {
    this._movementState = state;
    if (this._overriding && state !== "idle") {
      // Genuine movement interrupts whatever emote was playing.
      this._overriding = false;
    }
    if (this._overriding) return;
    this._playClipForState(state); // a no-op if this clip is already the one playing — see _setActiveClip
  }

  /** The Emote Wheel's own entry point (and, per the brief's own modular
   *  intent, anything else that wants to request a specific animation
   *  later — a chair, a Builder object, a future AI Resident): plays
   *  `clipId` regardless of movement state until it finishes or genuine
   *  movement interrupts it. Unknown ids are silently ignored rather than
   *  throwing — a stale reference to a since-deleted custom clip
   *  shouldn't be able to break playback. */
  play(clipId) {
    const clip = this.libraryStore.getClip(clipId);
    if (!clip) return;
    this._overriding = true;
    this._setActiveClip(clip);
  }

  /** Cancels any emote override immediately, returning to whatever
   *  movement currently calls for — used by the Emote Wheel's own "stop"
   *  affordance, if a person wants to cut a looping emote short. */
  stopOverride() {
    if (!this._overriding) return;
    this._overriding = false;
    this._playClipForState(this._movementState);
  }

  get isOverriding() {
    return this._overriding;
  }

  /** "Walking while waving, walking while carrying" — plays `clipId`
   *  layered *on top of* whatever's already playing (movement state or
   *  an override), restricted to `jointGroupName`'s own joints
   *  (`AnimationLayers.JOINT_GROUPS` — `"upperBody"` by default, since
   *  that's the brief's own most common example). The base layer
   *  (movement/override) keeps running completely unaffected — this
   *  never replaces it, only overrides a subset of its joints each
   *  frame. Calling this again with a different clip simply switches
   *  which one is layered; `stopOverlay()` removes it entirely, letting
   *  the base layer's own pose show through on every joint again. */
  playOverlay(clipId, jointGroupName = "upperBody") {
    const clip = this.libraryStore.getClip(clipId);
    if (!clip) return;
    if (!this._overlayClipPlayer) this._overlayClipPlayer = new ClipPlayer();
    this._overlayClipPlayer.setClip(clip);
    this._overlayJointNames = JOINT_GROUPS[jointGroupName] ?? JOINT_GROUPS.upperBody;
  }

  stopOverlay() {
    this._overlayClipPlayer = null;
    this._overlayJointNames = null;
  }

  _playClipForState(state) {
    const clipId = MOVEMENT_STATE_TO_CLIP_ID[state] ?? MOVEMENT_STATE_TO_CLIP_ID.idle;
    const clip = this.libraryStore.getClip(clipId);
    if (clip) this._setActiveClip(clip);
  }

  _setActiveClip(clip) {
    if (this._activeClipId === clip.id) return; // already playing this one — don't restart it from frame 0 every single tick
    this._activeClip = clip;
    this._activeClipId = clip.id;
    this._frameIndex = 0;
    this._frameT = 0;
  }

  /** "Animations should be capable of triggering Workshop behaviours" —
   *  events collected by `advanceFrame()` (see `AnimationPlayback.js`)
   *  are emitted here, on the engine's own `EventBus`, as
   *  `"animation:event"` with `{source: "player", clipId, type, data}` —
   *  the one place any system (a footstep-sound listener, a future
   *  particle system) can react to *any* clip's own events without
   *  needing to know which system is currently playing it. The overlay
   *  layer, if one is active, is advanced and blended in afterward (see
   *  `playOverlay()`'s own comment) — its own events are emitted
   *  identically, tagged `"player-overlay"` rather than `"player"` so a
   *  listener can tell which layer an event came from if it cares. */
  update(dt) {
    this._advance(dt);
    const pivots = this.characterSystem?.getPivots?.();
    if (!pivots || !this._activeClip) return;
    let pose = computeBlendedPose(this._activeClip, this._frameIndex, this._frameT);
    if (this._overlayClipPlayer) {
      const { pose: overlayPose, events } = this._overlayClipPlayer.advance(dt);
      for (const event of events) this.engine?.events.emit("animation:event", { source: "player-overlay", clipId: this._overlayClipPlayer.clip?.id, ...event });
      pose = mergePoses(pose, overlayPose, this._overlayJointNames);
    }
    applyPose(pivots, pose);
  }

  _advance(dt) {
    const clip = this._activeClip;
    if (!clip) return;
    const result = advanceFrame(clip, { frameIndex: this._frameIndex, frameT: this._frameT }, dt);
    this._frameIndex = result.frameIndex;
    this._frameT = result.frameT;
    for (const event of result.crossedEvents) this.engine?.events.emit("animation:event", { source: "player", clipId: clip.id, ...event });

    if (result.finished) {
      // A non-looping clip (Jump, Land, or a one-shot emote) has
      // finished — "the animation should play once before returning
      // naturally to the appropriate idle state." Hand control straight
      // back to whatever movement currently calls for; its own final
      // pose stays held for this one instant regardless (see
      // `computeBlendedPose()`'s own comment), same as before this
      // refactor.
      if (this._overriding) this._overriding = false;
      this._playClipForState(this._movementState);
    }
  }
}
