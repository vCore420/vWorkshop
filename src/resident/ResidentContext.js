import { traitPersonalityLine, getTraitModifiers, mergeModifiers } from "./ResidentTraits.js";
import { getDialModifiers } from "./ResidentDials.js";
import { getIdleLocation } from "./ResidentMovement.js";
import { WEATHER_STATES } from "../systems/EnvironmentSystem.js";

const ACTIVITY_LABELS = {
  listeningToMusic: "listening to music",
  watchingRain: "watching the rain",
  watchingTheSky: "watching the sky",
};

/**
 * ResidentContext
 * -----------------
 * "Every major Mission Control setting now has a meaningful effect
 * within Bubble" needed the exact same context-building logic in two
 * places this phase: the real conversation overlay
 * (`ResidentConversation.js`) and the new Resident Sandbox (`AIApp.js`,
 * see its own "Resident Sandbox" section) — a second real consumer was
 * reason enough to pull this out of `ResidentConversation.js` (where it
 * lived alone last phase) into its own file, rather than the sandbox
 * quietly growing a second, slightly different copy.
 *
 * `getPersonalityModifiers(profile)` combines both personality sources —
 * discrete traits (`ResidentTraits.getTraitModifiers()`) and the
 * continuous behaviour dials (`ResidentDials.getDialModifiers()`) — into
 * the one modifier object `ResidentController.js` actually applies to
 * movement/awareness/expression. `buildConversationContext()` is the
 * system-prompt-facing counterpart: personality (now both traits *and*
 * dials, combined into one line), accumulated preferences (gated by
 * Memory's own category toggles), curiosity notes, and remembered
 * things about the player.
 */

export function getPersonalityModifiers(profile) {
  return mergeModifiers(getTraitModifiers(profile?.traits), getDialModifiers(profile?.behaviourConfig?.dials));
}

function buildPersonalityLine(profile) {
  const traitLine = traitPersonalityLine(profile?.traits);
  const dialLine = getDialModifiers(profile?.behaviourConfig?.dials).conversationStyleLine;
  const combined = [traitLine, dialLine].filter(Boolean).join(" ");
  return combined || null;
}

function buildPreferenceLine(profile, { residentPreferences }) {
  if (!residentPreferences) return null;
  const categories = profile?.memory?.categories;
  const bits = [];
  if (categories?.places !== false) {
    const locationId = residentPreferences.favourite("locations");
    if (locationId) bits.push(`spending time ${getIdleLocation(locationId).label}`);
  }
  if (categories?.activities !== false) {
    const weatherId = residentPreferences.favourite("weather");
    if (weatherId) bits.push(`${(WEATHER_STATES[weatherId]?.label ?? weatherId).toLowerCase()} weather`);
    const timeOfDay = residentPreferences.favourite("timeOfDay");
    if (timeOfDay) bits.push(`the ${timeOfDay}`);
    const activity = residentPreferences.favourite("activities");
    if (activity) bits.push(ACTIVITY_LABELS[activity] ?? activity);
  }
  if (bits.length === 0) return null;
  return `Over time, you've noticed you especially enjoy ${bits.join(", ")}.`;
}

/** Everything `PromptComposer.composeSystemPrompt()`'s own optional
 *  `context` argument accepts, gathered from wherever it actually lives.
 *  `mutateCuriosity` (default `true`) is the one option the Sandbox uses
 *  differently — see `ResidentCuriosity.gatherNotes()`'s own comment on
 *  why a sandbox preview must never consume the real "something new was
 *  built" note. */
export function buildConversationContext(profile, deps, { mutateCuriosity = true } = {}) {
  const { residentCuriosity, residentPreferences, playerPatternMemory, conversationMemory, worldObjectsStore, environmentSystem, timeOfDaySystem } = deps;
  const curiosityNotes = residentCuriosity
    ? residentCuriosity.gatherNotes({ worldObjectsStore, environmentSystem, timeOfDaySystem, residentPreferences, playerPatternMemory, mutate: mutateCuriosity })
    : [];
  const memoryEnabled = profile?.memory?.mode !== "disabled";
  return {
    personalityLine: buildPersonalityLine(profile),
    preferenceLine: buildPreferenceLine(profile, { residentPreferences }),
    curiosityNotes,
    memoryNotes: memoryEnabled ? conversationMemory?.mostRelevant() ?? [] : [],
  };
}
