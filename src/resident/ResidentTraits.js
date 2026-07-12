import { PERSONALITY_TRAITS, traitLabel } from "../ai/TraitConfiguration.js";

/**
 * ResidentTraits
 * ----------------
 * "Identity should influence many existing systems without replacing
 * them... movement, idle behaviour, conversation style, preferred
 * locations, general behaviour." Rather than every one of those systems
 * learning what "curious" means for itself, this is the one place a
 * selected trait id becomes a small, concrete number — a rest-duration
 * multiplier, an awareness-radius multiplier, an idle-location weight
 * bias, a short prompt fragment. Everything downstream (`ResidentMovement`,
 * `ResidentController`, `PromptComposer` via `ResidentConversation`) reads
 * a plain modifier object; nothing outside this file needs to know which
 * trait produced it.
 *
 * "Subtle behaviour changes are preferable to obvious state changes" is
 * the reason every multiplier below stays close to 1 (roughly ±25-35%) —
 * a resident with every trait selected should read as a little more of
 * itself, never as a mechanically different creature.
 *
 * A pure function, `getTraitModifiers(traitsConfig)`, deliberately mirrors
 * `PromptComposer.composeSystemPrompt(profile)` — no class, no state, the
 * same input always produces the same output, callable from anywhere
 * (`ResidentController`, `AIApp.js`'s own future previews) without
 * constructing anything first.
 */

const TRAIT_MODIFIERS = {
  curious: {
    restDurationMultiplier: 0.8, // moves on to somewhere new a little sooner
    awarenessRadiusMultiplier: 1.15, // notices the player from a touch further away
    locationWeights: { lookingOutWindow: 1.6 }, // drawn to whatever's visible outside
    expressionBias: { curious: 1.4 },
  },
  calm: {
    restDurationMultiplier: 1.3, // settles in and stays a while longer
    awarenessRadiusMultiplier: 0.9,
    locationWeights: { besideQuietCorner: 1.4 },
    expressionBias: { content: 1.3 },
  },
  cheerful: {
    restDurationMultiplier: 0.95,
    awarenessRadiusMultiplier: 1.2, // quicker to turn toward someone nearby
    locationWeights: {},
    expressionBias: { happy: 1.6 },
  },
  quiet: {
    restDurationMultiplier: 1.35, // the least restless of the six
    awarenessRadiusMultiplier: 0.75, // comfortable keeping its distance
    locationWeights: { nearBookshelf: 1.3, besideQuietCorner: 1.2 },
    expressionBias: { content: 1.2 },
  },
  thoughtful: {
    restDurationMultiplier: 1.15,
    awarenessRadiusMultiplier: 1,
    locationWeights: { aboveWorkbench: 1.3, nearBookshelf: 1.2 },
    expressionBias: { thinking: 1.3, curious: 1.15 },
  },
  playful: {
    restDurationMultiplier: 0.75, // the most restless of the six
    awarenessRadiusMultiplier: 1.1,
    locationWeights: { byMusicPlayer: 1.3 },
    expressionBias: { happy: 1.3, curious: 1.2 },
  },
};

/** Combines every selected trait's own modifier into one plain object.
 *  Multipliers *average* across selected traits rather than compounding
 *  (two traits shouldn't produce a resident four times as restless as
 *  one would) — location weights and expression biases instead *combine*
 *  (multiplying together), since those are meant to stack: a resident
 *  that's both "curious" and "quiet" plausibly favours both the window
 *  and the bookshelf, more than either trait alone would. No selection
 *  at all returns every multiplier at a neutral 1 and no bias — an
 *  unconfigured resident behaves exactly as it always has. */
export function getTraitModifiers(traitsConfig) {
  const selected = traitsConfig?.selected ?? [];
  if (selected.length === 0) {
    return { restDurationMultiplier: 1, awarenessRadiusMultiplier: 1, locationWeights: {}, expressionBias: {} };
  }

  let restSum = 0;
  let awarenessSum = 0;
  const locationWeights = {};
  const expressionBias = {};

  for (const id of selected) {
    const mod = TRAIT_MODIFIERS[id];
    if (!mod) continue;
    restSum += mod.restDurationMultiplier;
    awarenessSum += mod.awarenessRadiusMultiplier;
    for (const [locId, weight] of Object.entries(mod.locationWeights)) {
      locationWeights[locId] = (locationWeights[locId] ?? 1) * weight;
    }
    for (const [expr, weight] of Object.entries(mod.expressionBias)) {
      expressionBias[expr] = (expressionBias[expr] ?? 1) * weight;
    }
  }

  return {
    restDurationMultiplier: restSum / selected.length,
    awarenessRadiusMultiplier: awarenessSum / selected.length,
    locationWeights,
    expressionBias,
  };
}

/** A short, honest prose fragment describing the selected traits for
 *  `PromptComposer.composeSystemPrompt()`'s own context section — plain
 *  labels, not the numeric modifiers above, since a language model has no
 *  use for a multiplier but every use for "you tend to be curious and
 *  calm." Returns `null` when nothing is selected, so the composer can
 *  skip the line entirely rather than emitting an empty one. */
export function traitPersonalityLine(traitsConfig) {
  const selected = traitsConfig?.selected ?? [];
  if (selected.length === 0) return null;
  const labels = selected.map((id) => traitLabel(id).toLowerCase());
  return `Your temperament leans ${labels.join(" and ")}.`;
}

export { PERSONALITY_TRAITS };
