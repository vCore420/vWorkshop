/**
 * MemoryConfiguration
 * ---------------------
 * "Please prepare the future memory system... these do not need to be
 * fully implemented yet. The goal is to establish the architecture." That
 * was true of every field here when this file was first written; `mode`
 * is the one that's genuinely read now — `src/resident/ConversationMemory.js`
 * checks it before extracting or surfacing anything, so "Disabled" really
 * does mean Bubble remembers nothing between messages. "Session Only" and
 * "Persistent" are treated identically this phase (kept for the current
 * runtime, never written to `localStorage`) — true cross-session
 * persistence for the latter is still honestly future work, not
 * implemented here; see its own description below and
 * docs/RESIDENT.md's "Conversation Memory" section.
 *
 * `memorySize`/`memorySummaries`/`contextBudget` remain exactly what they
 * were — real fields with real defaults, no actual storage limit or
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

export function defaultMemoryConfig() {
  return {
    mode: "disabled",
    memorySize: "medium", // not yet implemented — see this file's own comment
    memorySummaries: false, // not yet implemented
    contextBudget: "balanced", // not yet implemented
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
  };
}
