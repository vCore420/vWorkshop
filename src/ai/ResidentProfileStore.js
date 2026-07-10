import { EventBus } from "../core/EventBus.js";
import { defaultMemoryConfig, normalizeMemoryConfig } from "./MemoryConfiguration.js";
import { defaultEmbodimentConfig, normalizeEmbodimentConfig } from "./EmbodimentConfiguration.js";

const DEFAULT_BEHAVIOUR_CONFIG = {
  temperature: 0.7,
  contextSize: 4096,
  maxResponseLength: 512,
  creativity: 0.5,
  determinism: 0.5,
};

const DEFAULT_IDENTITY = {
  purpose: "",
  identity: "",
  personality: "",
  behaviour: "",
  conversationStyle: "",
};

/**
 * ResidentProfileStore
 * -----------------------
 * "This allows multiple AI personalities to be configured... Profiles
 * should persist between Workshop sessions." Each profile is the *entire*
 * description of one possible future resident — identity, which model it
 * uses, behaviour tuning, and its (currently inert) memory/embodiment
 * settings — all in one place, so switching the active profile is
 * switching everything about who's being prepared at once, the same way
 * switching outfits in the Wardrobe switches everything about how the
 * player looks at once.
 *
 * "The future AI Resident should simply consume these configurations
 * rather than implementing its own copies" — this store, plus
 * `PromptComposer.composeSystemPrompt()`, is the entire contract a real
 * AI Resident system will eventually read from. Nothing about that
 * future system needs to change how a profile is shaped; it just starts
 * reading `getActive()`.
 *
 * Always at least one profile — a fresh Workshop seeds one named
 * "Workshop Resident" (matching the Status Card's own example), the same
 * "never an empty, purposeless state" instinct behind `BrowserStore`
 * always keeping one tab and `AnimationLibraryStore` always keeping its
 * own defaults.
 */
export class ResidentProfileStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, object>} */
    this.profiles = {};
    this.activeProfileId = null;
    this._seedDefault();
  }

  _seedDefault() {
    const profile = this._buildProfile("Workshop Resident");
    this.profiles[profile.id] = profile;
    this.activeProfileId = profile.id;
  }

  _buildProfile(name) {
    const id = `resident-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    const now = new Date().toISOString();
    return {
      id,
      name: name?.trim() || "Untitled Resident",
      model: null,
      identity: { ...DEFAULT_IDENTITY },
      behaviourConfig: { ...DEFAULT_BEHAVIOUR_CONFIG },
      memory: defaultMemoryConfig(),
      embodiment: defaultEmbodimentConfig(),
      createdAt: now,
      updatedAt: now,
    };
  }

  create(name) {
    const profile = this._buildProfile(name);
    this.profiles[profile.id] = profile;
    this.activeProfileId = profile.id;
    this._emitChanged();
    return profile;
  }

  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const copy = this._buildProfile(`${source.name} (copy)`);
    copy.model = source.model;
    copy.identity = { ...source.identity };
    copy.behaviourConfig = { ...source.behaviourConfig };
    copy.memory = { ...source.memory };
    copy.embodiment = { ...source.embodiment };
    this.profiles[copy.id] = copy;
    this.activeProfileId = copy.id;
    this._emitChanged();
    return copy;
  }

  rename(id, name) {
    const profile = this.get(id);
    if (!profile) return;
    profile.name = name?.trim() || profile.name;
    profile.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  remove(id) {
    if (Object.keys(this.profiles).length <= 1) return; // never leave the Workshop with no resident being prepared at all
    delete this.profiles[id];
    if (this.activeProfileId === id) {
      this.activeProfileId = Object.keys(this.profiles)[0];
    }
    this._emitChanged();
  }

  setActive(id) {
    if (!this.profiles[id]) return;
    this.activeProfileId = id;
    this._emitChanged();
  }

  get(id) {
    return this.profiles[id] ?? null;
  }

  getActive() {
    return this.profiles[this.activeProfileId] ?? Object.values(this.profiles)[0] ?? null;
  }

  all() {
    return Object.values(this.profiles).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** A single, narrow entry point for every field this store owns —
   *  `AIApp.js` calls this the same way regardless of whether it's
   *  updating the resident's name, one identity field, the model, a
   *  behaviour number, or a memory/embodiment setting, rather than this
   *  store exposing a different bespoke setter per field. `patch` is a
   *  shallow merge at the top level, and a *nested* merge for
   *  `identity`/`behaviourConfig`/`memory`/`embodiment` specifically —
   *  updating just `identity.purpose` never clobbers the profile's other
   *  identity fields it didn't mention. */
  update(id, patch) {
    const profile = this.get(id);
    if (!profile || !patch) return;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "identity") profile.identity = { ...profile.identity, ...value };
      else if (key === "behaviourConfig") profile.behaviourConfig = { ...profile.behaviourConfig, ...value };
      else if (key === "memory") profile.memory = normalizeMemoryConfig({ ...profile.memory, ...value });
      else if (key === "embodiment") profile.embodiment = normalizeEmbodimentConfig({ ...profile.embodiment, ...value });
      else profile[key] = value;
    }
    profile.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  _emitChanged() {
    this.events.emit("residents:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { profiles: this.profiles, activeProfileId: this.activeProfileId };
  }

  load(data) {
    if (!data?.profiles || Object.keys(data.profiles).length === 0) return;
    this.profiles = data.profiles;
    // Normalising memory/embodiment on load, not just on update(), covers
    // a profile saved by an older version of this store before a new
    // field existed — it always ends up with every current field's own
    // sensible default rather than `undefined`.
    for (const profile of Object.values(this.profiles)) {
      profile.memory = normalizeMemoryConfig(profile.memory);
      profile.embodiment = normalizeEmbodimentConfig(profile.embodiment);
      profile.identity = { ...DEFAULT_IDENTITY, ...profile.identity };
      profile.behaviourConfig = { ...DEFAULT_BEHAVIOUR_CONFIG, ...profile.behaviourConfig };
    }
    this.activeProfileId = data.activeProfileId && this.profiles[data.activeProfileId] ? data.activeProfileId : Object.keys(this.profiles)[0];
    this.events.emit("residents:changed");
  }
}

export { DEFAULT_BEHAVIOUR_CONFIG };
