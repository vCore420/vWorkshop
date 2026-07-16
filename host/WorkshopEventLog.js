import { EventBus } from "../core/EventBus.js";

const MAX_ENTRIES = 150; // a genuine technical log, not just "a few notable moments" — see this file's own comment on why that's a different job from WorldEventLog's

/**
 * WorkshopEventLog
 * -------------------
 * "Introduce a Workshop Event Log... Resident events. Plugin events.
 * Host events. AI events. Persistence events. Atmosphere changes.
 * Warnings. Errors. Important Workshop activity... a chronological
 * history of Workshop activity." A small, bounded, persisted list of
 * `{type, summary, level, at}` entries — the technical counterpart to
 * `WorldEventLog.js`, not a replacement for it.
 *
 * **Deliberately a separate file from `WorldEventLog.js`, not a merge.**
 * `WorldEventLog` exists specifically to feed Bubble's own curiosity —
 * "things you might have noticed recently" needs to stay genuinely
 * world-flavoured (weather, sunrise, a song starting), never a plugin
 * stack trace or a connection status flip. Recording technical events
 * into that log would mean either polluting Bubble's own conversational
 * context with irrelevant system noise, or teaching that file to filter
 * itself back out again — more complexity either way than simply
 * keeping two logs with two honestly different audiences: `WorldEventLog`
 * for the resident, this one for the Workshop Diagnostics page (see
 * `DiagnosticsService.js`'s own `getReport()`, which reads both and
 * merges them only for *display*, never for storage).
 *
 * **Populated by listening to events that already exist** (`main.js`'s
 * own wiring), the same discipline `WorldEventLog` already holds itself
 * to — this class never invents a new signal, only keeps a running
 * memory of ones other systems already emit: `plugin:error`
 * (`PluginManager.js`, new this phase), `connection:changed`
 * (`AIConnectionManager.js`), `hostConnection:changed`
 * (`HostConnectionManager.js`), and `persistence:saveFailed` (new this
 * phase — see `PersistenceSystem.js`).
 */
export class WorkshopEventLog {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{type:string, summary:string, level:"info"|"warning"|"error", at:string}>} */
    this.entries = [];
  }

  /** `type` is a short, stable id (`"pluginError"`, `"aiConnected"`,
   *  `"hostDisconnected"`, ...) — deliberately not enumerated as a fixed
   *  list anywhere, the identical "a plain string tag, not a rigid enum"
   *  choice `WorldEventLog.record()` already makes. `level` drives both
   *  the Diagnostics page's own colour-coding and `filter()` below. */
  record(type, summary, level = "info") {
    this.entries.push({ type, summary, level, at: new Date().toISOString() });
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    this.events.emit("workshopEvents:changed", this.entries);
    this.events.emit("persistence:saveRequested");
  }

  /** Most recent first. */
  recent(count = MAX_ENTRIES) {
    return this.entries.slice(-count).reverse();
  }

  /** "Filtering." `level`/`type` are both optional — omit either to
   *  match anything for that field. Always most-recent-first, the same
   *  as `recent()`. */
  filter({ level, type } = {}) {
    return this.entries
      .filter((e) => (level ? e.level === level : true))
      .filter((e) => (type ? e.type === type : true))
      .slice()
      .reverse();
  }

  /** "Searching." A plain, case-insensitive substring match against each
   *  entry's own summary — genuinely simple on purpose, the same
   *  "coarse, not semantic" standard `ConversationMemory.js`'s own
   *  extraction already holds itself to; a log meant to be scanned
   *  quickly doesn't need a real search index. */
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return this.recent();
    return this.entries
      .filter((e) => e.summary.toLowerCase().includes(q) || e.type.toLowerCase().includes(q))
      .slice()
      .reverse();
  }

  /** "Exporting." The same `type`-tagged, `StorageUtils.downloadJSON()`
   *  shape every other export in the Workshop already uses — see
   *  `docs/PERSISTENCE.md`'s own "Import & Export" section. Export-only;
   *  there's no matching `importLog()`, since a log recording what
   *  happened in *this* Workshop session has no meaningful way to import
   *  into another one — unlike a profile or expression pack, nothing
   *  here is meant to be reused elsewhere. */
  exportLog() {
    return { type: "workshop-event-log", version: 1, exportedAt: new Date().toISOString(), entries: this.entries };
  }

  getStatus() {
    const errorCount = this.entries.filter((e) => e.level === "error").length;
    return {
      available: true,
      summary: errorCount > 0 ? `${this.entries.length} events logged (${errorCount} errors).` : `${this.entries.length} events logged.`,
    };
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { entries: this.entries };
  }

  load(data) {
    if (Array.isArray(data?.entries)) this.entries = data.entries.slice(-MAX_ENTRIES);
  }
}
