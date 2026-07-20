import { BEHAVIOUR_DIALS } from "../ai/BehaviourDialsConfiguration.js";
import { clamp } from "../utils/MathUtils.js";

/**
 * ResidentDials
 * ---------------
 * "Curiosity, Talkativeness, Playfulness, Energy, Independence,
 * Reflection, Calmness... these should influence movement, conversations
 * and general behaviour. Please favour subtle changes over dramatic
 * differences." Mirrors `ResidentTraits.js`'s own shape exactly —
 * `getDialModifiers(dials)` is a pure function returning the same
 * modifier object `ResidentTraits.mergeModifiers()` already knows how to
 * combine, so `ResidentController` never needs to know whether a given
 * multiplier came from a selected trait or a dial.
 *
 * Every dial is 0-1, neutral at 0.5 — only the *deviation* from neutral
 * (`d = value - 0.5`, range -0.5..0.5) ever produces an effect, and every
 * effect stays small (see each dial's own comment for its actual
 * multiplier range) — "subtle changes... not dramatic differences" is a
 * hard constraint here, not a suggestion.
 */

function deviation(dials, id) {
  return (dials?.[id] ?? 0.5) - 0.5; // -0.5..0.5
}

export function getDialModifiers(dials) {
  const curiosity = deviation(dials, "curiosity");
  const talkativeness = deviation(dials, "talkativeness");
  const playfulness = deviation(dials, "playfulness");
  const energy = deviation(dials, "energy");
  const independence = deviation(dials, "independence");
  const reflection = deviation(dials, "reflection");
  const calmness = deviation(dials, "calmness");

  const locationWeights = {};
  const expressionBias = {};
  const bumpLocation = (id, amount) => {
    locationWeights[id] = (locationWeights[id] ?? 1) * amount;
  };
  const bumpExpression = (id, amount) => {
    expressionBias[id] = (expressionBias[id] ?? 1) * amount;
  };

  // Curiosity: drawn to the window, a little more likely to read as
  // "curious" at rest. Range roughly ±30% at the extremes.
  if (curiosity !== 0) {
    bumpLocation("lookingOutWindow", 1 + curiosity * 0.6);
    bumpExpression("curious", 1 + curiosity * 0.8);
  }
  // Playfulness: happier, a touch more curious, moves on a little sooner.
  if (playfulness !== 0) {
    bumpExpression("happy", 1 + playfulness * 0.7);
    bumpExpression("curious", 1 + playfulness * 0.3);
  }
  // Workshop Personality phase — "excited" joins the resting-mood
  // candidates (see ResidentController.js's own MOOD_CANDIDATES), but
  // only ever becomes genuinely likely when *both* Playfulness and
  // Energy lean high together — a playful-but-low-energy resident stays
  // "happy," not "excited"; energy alone, with ordinary playfulness,
  // isn't enough either. Multiplying the two deviations (rather than
  // adding them) is what enforces "both," not "either" — either alone
  // near zero keeps the product near zero.
  if (playfulness > 0 && energy > 0) {
    bumpExpression("excited", 1 + playfulness * energy * 3);
  }
  // Reflection: reads as thoughtful/curious, lingers longer.
  if (reflection !== 0) {
    bumpExpression("thinking", 1 + Math.max(0, reflection) * 0.5); // only a *reflective* resident leans thinking; the low end doesn't lean "unreflective" toward anything specific
    bumpLocation("nearBookshelf", 1 + Math.max(0, reflection) * 0.4);
  }

  // Energy: shorter rests and a genuinely quicker travel pace at the
  // high end; the low end settles in for longer and moves unhurriedly.
  const restFromEnergy = 1 - energy * 0.5; // high energy -> shorter rests (down to ~0.75x), low energy -> longer (up to ~1.25x)
  const restFromCalmness = 1 + calmness * 0.5; // calm -> longer rests too, same direction as low energy
  const restFromReflection = 1 + Math.max(0, reflection) * 0.3; // a reflective resident lingers a little longer wherever it is

  const movementSpeedMultiplier = 1 + energy * 0.4; // ±20% travel/step speed
  const motionDamping = 1 - calmness * 0.5; // a calmer resident's bob/sway settles down, never fully stops

  // Independence: less pulled toward a favourite spot, slower to turn
  // fully toward the player (reads as self-possessed, not aloof).
  const favouriteLocationPullMultiplier = 1 - Math.max(0, independence) * 0.4;
  const awarenessFromIndependence = 1 - independence * 0.3; // independent -> smaller effective radius; the opposite (low independence, i.e. "attentive") -> a touch larger
  const awarenessFromTalkativeness = 1 + Math.max(0, talkativeness) * 0.2; // a talkative resident notices someone nearby a little sooner, ready for a conversation

  const styleBits = [];
  if (talkativeness > 0.15) styleBits.push("You tend to be talkative, offering fuller answers rather than short ones.");
  else if (talkativeness < -0.15) styleBits.push("You tend to be reserved, keeping answers brief and unhurried.");
  if (playfulness > 0.15) styleBits.push("A playful, light touch comes through even in ordinary conversation.");
  if (reflection > 0.15) styleBits.push("You tend to pause and consider before answering, rather than responding instantly.");
  if (calmness > 0.2) styleBits.push("Your tone stays calm and unhurried, even about exciting things.");
  if (energy > 0.2) styleBits.push("You bring a noticeably energetic, quick-paced tone to conversation.");

  return {
    restDurationMultiplier: clamp01to2(restFromEnergy * restFromCalmness * restFromReflection),
    awarenessRadiusMultiplier: clamp01to2(awarenessFromIndependence * awarenessFromTalkativeness),
    locationWeights,
    expressionBias,
    movementSpeedMultiplier: clamp01to2(movementSpeedMultiplier),
    motionDamping: Math.max(0.3, motionDamping),
    favouriteLocationPullMultiplier: Math.max(0.3, favouriteLocationPullMultiplier),
    conversationStyleLine: styleBits.length ? styleBits.join(" ") : null,
  };
}

function clamp01to2(value) {
  return clamp(value, 0.4, 2);
}

export { BEHAVIOUR_DIALS };
