import { EventBus } from "../core/EventBus.js";

/**
 * ModelLibrary
 * --------------
 * "Models should not belong only to Beings. Instead, imported models
 * become Workshop assets that can later be reused by: Beings, Builder,
 * Player, Future systems." The same "index is never the same store as
 * the actual bytes" split every binary asset in this project already
 * uses (see `ImageLibraryStore.js`'s own comment) — this stays ordinary
 * JSON through the normal `PersistenceSystem` path, small regardless of
 * how large the models themselves are; `ModelAssetStore.js` holds the
 * real file data.
 *
 * Deliberately knows nothing about Beings specifically — `format`
 * (`"glb"` | `"gltf"`) is the only thing beyond a plain name this index
 * needs, since *how* a model gets used (as a Being's body, a Builder
 * shape, a future player accessory) is entirely up to whichever system
 * resolves it through `ModelLoader.js`, not something this library
 * itself should know or care about.
 */
export class ModelLibrary {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, {id:string, name:string, format:string, addedAt:number}>} */
    this.models = {};
  }

  add(name, format) {
    const id = `model-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    this.models[id] = { id, name, format, addedAt: Date.now() };
    this._emitChanged();
    return id;
  }

  rename(id, name) {
    const model = this.models[id];
    if (!model) return;
    model.name = name;
    this._emitChanged();
  }

  remove(id) {
    delete this.models[id];
    this._emitChanged();
  }

  get(id) {
    return this.models[id] ?? null;
  }

  all() {
    return Object.values(this.models).sort((a, b) => b.addedAt - a.addedAt);
  }

  _emitChanged() {
    this.events.emit("library:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { models: this.models };
  }

  load(data) {
    if (!data) return;
    this.models = data.models ?? {};
    this.events.emit("library:changed");
  }
}
