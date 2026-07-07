/**
 * NotesStore
 * ----------
 * Backs every physical notebook in the room. Keyed by notebook id so
 * adding a second, third, or tenth notebook later (a journal by the
 * sitting area, a reference notebook on a shelf...) is just another key —
 * no schema change, no migration.
 */
import { EventBus } from "../core/EventBus.js";

export class NotesStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, {text: string, updatedAt: string}>} */
    this.notebooks = {};
  }

  read(notebookId) {
    return this.notebooks[notebookId]?.text ?? "";
  }

  write(notebookId, text) {
    this.notebooks[notebookId] = { text, updatedAt: new Date().toISOString() };
    this.events.emit("notes:changed", { notebookId, text });
  }

  save() {
    return { notebooks: this.notebooks };
  }

  load(data) {
    if (!data?.notebooks) return;
    this.notebooks = data.notebooks;
  }
}
