import { StorageUtils } from "../utils/StorageUtils.js";

const SAVE_KEY = "workshop:save";
const SAVE_VERSION = 1;
const AUTOSAVE_INTERVAL_MS = 20000;
const SAVE_DEBOUNCE_MS = 400; // see the "saveRequested" handler below

/**
 * PersistenceSystem
 * ------------------
 * "The workshop should remember everything." Two ways a system's state ends
 * up in the save file:
 *
 *   1. Event-based (most core systems use this): a system listens for
 *      `persistence:save` and writes onto the shared `bag` object it
 *      receives, and listens for `persistence:load` to read its own key
 *      back out. Nothing needs to be registered anywhere else — a brand new
 *      system just starts listening for these two events.
 *
 *   2. Explicit providers (for plain data stores that aren't Engine
 *      systems, e.g. ProjectsStore, NotesStore, and PluginManager): call
 *      `persistence.registerProvider(key, storeInstance)` once, where
 *      `storeInstance` has `save()`/`load(data)` methods.
 *
 * PersistenceSystem itself only orchestrates *when* saving/loading happens
 * (on load, on an interval, on tab-hide, on request) — it has no opinion
 * about what's inside the save file.
 */
export class PersistenceSystem {
  constructor() {
    /** @type {Map<string, {save: () => any, load: (data: any) => void}>} */
    this.providers = new Map();
    this.lastSavedAt = null;
  }

  init(engine) {
    this.engine = engine;

    engine.events.on("engine:ready", () => this._loadFromStorage());
    // Debounced, not immediate: this event can now fire very rapidly (a
    // dragged Settings slider fires it on every pixel of movement) — an
    // immediate save here would mean a full synchronous
    // serialize-everything-and-write-to-localStorage on every single one
    // of those. beforeunload/visibilitychange below, and the periodic
    // autosave, all still save immediately and unconditionally, so nothing
    // is ever actually at risk of being lost by waiting a moment here.
    engine.events.on("persistence:saveRequested", () => this._scheduleSave());

    window.addEventListener("beforeunload", () => this.save());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.save();
    });
    this._autosaveTimer = setInterval(() => this.save(), AUTOSAVE_INTERVAL_MS);
  }

  _scheduleSave() {
    if (this._saveDebounceTimer) clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = setTimeout(() => {
      this._saveDebounceTimer = null;
      this.save();
    }, SAVE_DEBOUNCE_MS);
  }

  registerProvider(key, provider) {
    this.providers.set(key, provider);
  }

  _buildEnvelope() {
    const bag = {};
    this.engine.events.emit("persistence:save", bag);

    const providerData = {};
    for (const [key, provider] of this.providers) providerData[key] = provider.save();

    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      systems: bag,
      providers: providerData,
    };
  }

  save() {
    const envelope = this._buildEnvelope();
    const ok = StorageUtils.set(SAVE_KEY, envelope);
    if (ok) {
      this.lastSavedAt = envelope.savedAt;
      this.engine.events.emit("persistence:saved", { savedAt: this.lastSavedAt });
    }
    return envelope;
  }

  _loadFromStorage() {
    const envelope = StorageUtils.get(SAVE_KEY);
    if (!envelope) return; // fresh workshop — every system already applied sensible defaults in init()
    this._applyEnvelope(envelope);
  }

  _applyEnvelope(envelope) {
    if (envelope.systems) this.engine.events.emit("persistence:load", envelope.systems);
    if (envelope.providers) {
      for (const [key, provider] of this.providers) {
        if (envelope.providers[key] !== undefined) provider.load(envelope.providers[key]);
      }
    }
  }

  exportBackup() {
    const envelope = this._buildEnvelope();
    const date = new Date().toISOString().slice(0, 10);
    StorageUtils.downloadJSON(`workshop-backup-${date}.json`, envelope);
  }

  async importBackup() {
    const envelope = await StorageUtils.uploadJSON();
    if (!envelope?.version) throw new Error("That file doesn't look like a workshop backup.");
    StorageUtils.set(SAVE_KEY, envelope);
    this._applyEnvelope(envelope);
  }

  update(_dt) {}
}
