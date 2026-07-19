import { EventBus } from "../core/EventBus.js";
import { DEFAULT_BODY_MODEL } from "./BodyModels.js";
import { DEFAULT_OUTFITS } from "./DefaultOutfits.js";

let _nextId = 1;

/**
 * OutfitStore
 * -------------
 * Named, saved snapshots of a full appearance — proportions, colours,
 * materials, and texture references for every body part — following the
 * same create/rename/remove/duplicate shape `PlaylistStore` already
 * established for named, user-curated collections. `PlayerAppearanceStore`
 * is the live, currently-worn state; this is the wardrobe rail it can be
 * saved into and loaded back out of.
 *
 * Each outfit also remembers which body model it was saved for
 * (`bodyModelId`) — an outfit's proportions are relative to a specific
 * model's own base dimensions (see `BodyModels.js`), so loading one saved
 * on the feminine model while the masculine model is active needs to
 * switch models too, not just apply mismatched numbers to the wrong
 * proportions. `WardrobeApp.js` is what actually does that switch, using
 * this field to know it's needed.
 *
 * **Version 3, Phase 10 ("Real Assets, Honestly Introduced") — six
 * starter outfits, seeded by default.** See `DefaultOutfits.js` for the
 * presets themselves; string ids (`"default-outfit-..."`) rather than
 * this store's own auto-incrementing numeric ids, so they can never
 * collide with a player-created outfit's own id. Seeded directly here in
 * the constructor, the same timing `BlueprintStore.js` already
 * established (a brand-new session never reaches `load()` at all).
 * **Deliberately not reseeded on an empty `load()`**, unlike
 * `BlueprintStore.load()`'s own "genuinely zero saved data re-seeds the
 * starter set" rule — the Settings app's Danger Zone promises "every
 * saved outfit deleted... this can't be undone" for Reset Player Data
 * (see `SettingsApp.js`), and silently bringing the defaults back on the
 * next reload would break that promise outright. `load()` below already
 * gets this right without any special-casing: it only ever *replaces*
 * `this.outfits` when a save genuinely contains an `outfits` key
 * (`data.outfits` truthy, including a real empty array) — a save that
 * predates this feature entirely (`data.outfits` is `undefined`) leaves
 * the constructor's own seeded defaults standing untouched.
 */
export class OutfitStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{id:number|string, name:string, appearance:object, bodyModelId:string, createdAt:string, updatedAt:string}>} */
    this.outfits = [...DEFAULT_OUTFITS];
  }

  create(name, appearance, bodyModelId = DEFAULT_BODY_MODEL) {
    const outfit = {
      id: _nextId++,
      name: name?.trim() || "Untitled outfit",
      appearance: JSON.parse(JSON.stringify(appearance)),
      bodyModelId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.outfits.push(outfit);
    this._emitChanged();
    return outfit;
  }

  rename(id, name) {
    const outfit = this.get(id);
    if (!outfit) return;
    outfit.name = name?.trim() || outfit.name;
    outfit.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  /** Overwrites a saved outfit's appearance (and body model — "update"
   *  means "match my current appearance", whichever model that's on now)
   *  with the current live one — "Save" on an already-saved outfit, not a
   *  new one. */
  updateAppearance(id, appearance, bodyModelId = DEFAULT_BODY_MODEL) {
    const outfit = this.get(id);
    if (!outfit) return;
    outfit.appearance = JSON.parse(JSON.stringify(appearance));
    outfit.bodyModelId = bodyModelId;
    outfit.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  remove(id) {
    this.outfits = this.outfits.filter((o) => o.id !== id);
    this._emitChanged();
  }

  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const copy = this.create(`${source.name} copy`, source.appearance, source.bodyModelId);
    return copy;
  }

  get(id) {
    return this.outfits.find((o) => o.id === id) ?? null;
  }

  all() {
    return [...this.outfits];
  }

  /** Used by the Settings app's Danger Zone ("Reset Player Data") — every
   *  saved outfit gone. Doesn't touch TextureStore itself; see
   *  PlayerAppearanceStore.resetToDefaults()'s identical note. */
  resetToDefaults() {
    this.outfits = [];
    this._emitChanged();
  }

  /** Every distinct textureId referenced by any saved outfit — used by
   *  PlayerCharacterSystem to decide whether a texture is safe to actually
   *  delete from TextureStore when it stops being used anywhere. */
  allReferencedTextureIds() {
    const ids = new Set();
    for (const outfit of this.outfits) {
      for (const part of Object.values(outfit.appearance.parts)) {
        if (part.textureId) ids.add(part.textureId);
      }
    }
    return ids;
  }

  _emitChanged() {
    this.events.emit("outfits:changed", this.outfits);
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { outfits: this.outfits };
  }

  load(data) {
    if (!data?.outfits) return;
    // A save from before body models existed won't have bodyModelId on
    // any outfit — they were all saved against what's now the default
    // model, the same graceful degradation every other new field in this
    // project already gets.
    this.outfits = data.outfits.map((o) => ({ bodyModelId: DEFAULT_BODY_MODEL, ...o }));
    const maxId = this.outfits.reduce((m, o) => Math.max(m, o.id), 0);
    _nextId = maxId + 1;
    this.events.emit("outfits:changed", this.outfits);
  }
}
