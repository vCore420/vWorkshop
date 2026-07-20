import { EventBus } from "../core/EventBus.js";
import { generateId } from "../utils/generateId.js";

/**
 * JournalStore
 * ------------
 * "One contribution" (see docs/CONTRIBUTIONS.md) — the computer's own
 * Journal app used to share NotesStore with the physical workbench
 * notebook: one text blob, overwritten on every keystroke, nothing kept.
 * Every other part of the Workshop that touches time keeps real
 * continuity — ResidentConversation remembers what was said, weather
 * picks up honestly from how much time actually passed, docs/HISTORY.md
 * accumulates the project's own past rather than describing only its
 * current state. The player's own reflections were the one place that
 * didn't. This store is deliberately separate from NotesStore rather than
 * an extension of it — the physical notebook stays exactly what it always
 * was (a single page you're always mid-sentence in; see Notebook.js's own
 * comment), and the computer's Journal becomes something a paper notebook
 * genuinely isn't: a dated log you can look back through.
 *
 * Entries are plain, ordered newest-first — no editing history, no
 * "versions" of an entry, just a list. `createEntry()` starts a new one;
 * `write()` only ever updates an existing entry's own text. Nothing here
 * ever rewrites an older entry's `createdAt` — the date is the point.
 */
export class JournalStore {
  constructor() {
    this.events = new EventBus();
    /** @type {{id: string, createdAt: string, updatedAt: string, text: string}[]} */
    this.entries = [];
  }

  list() {
    return this.entries;
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  /** Creates a new entry dated to right now and returns it. Caller decides whether/when to select it. */
  createEntry() {
    const now = new Date().toISOString();
    const entry = { id: generateId("journal"), createdAt: now, updatedAt: now, text: "" };
    this.entries.unshift(entry);
    this.events.emit("journal:changed", { id: entry.id });
    return entry;
  }

  write(id, text) {
    const entry = this.get(id);
    if (!entry) return;
    entry.text = text;
    entry.updatedAt = new Date().toISOString();
    this.events.emit("journal:changed", { id });
  }

  deleteEntry(id) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    this.entries.splice(index, 1);
    this.events.emit("journal:changed", { id: null });
  }

  save() {
    return { entries: this.entries };
  }

  load(data) {
    if (!data?.entries) return;
    this.entries = data.entries;
  }
}
