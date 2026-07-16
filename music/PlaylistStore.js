import { EventBus } from "../core/EventBus.js";

let _nextId = 1;

/**
 * PlaylistStore
 * ---------------
 * User-curated collections of songs, kept deliberately separate from
 * `MusicLibraryStore` — a playlist is something a person builds on purpose;
 * the library index is something scanning discovers automatically. Same
 * relationship as `ProjectsStore` vs. the workbench's presence system:
 * different concerns, different stores, both plain JSON through the normal
 * `PersistenceSystem` path.
 */
export class PlaylistStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{id:number, name:string, songIds:string[], createdAt:string, updatedAt:string}>} */
    this.playlists = [];
  }

  create(name) {
    const playlist = {
      id: _nextId++,
      name: name?.trim() || "Untitled playlist",
      songIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.playlists.push(playlist);
    this._emitChanged();
    return playlist;
  }

  rename(id, name) {
    const playlist = this.get(id);
    if (!playlist) return;
    playlist.name = name?.trim() || playlist.name;
    playlist.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  remove(id) {
    this.playlists = this.playlists.filter((p) => p.id !== id);
    this._emitChanged();
  }

  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const copy = this.create(`${source.name} copy`);
    copy.songIds = [...source.songIds];
    this._emitChanged();
    return copy;
  }

  addSong(id, songId) {
    const playlist = this.get(id);
    if (!playlist || playlist.songIds.includes(songId)) return;
    playlist.songIds.push(songId);
    playlist.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  removeSong(id, songId) {
    const playlist = this.get(id);
    if (!playlist) return;
    playlist.songIds = playlist.songIds.filter((s) => s !== songId);
    playlist.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  /** Moves the song at `fromIndex` to `toIndex` within the playlist's order. */
  reorderSong(id, fromIndex, toIndex) {
    const playlist = this.get(id);
    if (!playlist) return;
    const [moved] = playlist.songIds.splice(fromIndex, 1);
    if (moved === undefined) return;
    playlist.songIds.splice(toIndex, 0, moved);
    playlist.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  get(id) {
    return this.playlists.find((p) => p.id === id) ?? null;
  }

  all() {
    return [...this.playlists];
  }

  _emitChanged() {
    this.events.emit("playlists:changed", this.playlists);
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { playlists: this.playlists };
  }

  load(data) {
    if (!data?.playlists) return;
    this.playlists = data.playlists;
    const maxId = this.playlists.reduce((m, p) => Math.max(m, p.id), 0);
    _nextId = maxId + 1;
    this.events.emit("playlists:changed", this.playlists);
  }
}
