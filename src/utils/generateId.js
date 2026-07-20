/**
 * generateId
 * ----------
 * Version 3 wrap-up cleanup — this exact "prefix + timestamp + short
 * random suffix" shape had been hand-rolled independently in several
 * stores (`JournalStore`, `ProjectsStore`'s calculation records,
 * `ToolsStore`'s run history, `BrowserStore`'s tabs), each spelling out
 * `Date.now()` and `Math.random().toString(36)` itself. Good enough for
 * this project's own actual collision risk (one browser tab, one
 * player) — not a UUID, doesn't need to be.
 */
export function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
