import { EventBus } from "../core/EventBus.js";
import { defaultMemoryConfig, normalizeMemoryConfig, normalizeMemoryCategories } from "./MemoryConfiguration.js";
import { defaultEmbodimentConfig, normalizeEmbodimentConfig } from "./EmbodimentConfiguration.js";
import { defaultTraitConfig, normalizeTraitConfig } from "./TraitConfiguration.js";
import { defaultDialsConfig, normalizeDialsConfig } from "./BehaviourDialsConfiguration.js";
import { DEFAULT_PROVIDER_ID, normalizeProviderId } from "./ProviderRegistry.js";
import { defaultFunctionsConfig, normalizeFunctionsConfig } from "./WorkshopFunctions.js";

const DEFAULT_BEHAVIOUR_CONFIG = {
  temperature: 0.7,
  contextSize: 4096,
  maxResponseLength: 512,
  creativity: 0.5,
  determinism: 0.5,
  dials: defaultDialsConfig(),
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
 * uses, behaviour tuning, its long-term personality traits, its
 * memory/embodiment settings, and (Version 3, Phase 8b) which Workshop
 * Functions it's actually allowed to call (increasingly real, no longer
 * purely inert — see docs/RESIDENT.md) — all in one place, so switching
 * the active profile is switching everything about who's being prepared
 * at once, the same way switching outfits in the Wardrobe switches
 * everything about how the player looks at once.
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
      provider: DEFAULT_PROVIDER_ID,
      identity: { ...DEFAULT_IDENTITY },
      behaviourConfig: { ...DEFAULT_BEHAVIOUR_CONFIG },
      traits: defaultTraitConfig(),
      memory: defaultMemoryConfig(),
      embodiment: defaultEmbodimentConfig(),
      // Version 3, Phase 8b ("Bubble Gains Hands") — every function
      // defaults to granted. There's no code-level notion of "Bubble" as
      // a special resident; every profile, hers included, starts the
      // same way and stays individually toggleable from Mission Control.
      functions: defaultFunctionsConfig(),
      // Workshop Personality phase — "future residents may have
      // different expression sets." The identical "a plain id, resolved
      // against a separate store elsewhere" shape `provider`/`model`
      // already use — "default" is a reserved sentinel meaning "the
      // built-in procedural drawing," never a real id
      // `ExpressionSetStore.js` would ever hand out (see that file's own
      // `expr-<n>` id format).
      expressionSetId: "default",
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
    copy.provider = source.provider;
    copy.identity = { ...source.identity };
    copy.behaviourConfig = { ...source.behaviourConfig, dials: { ...source.behaviourConfig.dials } };
    copy.traits = { ...source.traits, selected: [...source.traits.selected] };
    copy.memory = { ...source.memory, categories: { ...source.memory.categories } };
    copy.embodiment = { ...source.embodiment };
    copy.functions = { ...source.functions, granted: { ...source.functions.granted } };
    copy.expressionSetId = source.expressionSetId ?? "default";
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
   *  behaviour number, one behaviour dial, a trait selection, the
   *  provider, or a memory/embodiment setting, rather than this store
   *  exposing a different bespoke setter per field. `patch` is a shallow
   *  merge at the top level, and a *nested* merge for
   *  `identity`/`behaviourConfig`/`traits`/`memory`/`embodiment`
   *  specifically — updating just `identity.purpose` never clobbers the
   *  profile's other identity fields it didn't mention.
   *  `behaviourConfig.dials` gets its own second level of nested merge
   *  for the identical reason — changing one dial (say, Curiosity) must
   *  never silently reset the other six back to their defaults. */
  update(id, patch) {
    const profile = this.get(id);
    if (!profile || !patch) return;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "identity") profile.identity = { ...profile.identity, ...value };
      else if (key === "behaviourConfig") {
        const mergedDials = normalizeDialsConfig({ ...profile.behaviourConfig.dials, ...(value.dials ?? {}) });
        profile.behaviourConfig = { ...profile.behaviourConfig, ...value, dials: mergedDials };
      } else if (key === "traits") profile.traits = normalizeTraitConfig({ ...profile.traits, ...value });
      else if (key === "memory") {
        const mergedCategories = normalizeMemoryCategories({ ...profile.memory.categories, ...(value.categories ?? {}) });
        profile.memory = normalizeMemoryConfig({ ...profile.memory, ...value, categories: mergedCategories });
      } else if (key === "embodiment") profile.embodiment = normalizeEmbodimentConfig({ ...profile.embodiment, ...value });
      else if (key === "functions") {
        const mergedGranted = { ...profile.functions.granted, ...(value.granted ?? {}) };
        profile.functions = normalizeFunctionsConfig({ ...profile.functions, ...value, granted: mergedGranted });
      } else if (key === "provider") profile.provider = normalizeProviderId(value);
      else profile[key] = value;
    }
    profile.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  _emitChanged() {
    this.events.emit("residents:changed");
    this.events.emit("persistence:saveRequested");
  }

  /** "AI Profile Export... Profile sharing." A single profile, wrapped
   *  in a small envelope of its own — distinct from
   *  `PersistenceSystem`'s own whole-Workshop backup envelope (both are
   *  just JSON files on disk; the `type` field is what lets
   *  `importProfile()` below, and `PersistenceSystem.importBackup()`,
   *  each tell the other's export apart from their own and say so
   *  plainly instead of failing to parse it silently). Genuinely
   *  shareable — nothing about a profile *embeds* anything else from
   *  this specific Workshop's own save data, so the resulting file means
   *  exactly as much on a different computer as it does on this one.
   *  One honest exception: `expressionSetId` is a plain *reference* to a
   *  separate `ExpressionSetStore.js` entry (see that file's own
   *  "Exporting expression packs") — it travels with the profile, but
   *  the actual pixel data doesn't, the same way an outfit's own custom
   *  textures don't travel with a whole-Workshop backup either. A
   *  missing reference falls back to the built-in procedural face
   *  automatically, never a broken or blank one. */
  exportProfile(id) {
    const profile = this.get(id);
    if (!profile) return null;
    return { type: "workshop-ai-profile", version: 1, exportedAt: new Date().toISOString(), profile };
  }

  /** The counterpart — validated and normalised the exact same way
   *  `load()` above already normalises a profile restored from a whole-
   *  Workshop backup, so a profile exported from an older Workshop
   *  version (missing a field this version later added), or shared by
   *  someone else's Workshop entirely, still imports as a complete,
   *  sensible profile rather than one with `undefined` scattered through
   *  its settings. Always creates a *new* profile with a fresh id rather
   *  than overwriting anything by id — importing is additive, never
   *  destructive, the same instinct `duplicate()` above already follows.
   *  Throws with a specific, human-readable message on anything that
   *  doesn't look like a real profile export, for `AIApp.js`'s own
   *  try/catch to show directly. */
  importProfile(data) {
    if (!data || typeof data !== "object") throw new Error("That file doesn't look like a Workshop AI profile.");
    if (data.type && data.type !== "workshop-ai-profile") {
      throw new Error(data.type === "workshop-backup" ? "That's a whole Workshop backup file, not an AI profile \u2014 import it from Settings instead." : "That file doesn't look like a Workshop AI profile.");
    }
    const source = data.profile ?? data; // tolerate a bare profile object too, not only the wrapped envelope
    if (!source || typeof source !== "object" || (!source.identity && !source.traits && !source.behaviourConfig)) {
      throw new Error("That file doesn't look like a Workshop AI profile.");
    }

    const profile = this._buildProfile(source.name ? `${source.name} (imported)` : "Imported Resident");
    profile.model = source.model ?? null;
    profile.provider = normalizeProviderId(source.provider);
    profile.identity = { ...DEFAULT_IDENTITY, ...source.identity };
    profile.behaviourConfig = { ...DEFAULT_BEHAVIOUR_CONFIG, ...source.behaviourConfig, dials: normalizeDialsConfig(source.behaviourConfig?.dials) };
    profile.traits = normalizeTraitConfig(source.traits);
    profile.memory = normalizeMemoryConfig(source.memory);
    profile.embodiment = normalizeEmbodimentConfig(source.embodiment);
    // Version 3, Phase 8b — an imported profile's own granted functions
    // travel with it, normalised the same defensive way every other
    // field here is; an older export with no `functions` field at all
    // simply gets today's all-granted default, same as a brand new
    // profile would.
    profile.functions = normalizeFunctionsConfig(source.functions);
    // Carried over honestly, not resolved against anything here — this
    // store has no reference to ExpressionSetStore.js, and shouldn't
    // need one just to import a profile. If the referenced set doesn't
    // actually exist wherever this profile lands (a different Workshop,
    // or this same one after that set was since deleted),
    // ResidentController.js's own resolution already falls back to the
    // built-in procedural face automatically — see ResidentRenderer
    // .setExpressionSet()'s own comment.
    profile.expressionSetId = typeof source.expressionSetId === "string" ? source.expressionSetId : "default";

    this.profiles[profile.id] = profile;
    this.activeProfileId = profile.id;
    this._emitChanged();
    return profile;
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { profiles: this.profiles, activeProfileId: this.activeProfileId };
  }

  load(data) {
    if (!data?.profiles || Object.keys(data.profiles).length === 0) return;
    this.profiles = data.profiles;
    // Normalising memory/embodiment/traits/provider/dials on load, not
    // just on update(), covers a profile saved by an older version of
    // this store before a new field existed — it always ends up with
    // every current field's own sensible default rather than `undefined`.
    for (const profile of Object.values(this.profiles)) {
      profile.memory = normalizeMemoryConfig(profile.memory);
      profile.embodiment = normalizeEmbodimentConfig(profile.embodiment);
      profile.functions = normalizeFunctionsConfig(profile.functions);
      profile.traits = normalizeTraitConfig(profile.traits);
      profile.provider = normalizeProviderId(profile.provider);
      profile.identity = { ...DEFAULT_IDENTITY, ...profile.identity };
      profile.behaviourConfig = { ...DEFAULT_BEHAVIOUR_CONFIG, ...profile.behaviourConfig, dials: normalizeDialsConfig(profile.behaviourConfig?.dials) };
      profile.expressionSetId = profile.expressionSetId ?? "default";
    }
    this.activeProfileId = data.activeProfileId && this.profiles[data.activeProfileId] ? data.activeProfileId : Object.keys(this.profiles)[0];
    this.events.emit("residents:changed");
  }
}

export { DEFAULT_BEHAVIOUR_CONFIG };
