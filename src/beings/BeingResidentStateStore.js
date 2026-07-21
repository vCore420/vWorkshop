import { ResidentState } from "../resident/ResidentState.js";
import { ResidentPreferences } from "../resident/ResidentPreferences.js";
import { PlayerPatternMemory } from "../resident/PlayerPatternMemory.js";
import { ResidentCuriosity } from "../resident/ResidentCuriosity.js";
import { ConversationMemory } from "../resident/ConversationMemory.js";

/**
 * BeingResidentStateStore
 * -------------------------
 * Version 4, Phase 7 ("Being ↔ Resident Convergence, Implementation") —
 * the new store Phase 6's own investigation concluded was needed:
 * `BeingInstanceStore.js`'s closed, hand-enumerated schema stays
 * untouched (every ordinary Being never needs any of this), so this is a
 * genuinely separate, parallel store, keyed by Being instance id instead
 * of one flat singleton key, holding a bundle only for instances whose
 * own definition actually has `interactionBehaviour: "aiResident"` and a
 * `residentProfileId` set.
 *
 * Each bundle is a fresh instance of the **existing, unmodified**
 * `ResidentState`/`ResidentPreferences`/`PlayerPatternMemory`/
 * `ResidentCuriosity`/`ConversationMemory` classes — confirmed in the
 * Phase 6 investigation that none of those four files' own internal
 * logic needed to change, only how many of them exist and what they're
 * wired to. The one real behavioural difference from the old singleton
 * wiring: `ConversationMemory.configurePersistence()`/`watchProjects()`
 * are pointed at *this instance's own* `residentProfileId`, never
 * `residentProfileStore.getActive()` — exactly the hook those methods
 * already exposed for this, per `ConversationMemory.js`'s own comment on
 * why it used to read "whichever profile happens to be active."
 */
export class BeingResidentStateStore {
  constructor({ residentProfileStore, beingLibrary, beingInstanceStore, projectsStore = null }) {
    this.residentProfileStore = residentProfileStore;
    this.beingLibrary = beingLibrary;
    this.beingInstanceStore = beingInstanceStore;
    this.projectsStore = projectsStore;
    /** @type {Map<number, {residentState: ResidentState, residentPreferences: ResidentPreferences, playerPatternMemory: PlayerPatternMemory, residentCuriosity: ResidentCuriosity, conversationMemory: ConversationMemory}>} */
    this.bundles = new Map();
  }

  /** Whether a placed instance's own definition actually opted into this —
   *  reads `BeingLibrary` fresh every time rather than caching, the same
   *  "definitions live elsewhere, always looked up live" convention
   *  `BeingController.js` already holds itself to. */
  isResidentCapable(instance) {
    const definition = instance ? this.beingLibrary.get(instance.definitionId) : null;
    return !!(definition?.interactionBehaviour === "aiResident" && definition?.residentProfileId);
  }

  /** Lazily builds a bundle the first time a given instance actually
   *  needs one (an ordinary Being that's never resident-capable never
   *  gets one at all) — called from `BeingController.js` (movement/
   *  interaction) and `ResidentConversation.js` (the conversation
   *  overlay itself), both already holding an instance id. */
  getOrCreate(instanceId) {
    let bundle = this.bundles.get(instanceId);
    if (bundle) return bundle;

    const instance = this.beingInstanceStore.get(instanceId);
    const definition = instance ? this.beingLibrary.get(instance.definitionId) : null;
    const residentProfileId = definition?.residentProfileId ?? null;

    bundle = {
      residentState: new ResidentState(),
      residentPreferences: new ResidentPreferences(),
      playerPatternMemory: new PlayerPatternMemory(),
      residentCuriosity: new ResidentCuriosity(),
      conversationMemory: new ConversationMemory(),
    };
    bundle.conversationMemory.configurePersistence(() => this.residentProfileStore?.get(residentProfileId)?.memory?.mode);
    if (this.projectsStore) {
      bundle.conversationMemory.watchProjects(this.projectsStore, () => this.residentProfileStore?.get(residentProfileId)?.memory?.categories);
    }
    this.bundles.set(instanceId, bundle);
    return bundle;
  }

  get(instanceId) {
    return this.bundles.get(instanceId) ?? null;
  }

  /** Called when a Being instance is genuinely deleted (not merely
   *  despawned — despawning "temporarily removes... without forgetting
   *  it ever existed," the same distinction `BeingInstanceStore.js`'s own
   *  comment already draws, and applies here too: a despawned
   *  resident-capable Being keeps its bundle). */
  remove(instanceId) {
    this.bundles.delete(instanceId);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    const out = {};
    for (const [instanceId, bundle] of this.bundles) {
      out[instanceId] = {
        residentState: bundle.residentState.save(),
        residentPreferences: bundle.residentPreferences.save(),
        playerPatternMemory: bundle.playerPatternMemory.save(),
        residentCuriosity: bundle.residentCuriosity.save(),
        conversationMemory: bundle.conversationMemory.save(),
      };
    }
    return out;
  }

  /** Registered (see `main.js`) *after* `beingLibrary`/`beingInstances`
   *  so both are already loaded by the time this runs — walks every
   *  placed instance once, hydrating a bundle for exactly the ones that
   *  are actually resident-capable, rather than trusting `data`'s own
   *  keys (an instance a save predates, or one whose definition changed
   *  since, is handled the same honest way either direction). */
  load(data) {
    this.bundles.clear();
    for (const instance of this.beingInstanceStore.all()) {
      if (!this.isResidentCapable(instance)) continue;
      const bundle = this.getOrCreate(instance.id);
      const saved = data?.[instance.id];
      if (!saved) continue;
      bundle.residentState.load(saved.residentState);
      bundle.residentPreferences.load(saved.residentPreferences);
      bundle.playerPatternMemory.load(saved.playerPatternMemory);
      bundle.residentCuriosity.load(saved.residentCuriosity);
      bundle.conversationMemory.load(saved.conversationMemory);
    }
  }
}
