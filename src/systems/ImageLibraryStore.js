import { EventBus } from "../core/EventBus.js";

/**
 * ImageLibraryStore
 * -------------------
 * "Images should be loaded from the player's local files using the same
 * design philosophy as the Music Library wherever practical." The
 * specific piece of that philosophy this borrows: the library's own
 * index (what images exist, their names) is never the same store as the
 * actual bytes (see `ImageAssetStore.js`, the same
 * `HandleStore.js`/`TextureStore.js` split every binary asset in this
 * project already uses) — this stays ordinary JSON through the normal
 * `PersistenceSystem` path, small regardless of how large the images
 * themselves are.
 *
 * Deliberately much simpler than `MusicLibraryStore.js` — there's no
 * folder-scanning, no artist/album hierarchy, no play counts. One upload
 * is one entry; `DisplaySurfaceBehaviour.js` references it by id, the
 * same "select from a library" shape `AudioSourceBehaviour.js` already
 * established for tracks.
 */
export class ImageLibraryStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, {id:string, name:string, addedAt:number}>} */
    this.images = {};
  }

  add(name) {
    const id = `image-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    this.images[id] = { id, name, addedAt: Date.now() };
    this._emitChanged();
    return id;
  }

  rename(id, name) {
    const image = this.images[id];
    if (!image) return;
    image.name = name;
    this._emitChanged();
  }

  remove(id) {
    delete this.images[id];
    this._emitChanged();
  }

  get(id) {
    return this.images[id] ?? null;
  }

  all() {
    return Object.values(this.images).sort((a, b) => b.addedAt - a.addedAt);
  }

  _emitChanged() {
    this.events.emit("library:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { images: this.images };
  }

  load(data) {
    if (!data) return;
    this.images = data.images ?? {};
    this.events.emit("library:changed");
  }
}
