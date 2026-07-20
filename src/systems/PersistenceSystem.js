import { StorageUtils } from "../utils/StorageUtils.js";
import { CURRENT_SAVE_VERSION, migrateEnvelope } from "./SaveMigrations.js";
import { debounce } from "../utils/debounce.js";

const SAVE_KEY = "workshop:save";
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
    this.lastSaveFailedAt = null;
    // Workshop Refinement phase (Pass A) — see save()'s own comment.
    this._suppressSave = false;
    this._scheduleSave = debounce(() => this.save(), SAVE_DEBOUNCE_MS);
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

  registerProvider(key, provider) {
    this.providers.set(key, provider);
  }

  _buildEnvelope() {
    const bag = {};
    this.engine.events.emit("persistence:save", bag);

    const providerData = {};
    for (const [key, provider] of this.providers) providerData[key] = provider.save();

    return {
      type: "workshop-backup", // Workshop Workflow phase — lets importBackup() (and, by the same convention, ResidentProfileStore.importProfile()) tell a whole-Workshop backup apart from any other kind of exported file with a specific, helpful message rather than a generic parse failure
      version: CURRENT_SAVE_VERSION,
      savedAt: new Date().toISOString(),
      systems: bag,
      providers: providerData,
    };
  }

  /** Workshop Diagnostics phase — a failed save used to be entirely
   *  silent: `StorageUtils.set()` returning `false` (most commonly
   *  `localStorage`'s own quota exceeded) meant nothing happened at
   *  all — no error, no event, nothing for a person to notice until
   *  they eventually lost work and had no idea why. Now tracked
   *  (`lastSaveFailedAt`) and announced (`"persistence:saveFailed"`) the
   *  same honest way a successful save already announces itself via
   *  `"persistence:saved"` — see `DiagnosticsService.js`'s own health
   *  computation for where this actually surfaces to a person.
   *
   *  Workshop Refinement phase (Pass A) — "Factory Reset should truly
   *  restore the Workshop... some world modifications remain after a
   *  reset." Root cause: `save()` is *also* wired to `beforeunload`
   *  (see `init()` above, for the ordinary "don't lose the last few
   *  seconds of work on tab close" case) — but `factoryReset()` and
   *  `importBackup()` both call `window.location.reload()` themselves,
   *  which fires `beforeunload` too. That fired *after*
   *  `factoryReset()`'s own `localStorage.clear()`, or *after*
   *  `importBackup()`'s own freshly-written imported data — and
   *  `save()` unconditionally re-serialises whatever every provider's
   *  own *in-memory* state still is at that moment, which is still the
   *  old, pre-reset (or pre-import) state, since nothing had actually
   *  reloaded yet. That re-write silently put the old data straight
   *  back into `localStorage` a few milliseconds before the reload that
   *  was supposed to leave it empty — not a partial reset limited to
   *  Builder blocks and terrain specifically, but every provider, every
   *  time either action ran; those two were just the most visibly
   *  obvious ones to notice missing. `_suppressSave` is set by both
   *  methods before they do anything else, so this genuinely becomes a
   *  no-op for the remainder of that page's lifetime once either one has
   *  started — there's nothing to resume it for, since both paths always
   *  end in a reload. */
  save() {
    if (this._suppressSave) return null;
    const envelope = this._buildEnvelope();
    const ok = StorageUtils.set(SAVE_KEY, envelope);
    if (ok) {
      this.lastSavedAt = envelope.savedAt;
      this.lastSaveFailedAt = null;
      this.engine.events.emit("persistence:saved", { savedAt: this.lastSavedAt });
    } else {
      this.lastSaveFailedAt = new Date().toISOString();
      this.engine.events.emit("persistence:saveFailed", { at: this.lastSaveFailedAt });
    }
    return envelope;
  }

  _loadFromStorage() {
    const envelope = StorageUtils.get(SAVE_KEY);
    const now = new Date();
    if (!envelope) {
      // A fresh Workshop — every system already applied sensible defaults
      // in init(). Still resolves continuity (with lastSavedAt: null,
      // meaning "nothing to catch up on") so WorldTimeService and any
      // continuity-aware system always hear exactly one
      // "world:continuityReady" per session, first-time or not.
      this.engine.events.emit("world:continuityReady", { lastSavedAt: null, now });
      return;
    }
    const startingVersion = envelope.version ?? 1;
    const migrated = migrateEnvelope(envelope);
    this._applyEnvelope(migrated);
    if (migrated.version !== startingVersion) this.save(); // persist the migrated shape immediately, not just once something else next triggers a save
    // Only after every system's own "persistence:load" handler has
    // already run (EventBus.emit() is synchronous, so that's already
    // guaranteed by the time _applyEnvelope() above returns) — a
    // continuity handler reacting to elapsed time needs to see each
    // system's own *restored* state, not whatever default it started
    // life with.
    this.engine.events.emit("world:continuityReady", { lastSavedAt: migrated.savedAt ?? null, now });
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

  /** Workshop Workflow phase — "validation... version compatibility...
   *  better error handling." Three real, specific failure/warning cases,
   *  each with its own message, rather than one generic "couldn't read
   *  that file":
   *   - Not a Workshop file at all (`version` missing entirely).
   *   - A different *kind* of Workshop export (an AI profile, say —
   *     see `ResidentProfileStore.exportProfile()`'s own matching
   *     `type`) — a clear redirect rather than a confusing failure.
   *   - A **newer** backup than this Workshop build understands —
   *     `SaveMigrations.js` only ever migrates forward, so there's
   *     nothing to safely convert; this asks for explicit confirmation
   *     rather than silently importing a shape parts of this Workshop
   *     might not fully recognise.
   *  Reloads the page on success — the simplest way to guarantee every
   *  open panel, not just the underlying stores, reflects the newly
   *  imported state consistently, rather than trusting every live UI to
   *  notice a full-state swap happening underneath it. */
  async importBackup() {
    // See save()'s own comment on the identical race this closes.
    this._suppressSave = true;
    const envelope = await StorageUtils.uploadJSON();
    if (!envelope || typeof envelope.version !== "number") {
      this._suppressSave = false; // no reload is coming after all — let ordinary saving resume
      throw new Error("That file doesn't look like a Workshop backup.");
    }
    if (envelope.type && envelope.type !== "workshop-backup") {
      this._suppressSave = false;
      throw new Error(envelope.type === "workshop-ai-profile" ? "That's an AI profile export, not a Workshop backup \u2014 import it from AI Control instead." : "That file doesn't look like a Workshop backup.");
    }
    if (envelope.version > CURRENT_SAVE_VERSION) {
      const proceed = window.confirm(
        "This backup was made with a newer version of the Workshop than you're currently running. " +
          "Importing it anyway may not restore everything correctly. Import it anyway?"
      );
      if (!proceed) {
        this._suppressSave = false;
        return;
      }
    }
    const migrated = migrateEnvelope(envelope);
    StorageUtils.set(SAVE_KEY, migrated);
    window.alert("Workshop imported \u2014 reloading now.");
    window.location.reload();
  }

  /** Settings app's Danger Zone — "Reset Workshop Settings" and "Reset
   *  Player Data" reset their own specific stores directly (see
   *  SettingsApp.js); this is for the two actions that are genuinely
   *  PersistenceSystem's own concern. */

  /** "Clear Workshop Cache" — the PWA's cached static assets, not any
   *  saved data. Forces a fresh fetch of every file next load; useful if
   *  the Workshop seems to be showing a stale version of itself. */
  async clearServiceWorkerCache() {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  }

  /** "Factory Reset Workshop" — every save key gone, both IndexedDB
   *  databases (music folder handles, player textures) deleted, cache
   *  cleared, then a reload. `dbNames` is passed in from main.js rather
   *  than hardcoded here, since PersistenceSystem has no reason to
   *  otherwise know HandleStore/TextureStore's specific database names —
   *  see docs/PERFORMANCE.md's persistence section for why those two live
   *  in IndexedDB at all. */
  async factoryReset(dbNames = []) {
    // See save()'s own comment for why this has to be first, before any
    // `await` — the whole point is closing the window a stray save could
    // slip through in, and that window starts now.
    this._suppressSave = true;
    await this.clearServiceWorkerCache();
    localStorage.clear();
    await Promise.all(
      dbNames.map(
        (name) =>
          new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          })
      )
    );
    window.location.reload();
  }

  update(_dt) {}
}
