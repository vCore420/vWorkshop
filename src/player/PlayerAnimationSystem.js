import { applyPose } from "./PlayerCharacter.js";
import { lerp, clamp } from "../utils/MathUtils.js";
import { MOVEMENT_STATE_TO_CLIP_ID } from "./AnimationClips.js";

const MAX_FRAME_ADVANCE_STEPS = 12; // bounds the catch-up loop below if dt is ever unusually large (a backgrounded tab resuming, say), rather than looping unbounded

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
 * **Interpolation** is plain linear interpolation of Euler angles between
 * a clip's two nearest frames, not quaternion slerp — a deliberate
 * simplification (see AnimationClips.js's own note) that holds up fine
 * for the modest rotation ranges ordinary locomotion and gestures
 * actually need, in exchange for authoring and reasoning about poses as
 * plain per-axis numbers rather than a heavier rotation representation.
 * "Favour believable over physically perfect."
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

  update(dt) {
    this._advance(dt);
    const pivots = this.characterSystem?.getPivots?.();
    if (!pivots || !this._activeClip) return;
    applyPose(pivots, this._computePose());
  }

  _advance(dt) {
    const clip = this._activeClip;
    if (!clip || clip.frames.length === 0) return;
    let remaining = dt * (clip.speed || 1);
    let steps = 0;

    while (steps < MAX_FRAME_ADVANCE_STEPS) {
      const frame = clip.frames[this._frameIndex];
      const frameDuration = Math.max(frame.duration, 0.001); // never divide by/loop on a zero-duration frame
      const budget = frameDuration - this._frameT;
      if (remaining < budget) {
        this._frameT += remaining;
        return;
      }
      remaining -= budget;
      const atLastFrame = this._frameIndex >= clip.frames.length - 1;
      if (atLastFrame) {
        if (clip.loop) {
          this._frameIndex = 0;
          this._frameT = 0;
        } else {
          // A non-looping clip (Jump, Land, or a one-shot emote) has
          // finished — "the animation should play once before returning
          // naturally to the appropriate idle state." Hold its final
          // pose for this instant, then hand control straight back to
          // whatever movement currently calls for.
          this._frameT = frameDuration;
          if (this._overriding) this._overriding = false;
          this._playClipForState(this._movementState);
          return;
        }
      } else {
        this._frameIndex++;
        this._frameT = 0;
      }
      steps++;
    }
  }

  /** Linearly interpolates between the current frame's pose and the
   *  next's, based on how far through the current frame playback is. A
   *  pivot neither frame mentions is simply omitted — `applyPose()`
   *  itself resets anything omitted to rest rotation, so there's no need
   *  to compute a redundant zero here. */
  _computePose() {
    const clip = this._activeClip;
    const frame = clip.frames[this._frameIndex];
    if (!clip.loop && this._frameIndex === clip.frames.length - 1) return frame.pose; // final frame of a one-shot clip — hold it, nothing to blend toward

    const nextIndex = (this._frameIndex + 1) % clip.frames.length;
    const nextFrame = clip.frames[nextIndex];
    const t = clamp(this._frameT / Math.max(frame.duration, 0.001), 0, 1);

    const blended = {};
    const names = new Set([...Object.keys(frame.pose), ...Object.keys(nextFrame.pose)]);
    for (const name of names) {
      const a = frame.pose[name] ?? [0, 0, 0];
      const b = nextFrame.pose[name] ?? [0, 0, 0];
      blended[name] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
    return blended;
  }
}
