import { EventBus } from "../core/EventBus.js";

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
 */
export class OutfitStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{id:number, name:string, appearance:object, createdAt:string, updatedAt:string}>} */
    this.outfits = [];
  }

  create(name, appearance) {
    const outfit = {
      id: _nextId++,
      name: name?.trim() || "Untitled outfit",
      appearance: JSON.parse(JSON.stringify(appearance)),
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

  /** Overwrites a saved outfit's appearance with the current live one — "Save" on an already-saved outfit, not a new one. */
  updateAppearance(id, appearance) {
    const outfit = this.get(id);
    if (!outfit) return;
    outfit.appearance = JSON.parse(JSON.stringify(appearance));
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
    const copy = this.create(`${source.name} copy`, source.appearance);
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
    this.outfits = data.outfits;
    const maxId = this.outfits.reduce((m, o) => Math.max(m, o.id), 0);
    _nextId = maxId + 1;
    this.events.emit("outfits:changed", this.outfits);
  }
}
