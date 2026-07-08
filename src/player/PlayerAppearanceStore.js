import { EventBus } from "../core/EventBus.js";
import { defaultAppearance } from "./PlayerCharacter.js";

/**
 * PlayerAppearanceStore
 * -----------------------
 * The appearance you're actually wearing right now — always persisted,
 * always what `PlayerCharacterSystem` renders. Distinct from `OutfitStore`
 * (named, saved snapshots you can load back later) the same way the
 * workbench's *current* project is distinct from the archive of finished
 * ones: this is live, continuously-edited state, not a collection.
 *
 * `currentOutfitId` is remembered (not required) — editing the live
 * appearance doesn't silently rewrite a saved outfit; "Save" is always an
 * explicit action (see docs/PLAYER.md), the same way finishing a project
 * doesn't happen by accident either.
 */
export class PlayerAppearanceStore {
  constructor() {
    this.events = new EventBus();
    this.appearance = defaultAppearance();
    this.currentOutfitId = null;
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

  /** Used by the Settings app's Danger Zone ("Reset Player Data") — back
   *  to the default figure, wearing nothing customised. Doesn't touch
   *  TextureStore itself; the caller is responsible for cleaning up any
   *  textures this appearance (and every saved outfit) referenced, since
   *  this store has no reference to OutfitStore/TextureStore to check
   *  "is this texture still used elsewhere" against on its own. */
  resetToDefaults() {
    this.appearance = defaultAppearance();
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
    return { appearance: this.appearance, currentOutfitId: this.currentOutfitId };
  }

  load(data) {
    if (!data?.appearance) return;
    this.appearance = data.appearance;
    this.currentOutfitId = data.currentOutfitId ?? null;
    this.events.emit("appearance:changed", this.appearance);
  }
}
