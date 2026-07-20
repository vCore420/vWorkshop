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
 * Memory's own category toggles), curiosity notes, remembered things
 * about the player, and (Version 3, Phase 8b) a short line of real,
 * current Workshop knowledge from `WorldAwareness` — see
 * `buildWorldKnowledgeLine()` below.
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

/** Version 3, Phase 8b ("Bubble Gains Hands") — "Bubble should be allowed
 *  access to basic workshop knowledge too... believe it's the one true
 *  source of a world." `WorldAwareness.snapshot()` already existed
 *  (Version 3, Phase 6) and was already wired to `ResidentController`,
 *  but nothing ever actually read it into a conversation — this is that
 *  wiring, not a new knowledge source. Deliberately short and selective
 *  rather than dumping the whole snapshot into the prompt — a handful of
 *  concrete, current facts, the same "three perfect touches over thirty"
 *  restraint Phase 6's own risk note already named. Distinct from
 *  Workshop Functions (`WorkshopFunctions.js`): this is what Bubble
 *  *knows* without asking; a Function is something Bubble *does*. */
function buildWorldKnowledgeLine(worldAwareness) {
  if (!worldAwareness) return null;
  const snap = worldAwareness.snapshot();
  const bits = [`it's currently ${snap.time.bucket}`, `the weather is ${(WEATHER_STATES[snap.weather.id]?.label ?? snap.weather.id).toLowerCase()}`];
  if (snap.music?.isPlaying && snap.music.songTitle) bits.push(`"${snap.music.songTitle}" is playing`);
  if (snap.activeProjects?.length) bits.push(`the player has ${snap.activeProjects.length} active project${snap.activeProjects.length === 1 ? "" : "s"} on the workbench`);
  return `You know the Workshop itself first-hand, right now: ${bits.join(", ")}.`;
}

/** Version 3, Phase 11 ("Workshop Character") — "different Workshops
 *  should naturally begin feeling different because of the choices made
 *  within them." `WorldTimeService` already computes exactly "how long
 *  was the player away" (`cappedElapsedSeconds`/`isFirstSession`) for
 *  `ResidentController`/`BeingController` to reposition things
 *  plausibly on load — this is the same, already-resolved value, simply
 *  read into conversation too, rather than a second continuity
 *  mechanism of its own. `PlayerPatternMemory.leadingWorkingHours()` was
 *  fully implemented already (Version 3, "Residents should begin
 *  remembering behavioural patterns") but called nowhere — genuinely
 *  dead data until now, not a new signal invented for this line. */
function describeGap(seconds) {
  if (seconds < 60) return "just a moment";
  if (seconds < 5 * 60) return "a few minutes";
  if (seconds < 15 * 60) return "about ten minutes";
  if (seconds < 45 * 60) return "about half an hour";
  if (seconds < 90 * 60) return "about an hour";
  if (seconds < 4 * 3600) return "a few hours";
  return "most of a day";
}

function buildContinuityLine(worldTimeService, playerPatternMemory) {
  if (!worldTimeService) return null;
  const { isFirstSession, cappedElapsedSeconds } = worldTimeService.getContinuity();
  if (isFirstSession) return "This is the very first time the player has opened this Workshop — you're meeting them for the first time.";
  const bits = [`the player has just returned after ${describeGap(cappedElapsedSeconds)} away`];
  const workingHours = playerPatternMemory?.leadingWorkingHours?.();
  if (workingHours) bits.push(`they usually get to work in the ${workingHours}`);
  return `You notice ${bits.join(", and ")}.`;
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
  const { residentCuriosity, residentPreferences, playerPatternMemory, conversationMemory, worldObjectsStore, environmentSystem, timeOfDaySystem, worldEventLog, worldAwareness, worldTimeService } = deps;
  const curiosityNotes = residentCuriosity
    ? residentCuriosity.gatherNotes({ worldObjectsStore, environmentSystem, timeOfDaySystem, residentPreferences, playerPatternMemory, mutate: mutateCuriosity })
    : [];
  // "A living world is one that quietly notices... recent events." The
  // same "Things you might have noticed recently" line curiosity notes
  // already produce is exactly where a real weather change or a song
  // starting belongs too — one shared line, not a second new one, since
  // both are genuinely the same kind of thing from Bubble's own
  // perspective: something that happened, worth a passing mention, never
  // the centre of the conversation. Capped at two, oldest-noticed-first
  // discarded, so this never crowds out curiosity's own notes about the
  // Workshop itself.
  const worldEventNotes = (worldEventLog?.recent(2) ?? []).map((e) => e.summary);
  const memoryEnabled = profile?.memory?.mode !== "disabled";
  return {
    personalityLine: buildPersonalityLine(profile),
    preferenceLine: buildPreferenceLine(profile, { residentPreferences }),
    worldKnowledgeLine: buildWorldKnowledgeLine(worldAwareness),
    continuityLine: buildContinuityLine(worldTimeService, playerPatternMemory),
    curiosityNotes: [...curiosityNotes, ...worldEventNotes],
    memoryNotes: memoryEnabled ? conversationMemory?.mostRelevant() ?? [] : [],
  };
}
