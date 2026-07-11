import { EventBus } from "../core/EventBus.js";
import { DEFAULT_BODY_MODEL, getBodyModel, getBodyModelList } from "./BodyModels.js";

/**
 * PlayerAppearanceStore
 * -----------------------
 * The appearance you're actually wearing right now — always persisted,
 * always what `PlayerCharacterSystem` renders. Distinct from `OutfitStore`
 * (named, saved snapshots you can load back later) the same way the
 * workbench's *current* project is distinct from the archive of finished
 * ones: this is live, continuously-edited state, not a collection.
 *
 * **Each body model keeps its own independent appearance**
 * (`appearanceByModel[modelId]`) — switching models restores whatever was
 * last being customised on that one, rather than overwriting it. `.appearance`
 * stays a plain property throughout, via a getter/setter that proxies to
 * `appearanceByModel[bodyModelId]` — every existing caller
 * (`PlayerCharacterSystem`, `WardrobeApp.js`) keeps reading/writing
 * `store.appearance` exactly as before, with zero changes needed on their
 * side; only this store itself needed to know there's more than one of
 * them now.
 *
 * `currentOutfitId` is remembered (not required) — editing the live
 * appearance doesn't silently rewrite a saved outfit; "Save" is always an
 * explicit action (see docs/PLAYER.md), the same way finishing a project
 * doesn't happen by accident either.
 */
export class PlayerAppearanceStore {
  constructor() {
    this.events = new EventBus();
    this.bodyModelId = DEFAULT_BODY_MODEL;
    this.appearanceByModel = {};
    for (const model of getBodyModelList()) this.appearanceByModel[model.id] = model.defaultAppearance();
    this.currentOutfitId = null;
    // "Allow imported Workshop models to become optional player models
    // through the Wardrobe system." `null` means "use the ordinary
    // procedural rig" (bodyModelId/appearance, above) — set, it replaces
    // the player's rendered body with that imported model instead; see
    // PlayerCharacterSystem.js's own _buildImportedModelRig() for the
    // honest limitation (renders correctly, doesn't animate through this
    // pose system, since it has none of the expected named pivots).
    this.importedModelId = null;
  }

  get appearance() {
    return this.appearanceByModel[this.bodyModelId];
  }

  set appearance(value) {
    this.appearanceByModel[this.bodyModelId] = value;
  }

  getPart(partId) {
    return this.appearance.parts[partId];
  }

  updatePart(partId, patch) {
    this.appearance.parts[partId] = { ...this.appearance.parts[partId], ...patch };
    this._emitChanged();
  }

  /** Replaces the entire live appearance (loading an outfit, say). */
  setAppearance(appearance, outfitId = null) {
    this.appearance = JSON.parse(JSON.stringify(appearance));
    this.currentOutfitId = outfitId;
    this._emitChanged();
  }

  /** Switches which body model is active, restoring *that* model's own
   *  independently-maintained appearance — "switching between body models
   *  should simply restore that model's saved appearance rather than
   *  losing previous work." An outfit is tied to the model it was saved
   *  from (see OutfitStore.js), so switching models directly (not via
   *  loading an outfit) clears the remembered outfit id rather than
   *  leaving it pointing at a snapshot for a different model's
   *  proportions. */
  setBodyModel(bodyModelId) {
    if (bodyModelId === this.bodyModelId || !getBodyModel(bodyModelId)) return;
    if (!this.appearanceByModel[bodyModelId]) this.appearanceByModel[bodyModelId] = getBodyModel(bodyModelId).defaultAppearance();
    this.bodyModelId = bodyModelId;
    this.currentOutfitId = null;
    this._emitChanged();
  }

  /** `modelId` from ModelLibrary, or `null` to go back to the ordinary
   *  procedural rig. */
  setImportedModel(modelId) {
    if (modelId === this.importedModelId) return;
    this.importedModelId = modelId;
    this._emitChanged();
  }

  /** Used by the Settings app's Danger Zone ("Reset Player Data") — back
   *  to the default figure for every body model, wearing nothing
   *  customised. Doesn't touch TextureStore itself; the caller is
   *  responsible for cleaning up any textures this appearance (and every
   *  saved outfit) referenced, since this store has no reference to
   *  OutfitStore/TextureStore to check "is this texture still used
   *  elsewhere" against on its own. */
  resetToDefaults() {
    this.bodyModelId = DEFAULT_BODY_MODEL;
    this.appearanceByModel = {};
    for (const model of getBodyModelList()) this.appearanceByModel[model.id] = model.defaultAppearance();
    this.currentOutfitId = null;
    this._emitChanged();
  }

  /** A deep copy, safe for an OutfitStore snapshot to own independently of further live edits. */
  snapshot() {
    return JSON.parse(JSON.stringify(this.appearance));
  }

  _emitChanged() {
    this.events.emit("appearance:changed", this.appearance);
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { bodyModelId: this.bodyModelId, appearanceByModel: this.appearanceByModel, currentOutfitId: this.currentOutfitId, importedModelId: this.importedModelId };
  }

  load(data) {
    if (!data) return;
    this.importedModelId = data.importedModelId ?? null;
    if (data.appearanceByModel) {
      this.appearanceByModel = data.appearanceByModel;
      this.bodyModelId = data.bodyModelId ?? DEFAULT_BODY_MODEL;
    } else if (data.appearance) {
      // A save from before body models existed — becomes this model's own
      // appearance; every other model still starts at its own default,
      // the same graceful "a field simply absent from an old save is
      // handled the same way a first launch is" degradation every other
      // store in this project already follows.
      this.appearanceByModel[this.bodyModelId] = data.appearance;
    }
    this.currentOutfitId = data.currentOutfitId ?? null;
    this.events.emit("appearance:changed", this.appearance);
  }
}
