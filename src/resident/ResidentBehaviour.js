import { damp } from "../utils/MathUtils.js";

const AWARENESS_RADIUS = 3.2; // metres — inside this, the resident starts turning to look at the player
const AWARENESS_FULL_RADIUS = 1.6; // fully attentive within this distance

export const EXPRESSIONS = ["sleeping", "content", "curious", "happy", "thinking"];

/**
 * ResidentBehaviour
 * -------------------
 * "The resident should be aware of the player's presence... looking
 * towards the player when nearby, turning to face the player, watching
 * the player walk past." Rather than a combinatorial state machine
 * (idle-aware, idle-unaware, moving-aware, moving-unaware...),
 * `awarenessBlend` is a single smoothed 0-1 value — how much the
 * resident is currently oriented toward the player instead of its own
 * idle look-at target — that `ResidentRenderer.js` simply lerps between.
 * Walking past at a distance nudges it up and back down again on its
 * own, with no state transition anywhere to manage.
 *
 * `mode` ("idle" | "conversing") is the one real state distinction —
 * "if the player interacts with the resident: the resident should stop
 * moving, turn towards the player, maintain attention throughout the
 * conversation, after the conversation naturally return to its previous
 * behaviour." `ResidentController.js` is what actually stops
 * `ResidentMovement`'s own travel while conversing; this class only
 * tracks *that* it should, and forces `awarenessBlend` to its maximum the
 * entire time a conversation is open.
 *
 * **Three timescales, three separate fields, on purpose** — "please
 * distinguish between emotion, mood, and personality... these should
 * represent different timescales":
 *   - **Personality** (long-term) isn't tracked here at all — it lives on
 *     the profile itself (`ResidentTraits.js`'s selected traits), read,
 *     never mutated by anything at runtime.
 *   - **Mood** (medium-term) is `ResidentState.mood` — owned by
 *     `ResidentController.js`'s own slow mood-drift timer, persisted, and
 *     read by `computeExpression()` below as the *default* expression.
 *   - **Emotion** (short-term) is `this.emotion` — a brief, transient
 *     overlay set by `triggerEmotion()` (conversation start noticing
 *     something, say), decaying back to nothing on its own timer, never
 *     persisted. `computeExpression()`'s own priority order —
 *     sleeping > thinking > emotion > mood > "content" — is exactly
 *     "short-term overrides medium-term overrides long-term default."
 */
export class ResidentBehaviour {
  constructor() {
    this.mode = "idle"; // "idle" | "conversing"
    this.awarenessBlend = 0;
    this.isThinking = false; // true while waiting on a response during conversation
    this.emotion = null; // short-term only — see module comment above
    this._emotionTimer = 0;
  }

  startConversation() {
    this.mode = "conversing";
  }

  endConversation() {
    this.mode = "idle";
    this.isThinking = false;
  }

  setThinking(thinking) {
    this.isThinking = thinking;
  }

  /** A brief, short-term overlay on top of whatever the resident's medium-
   *  term mood currently is — "small changes should carry meaning," not a
   *  new permanent state. Decays back to nothing on its own after
   *  `seconds`; calling this again before it expires simply replaces it
   *  (the most recent trigger always wins, nothing stacks or queues). */
  triggerEmotion(expression, seconds = 6) {
    if (!EXPRESSIONS.includes(expression)) return;
    this.emotion = expression;
    this._emotionTimer = seconds;
  }

  /** `playerDistance` in metres, or `null` if the player's position isn't
   *  worth checking (e.g. a different room/floor entirely, if the
   *  Workshop ever has more than one). Smoothly eases `awarenessBlend`
   *  toward 1 inside `AWARENESS_RADIUS`, fully attentive inside
   *  `AWARENESS_FULL_RADIUS`, and back toward 0 outside it — "watching
   *  the player walk past" falls naturally out of this rising and
   *  falling as they pass through the radius, no separate "noticed you
   *  walking by" state needed. */
  update(dt, playerDistance) {
    if (this._emotionTimer > 0) {
      this._emotionTimer -= dt;
      if (this._emotionTimer <= 0) this.emotion = null;
    }

    if (this.mode === "conversing") {
      this.awarenessBlend = 1;
      return;
    }
    let target = 0;
    if (playerDistance !== null) {
      if (playerDistance <= AWARENESS_FULL_RADIUS) target = 1;
      else if (playerDistance <= AWARENESS_RADIUS) target = 1 - (playerDistance - AWARENESS_FULL_RADIUS) / (AWARENESS_RADIUS - AWARENESS_FULL_RADIUS);
    }
    this.awarenessBlend = damp(this.awarenessBlend, target, 3, dt);
  }

  /** "Sleeping" while offline overrides everything else — "glow becomes
   *  softer... expression becomes sleepy." Then thinking, then a short-
   *  term emotion if one's currently active, then mood — a resident
   *  mid-thought reads as thinking regardless of anything else
   *  underneath, but a resident that just noticed something interesting
   *  briefly shows that over its own steadier mood. */
  computeExpression(isAwake, mood) {
    if (!isAwake) return "sleeping";
    if (this.isThinking) return "thinking";
    if (this.emotion) return this.emotion;
    return EXPRESSIONS.includes(mood) ? mood : "content";
  }
}
