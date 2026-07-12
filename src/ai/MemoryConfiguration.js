/**
 * MemoryConfiguration
 * ---------------------
 * "Please prepare the future memory system... these do not need to be
 * fully implemented yet. The goal is to establish the architecture." That
 * was true of every field here when this file was first written; `mode`
 * became genuinely read in the Workshop Residents phase —
 * `src/resident/ConversationMemory.js` checks it before extracting or
 * surfacing anything. This phase (AI Intelligence) activates the rest:
 * `categories` (what Bubble remembers) and each category's own lifetime
 * tier (how long that kind of memory sticks around) are both now
 * genuinely read by `ConversationMemory.js` too — see its own comments
 * for exactly how.
 *
 * "Session Only" and "Persistent" are still currently treated
 * identically (kept for the runtime session, never written to
 * `localStorage`); true cross-session persistence for the latter remains
 * honest future work, not implemented here.
 *
 * `memorySize`/`memorySummaries`/`contextBudget` remain exactly what they
 * were — real fields with real defaults, no storage limit or
 * summarisation behind any of them yet. `AIApp.js`'s own Memory section
 * still marks those three as not active.
 */
export const MEMORY_MODES = [
  { id: "disabled", label: "Disabled", description: "This resident won't remember anything between conversations." },
  { id: "session", label: "Session Only", description: "Remembered for as long as the Workshop stays open, forgotten when it closes." },
  { id: "persistent", label: "Persistent", description: "Remembered across Workshop sessions — treated the same as Session Only for now; true cross-session persistence is reserved for a future phase." },
];

export const MEMORY_SIZE_OPTIONS = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

export const CONTEXT_BUDGET_OPTIONS = [
  { id: "conservative", label: "Conservative — favours response length" },
  { id: "balanced", label: "Balanced" },
  { id: "generous", label: "Generous — favours memory depth" },
];

/** "Allow the player to configure what Bubble remembers" — one toggle
 *  per kind of thing `ConversationMemory.js` can actually populate.
 *  `conversations` is the one parent switch among these: it gates
 *  whether ordinary message text is scanned for anything memorable at
 *  all (projects/preferences/goals, individually toggled underneath it);
 *  `places`/`activities`/`workshopHistory` are each independent, since
 *  they're sourced from other systems (`ResidentPreferences`,
 *  `PlayerPatternMemory`, `ProjectsStore`) rather than message text. */
export const MEMORY_CATEGORIES = [
  { id: "conversations", label: "Conversations", description: "Whether ordinary messages are scanned for anything memorable at all." },
  { id: "projects", label: "Projects", description: "Mentions of a real Workshop project by name." },
  { id: "preferences", label: "Player Preferences", description: "Stated likes and favourites (\u201cI love...\u201d, \u201cmy favourite X is...\u201d)." },
  { id: "goals", label: "Long-Term Goals", description: "Stated intentions (\u201cI want to...\u201d, \u201cI'm going to...\u201d)." },
  { id: "places", label: "Favourite Places", description: "Where the player, or Bubble itself, tends to spend time." },
  { id: "activities", label: "Favourite Activities", description: "Weather, music, and other things Bubble has noticed itself enjoying." },
  { id: "workshopHistory", label: "Workshop History", description: "Finished projects and other real Workshop milestones." },
];

/** "Configurable memory lifetimes where appropriate" — three tiers, a
 *  real, working `ttlMs` behind each rather than a label with no effect.
 *  `null` means "no time-based expiry at all" — a permanent memory only
 *  ever leaves through capacity pressure or an explicit reset. */
export const MEMORY_LIFETIMES = [
  { id: "temporary", label: "Temporary", description: "Fades within a few minutes if it doesn't come up again.", ttlMs: 10 * 60 * 1000 },
  { id: "mediumTerm", label: "Medium-Term", description: "Sticks around for a couple of hours of real time.", ttlMs: 2 * 60 * 60 * 1000 },
  { id: "permanent", label: "Permanent", description: "Never expires on its own for the rest of this session.", ttlMs: null },
];

/** Which lifetime tier each category defaults to — not independently
 *  configurable per category this phase ("where appropriate" licenses
 *  keeping this simple rather than seven more sliders); see
 *  `docs/AI.md`'s own Memory section for the reasoning behind each
 *  choice. `conversations` has no tier — it's the parent switch described
 *  above, not a note category. `places`/`activities` also have none,
 *  deliberately: those two gate `ResidentContext.js`'s own live
 *  `preferenceLine` (always computed fresh from `ResidentPreferences`'
 *  current favourite), not a stored `ConversationMemory` note with
 *  anything to expire — giving them a lifetime badge in the UI would be
 *  a label with nothing real behind it, exactly what this phase is
 *  meant to retire, not add more of. */
export const CATEGORY_LIFETIMES = {
  projects: "permanent",
  preferences: "mediumTerm",
  goals: "permanent",
  workshopHistory: "permanent",
};

export function lifetimeTtlMs(lifetimeId) {
  return MEMORY_LIFETIMES.find((l) => l.id === lifetimeId)?.ttlMs ?? null;
}

export function defaultMemoryCategories() {
  const categories = {};
  for (const category of MEMORY_CATEGORIES) categories[category.id] = true;
  return categories;
}

export function normalizeMemoryCategories(categories) {
  const defaults = defaultMemoryCategories();
  if (!categories) return defaults;
  const normalized = {};
  for (const category of MEMORY_CATEGORIES) {
    normalized[category.id] = typeof categories[category.id] === "boolean" ? categories[category.id] : defaults[category.id];
  }
  return normalized;
}

export function defaultMemoryConfig() {
  return {
    mode: "disabled",
    memorySize: "medium", // not yet implemented — see this file's own comment
    memorySummaries: false, // not yet implemented
    contextBudget: "balanced", // not yet implemented
    categories: defaultMemoryCategories(),
  };
}

export function normalizeMemoryConfig(config) {
  const defaults = defaultMemoryConfig();
  if (!config) return defaults;
  return {
    mode: MEMORY_MODES.some((m) => m.id === config.mode) ? config.mode : defaults.mode,
    memorySize: MEMORY_SIZE_OPTIONS.some((m) => m.id === config.memorySize) ? config.memorySize : defaults.memorySize,
    memorySummaries: typeof config.memorySummaries === "boolean" ? config.memorySummaries : defaults.memorySummaries,
    contextBudget: CONTEXT_BUDGET_OPTIONS.some((m) => m.id === config.contextBudget) ? config.contextBudget : defaults.contextBudget,
    categories: normalizeMemoryCategories(config.categories),
  };
}
