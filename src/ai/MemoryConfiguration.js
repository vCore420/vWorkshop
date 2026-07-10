/**
 * MemoryConfiguration
 * ---------------------
 * "Please prepare the future memory system... these do not need to be
 * fully implemented yet. The goal is to establish the architecture."
 * This file *is* that architecture: the one shape a resident profile's
 * memory settings take, and nothing else — no actual memory storage, no
 * summarisation, no context-budget enforcement lives here or anywhere in
 * this phase. A future memory system consumes this exact shape rather
 * than a future AI Resident (or this file) needing to invent it twice.
 *
 * `memorySize`/`memorySummaries`/`contextBudget` are real fields with
 * real defaults, not commented-out placeholders — "include placeholders
 * for future options" means the *shape* exists and is honestly labelled
 * as not yet doing anything, not that the fields themselves are missing.
 * `AIApp.js`'s own Memory section marks them clearly as not active yet.
 */
export const MEMORY_MODES = [
  { id: "disabled", label: "Disabled", description: "This resident won't remember anything between conversations." },
  { id: "session", label: "Session Only", description: "Remembered for as long as the Workshop stays open, forgotten when it closes." },
  { id: "persistent", label: "Persistent", description: "Remembered across Workshop sessions — not implemented yet, reserved for a future phase." },
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
