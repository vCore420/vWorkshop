import { lerp, clamp } from "../utils/MathUtils.js";

const MAX_FRAME_ADVANCE_STEPS = 12; // bounds the catch-up loop if dt is ever unusually large (a backgrounded tab resuming, say), rather than looping unbounded

/**
 * AnimationPlayback
 * -------------------
 * "Animation becomes a Workshop Asset... future systems should all
 * consume this same animation architecture." Before this phase, frame
 * advancement and pose blending both lived entirely inside
 * `PlayerAnimationSystem.js`'s own private methods — correct, but the
 * one and only place clip playback actually happened. This file pulls
 * the pure, state-free half of that out — "given a clip and where
 * playback currently is, where does it end up after `dt` seconds, and
 * what pose does that produce" — so `BeingController.js` (this phase's
 * own new consumer, see docs/ANIMATION.md) and a future Animation
 * Sandbox preview can play a clip identically without either
 * reimplementing this math or routing through `PlayerAnimationSystem`
 * itself, which has its own, unrelated concerns (movement-state
 * priority, emote overrides) no other consumer should need to know
 * about.
 *
 * `PlayerAnimationSystem.js` itself was refactored to call these same
 * functions rather than its own private copies — its own behaviour is
 * unchanged, verified against its previous implementation frame for
 * frame; only where the math lives moved.
 *
 * **Animation Events, new this phase.** "Animations should be capable of
 * triggering Workshop behaviours." A frame can carry an optional
 * `events: [{type, data}]` array; `advanceFrame()`'s own return value
 * includes every event attached to any frame playback crossed *this
 * call* (almost always zero or one, since frames are typically much
 * longer than a single tick) — a caller that cares (see
 * `PlayerAnimationSystem.update()`) emits them on its own `EventBus`;
 * one that doesn't (a Being with no listener registered) simply ignores
 * the returned array, at no cost.
 */

/** Pure — no side effects, no clock of its own. `state` is
 *  `{frameIndex, frameT}`; returns a new `{frameIndex, frameT, finished,
 *  crossedEvents}` rather than mutating `state` in place, so a caller
 *  can freely discard the result (e.g. a preview scrubbing the timeline
 *  by hand) without this function needing to know that happened.
 *  `finished` is true exactly once, the instant a non-looping clip's own
 *  final frame is reached — a caller (see `PlayerAnimationSystem`'s own
 *  `_advance()`) is expected to react to it once, not on every
 *  subsequent tick the clip continues holding that final pose. */
export function advanceFrame(clip, state, dt) {
  if (!clip || clip.frames.length === 0) return { ...state, finished: false, crossedEvents: [] };

  let frameIndex = state.frameIndex;
  let frameT = state.frameT;
  let remaining = dt * (clip.speed || 1);
  let steps = 0;
  const crossedEvents = [];

  while (steps < MAX_FRAME_ADVANCE_STEPS) {
    const frame = clip.frames[frameIndex];
    const frameDuration = Math.max(frame.duration, 0.001); // never divide by/loop on a zero-duration frame
    const budget = frameDuration - frameT;
    if (remaining < budget) {
      frameT += remaining;
      return { frameIndex, frameT, finished: false, crossedEvents };
    }
    remaining -= budget;
    const atLastFrame = frameIndex >= clip.frames.length - 1;
    if (atLastFrame) {
      if (clip.loop) {
        frameIndex = 0;
        frameT = 0;
        crossedEvents.push(...(clip.frames[0]?.events ?? []));
      } else {
        // A non-looping clip has finished — hold its final pose for this
        // instant; the caller decides what happens next (see this
        // function's own comment on `finished`).
        return { frameIndex, frameT: frameDuration, finished: true, crossedEvents };
      }
    } else {
      frameIndex++;
      frameT = 0;
      crossedEvents.push(...(clip.frames[frameIndex]?.events ?? []));
    }
    steps++;
  }
  return { frameIndex, frameT, finished: false, crossedEvents };
}

/** Pure — linear interpolation of Euler angles between a clip's two
 *  nearest frames, exactly the simplification
 *  `PlayerAnimationSystem.js`'s own original comment already justified
 *  ("favour believable over physically perfect"), now shared rather
 *  than reimplemented per consumer. A pivot/joint neither frame mentions
 *  is simply omitted from the result — every consumer's own "apply"
 *  step (`applyPose()` for the Player rig, `applyPoseToMappedSkeleton()`
 *  for a retargeted skeleton — see `AnimationRetargeting.js`) is
 *  responsible for resetting anything omitted to rest, not this
 *  function. */
export function computeBlendedPose(clip, frameIndex, frameT) {
  const frame = clip.frames[frameIndex];
  if (!clip.loop && frameIndex === clip.frames.length - 1) return frame.pose; // final frame of a one-shot clip — hold it, nothing to blend toward

  const nextIndex = (frameIndex + 1) % clip.frames.length;
  const nextFrame = clip.frames[nextIndex];
  const t = clamp(frameT / Math.max(frame.duration, 0.001), 0, 1);

  const blended = {};
  const names = new Set([...Object.keys(frame.pose), ...Object.keys(nextFrame.pose)]);
  for (const name of names) {
    const a = frame.pose[name] ?? [0, 0, 0];
    const b = nextFrame.pose[name] ?? [0, 0, 0];
    blended[name] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  return blended;
}

/**
 * ClipPlayer
 * ------------
 * A small, stateful convenience wrapper around the two pure functions
 * above, for a consumer (`BeingController.js`, a future Sandbox) that
 * just wants "play this clip, give me the current pose every frame,"
 * without wanting to manage `frameIndex`/`frameT` by hand the way
 * `PlayerAnimationSystem.js` still does for its own, more involved
 * movement-state/override logic. Deliberately has no concept of
 * "movement state" or "overriding" at all — those stay
 * `PlayerAnimationSystem`'s own concern.
 */
export class ClipPlayer {
  constructor() {
    this._clip = null;
    this._frameIndex = 0;
    this._frameT = 0;
  }

  get clip() {
    return this._clip;
  }

  /** Switching to a clip already playing is a no-op — restarting a clip
   *  from frame 0 every time this is called with the same id (once per
   *  frame, from a caller that recomputes "which clip should be playing"
   *  every tick, say) would make it look like it never actually plays. */
  setClip(clip) {
    if (this._clip?.id === clip?.id) return;
    this._clip = clip ?? null;
    this._frameIndex = 0;
    this._frameT = 0;
  }

  /** Advances playback and returns `{pose, events}` — `events` is
   *  whatever `advanceFrame()` collected this call, forwarded as-is for
   *  the caller to emit on its own `EventBus` if it cares (see this
   *  file's own module comment). A finished non-looping clip simply
   *  keeps holding its final pose; unlike `PlayerAnimationSystem`, this
   *  class has no "what plays next" concept to hand control back to —
   *  that decision belongs to whichever system chose the clip in the
   *  first place (`BeingController.js` re-picks idle/walk every frame
   *  based on `instance.currentState`, so this never needs to). */
  advance(dt) {
    if (!this._clip) return { pose: {}, events: [] };
    const result = advanceFrame(this._clip, { frameIndex: this._frameIndex, frameT: this._frameT }, dt);
    this._frameIndex = result.frameIndex;
    this._frameT = result.frameT;
    return { pose: computeBlendedPose(this._clip, this._frameIndex, this._frameT), events: result.crossedEvents };
  }
}
