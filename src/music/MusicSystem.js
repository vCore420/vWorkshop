import { HandleStore } from "./HandleStore.js";
import { scanRoot, resolveFile, resolveCoverFile } from "./LibraryScanner.js";

const PLAY_COUNT_THRESHOLD_SECONDS = 20; // a skip within the first 20s doesn't count as "played"
const COVER_CACHE_LIMIT = 60;

/**
 * MusicSystem
 * -------------
 * Owns the one real `<audio>` element in the workshop and everything about
 * what it's doing — the queue, shuffle/repeat, volume, and which song is
 * current. This is a permanent Engine system, not something tied to
 * whether the music overlay happens to be open: playback continues exactly
 * as it would on a real device, whether you're standing at the stereo,
 * walking across the room, or out in the world (see `docs/MUSIC.md`).
 *
 * Nothing here is stereo-specific. Any interactable — the stereo today, a
 * future Builder object with a `musicPlayer` behaviour tomorrow — opens
 * the exact same UI the exact same way: by triggering the `"music"`
 * overlay (see `src/entities/furniture/StereoPlayer.js` and
 * `src/worldbuilder/behaviours/MusicPlayerBehaviour.js`, which do nothing
 * but that).
 */
export class MusicSystem {
  constructor({ libraryStore, playlistStore }) {
    this.libraryStore = libraryStore;
    this.playlistStore = playlistStore;
    this.handleStore = new HandleStore();

    this.queue = []; // song ids, in "natural" (unshuffled) order
    this.playOrder = []; // indices into `queue`; shuffled or identity, depending on `shuffle`
    this.queuePosition = -1; // index into `playOrder`
    this.shuffle = false;
    this.repeat = "off"; // "off" | "all" | "one"
    this.isPlaying = false;
    this.volume = 0.7;
    this.muted = false;

    this._rootHandleCache = new Map(); // rootId -> live FileSystemDirectoryHandle
    this._rootStatus = new Map(); // rootId -> "granted" | "needs-permission" | "missing" | "scanning" | "error"
    this._coverCache = new Map(); // albumId -> object URL
    this._currentObjectUrl = null;
    this._playCounted = false;
    this._pendingRestore = null; // {queue, queuePosition, shuffle, repeat, position, wasPlaying} from a loaded save, applied once metadata is ready
  }

  async init(engine) {
    this.engine = engine;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.volume = this.volume;

    this.audio.addEventListener("ended", () => this._onEnded());
    this.audio.addEventListener("timeupdate", () => this._onTimeUpdate());
    this.audio.addEventListener("loadedmetadata", () => this._onLoadedMetadata());

    engine.events.on("persistence:save", (bag) => {
      bag.music = {
        queue: this.queue,
        queuePosition: this.queuePosition,
        shuffle: this.shuffle,
        repeat: this.repeat,
        volume: this.volume,
        muted: this.muted,
        position: this.audio.currentTime || 0,
        wasPlaying: this.isPlaying,
      };
    });
    engine.events.on("persistence:load", (bag) => {
      if (!bag?.music) return;
      this._pendingRestore = bag.music;
      this.volume = bag.music.volume ?? this.volume;
      this.muted = !!bag.music.muted;
      this.shuffle = !!bag.music.shuffle;
      this.repeat = bag.music.repeat ?? "off";
      this.audio.volume = this.muted ? 0 : this.volume;
    });

    // Root status-checking and queue restoration both happen in
    // finalizeInitialState() instead of here — at this point in engine
    // startup, persistence:load hasn't actually fired yet (it happens
    // synchronously during "engine:ready", which is emitted only *after*
    // every system's init() has already run), so libraryStore.roots would
    // still be empty if read right now. See main.js.
  }

  /** Called once from main.js, after engine.init() has fully resolved — see
   *  the identical pattern (and the same underlying reason) documented on
   *  WorkbenchSystem.finalizeInitialState(). */
  async finalizeInitialState() {
    for (const root of this.libraryStore.roots) {
      const state = await this.handleStore.permissionState(root.id);
      this._rootStatus.set(root.id, state);
    }
    this.engine.events.emit("music:rootsChanged");

    const restore = this._pendingRestore;
    this._pendingRestore = null;
    if (!restore || !Array.isArray(restore.queue) || restore.queue.length === 0) return;

    this.queue = restore.queue.filter((id) => this.libraryStore.getSong(id));
    if (this.queue.length === 0) return;
    this._rebuildPlayOrder();
    this.queuePosition = Math.max(0, Math.min(restore.queuePosition ?? 0, this.playOrder.length - 1));
    this._restoredPosition = restore.position || 0;
    this._loadCurrentSong({ autoplay: false, seekTo: this._restoredPosition });
  }

  // ---------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------

  /** The one entry point every browsing view uses: "play this song, and
   *  queue up the rest of whatever list it came from." */
  playFromList(songIds, songId) {
    const index = songIds.indexOf(songId);
    this.playQueue(songIds, Math.max(0, index));
  }

  playQueue(songIds, startIndex = 0) {
    this.queue = [...songIds];
    this._rebuildPlayOrder();
    this.queuePosition = this.playOrder.indexOf(startIndex);
    if (this.queuePosition === -1) this.queuePosition = 0;
    this._loadCurrentSong({ autoplay: true });
  }

  togglePlayPause() {
    if (!this.currentSongId) return;
    if (this.isPlaying) this.pause();
    else this.resume();
  }

  resume() {
    if (!this.audio.src) return;
    this.audio.play().catch(() => {}); // browser autoplay rejection is expected if this wasn't a real gesture; UI just stays paused
    this.isPlaying = true;
    this._emitPlaybackState();
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this._emitPlaybackState();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this._emitPlaybackState();
  }

  next() {
    if (this.playOrder.length === 0) return;
    if (this.queuePosition < this.playOrder.length - 1) {
      this.queuePosition += 1;
    } else if (this.repeat === "all") {
      this.queuePosition = 0;
    } else {
      return; // end of queue, nothing to repeat
    }
    this._loadCurrentSong({ autoplay: this.isPlaying });
  }

  previous() {
    if (this.playOrder.length === 0) return;
    // A real "previous" restarts the current track once you're a few
    // seconds in, matching how every physical and software player behaves.
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.queuePosition > 0) this.queuePosition -= 1;
    else if (this.repeat === "all") this.queuePosition = this.playOrder.length - 1;
    else {
      this.audio.currentTime = 0;
      return;
    }
    this._loadCurrentSong({ autoplay: this.isPlaying });
  }

  seekTo(seconds) {
    if (!Number.isFinite(seconds)) return;
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.muted = false;
    this.audio.volume = this.volume;
    this._emitPlaybackState();
    this.engine.events.emit("persistence:saveRequested");
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.volume = this.muted ? 0 : this.volume;
    this._emitPlaybackState();
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this._rebuildPlayOrder(this.currentSongId);
    this._emitPlaybackState();
    this.engine.events.emit("persistence:saveRequested");
  }

  /** off -> all -> one -> off */
  cycleRepeat() {
    this.repeat = { off: "all", all: "one", one: "off" }[this.repeat];
    this._emitPlaybackState();
    this.engine.events.emit("persistence:saveRequested");
  }

  /** Inserts right after the currently playing song. */
  addNext(songId) {
    if (!this.libraryStore.getSong(songId)) return;
    const insertAt = this.queue.length ? this.queue.indexOf(this.currentSongId) + 1 : 0;
    this.queue.splice(insertAt, 0, songId);
    this._rebuildPlayOrder(this.currentSongId);
    this.engine.events.emit("music:queueChanged");
  }

  addToEndOfQueue(songId) {
    if (!this.libraryStore.getSong(songId)) return;
    this.queue.push(songId);
    this._rebuildPlayOrder(this.currentSongId);
    this.engine.events.emit("music:queueChanged");
  }

  get currentSongId() {
    if (this.queuePosition < 0 || this.queuePosition >= this.playOrder.length) return null;
    return this.queue[this.playOrder[this.queuePosition]] ?? null;
  }

  get currentSong() {
    const id = this.currentSongId;
    return id ? this.libraryStore.getSong(id) : null;
  }

  /** The queue in actual upcoming playback order, from the current position on. */
  upcomingQueue() {
    return this.playOrder.slice(this.queuePosition + 1).map((i) => this.queue[i]).filter(Boolean);
  }

  _rebuildPlayOrder(preserveSongId = null) {
    const indices = this.queue.map((_, i) => i);
    if (this.shuffle) shuffleInPlace(indices);
    this.playOrder = indices;
    if (preserveSongId != null) {
      const queueIdx = this.queue.indexOf(preserveSongId);
      const orderIdx = this.playOrder.indexOf(queueIdx);
      this.queuePosition = orderIdx === -1 ? 0 : orderIdx;
    }
  }

  async _loadCurrentSong({ autoplay, seekTo = 0 } = {}) {
    if (this._currentObjectUrl) {
      URL.revokeObjectURL(this._currentObjectUrl);
      this._currentObjectUrl = null;
    }
    this._playCounted = false;

    const song = this.currentSong;
    this.engine.events.emit("music:trackChanged");
    this.engine.events.emit("music:queueChanged");
    if (!song) return;

    const rootHandle = await this._resolveRootHandle(song.rootId);
    if (!rootHandle) {
      // Can't play right now (root not connected) — leave state pointing at
      // the song so the UI can show what *should* be playing and offer to
      // reconnect, rather than silently losing your place.
      this.isPlaying = false;
      this._emitPlaybackState();
      return;
    }

    const file = await resolveFile(rootHandle, song.artist, this.libraryStore.getAlbum(song.album)?.name ?? "", song.filename);
    if (!file) {
      this.isPlaying = false;
      this._emitPlaybackState();
      return;
    }

    this._currentObjectUrl = URL.createObjectURL(file);
    this.audio.src = this._currentObjectUrl;
    if (seekTo > 0) {
      const onReady = () => {
        this.audio.currentTime = seekTo;
        this.audio.removeEventListener("loadedmetadata", onReady);
      };
      this.audio.addEventListener("loadedmetadata", onReady);
    }

    if (autoplay) {
      this.isPlaying = true;
      this.audio.play().catch(() => {
        this.isPlaying = false;
        this._emitPlaybackState();
      });
    } else {
      this.isPlaying = false;
    }
    this._emitPlaybackState();
  }

  _onEnded() {
    if (!this._playCounted) this._countPlay();
    if (this.repeat === "one") {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
      return;
    }
    if (this.queuePosition >= this.playOrder.length - 1 && this.repeat !== "all") {
      this.isPlaying = false;
      this._emitPlaybackState();
      return;
    }
    this.next();
  }

  _onTimeUpdate() {
    if (!this._playCounted && this.currentSong) {
      const threshold = Math.min(PLAY_COUNT_THRESHOLD_SECONDS, (this.audio.duration || Infinity) * 0.5);
      if (this.audio.currentTime >= threshold) this._countPlay();
    }
    this.engine.events.emit("music:timeUpdate", { currentTime: this.audio.currentTime, duration: this.audio.duration || 0 });
  }

  _onLoadedMetadata() {
    const song = this.currentSong;
    if (song && (song.duration == null || Math.abs(song.duration - this.audio.duration) > 0.5)) {
      this.libraryStore.setSongDuration(song.id, this.audio.duration);
    }
  }

  _countPlay() {
    this._playCounted = true;
    if (this.currentSongId) this.libraryStore.recordPlay(this.currentSongId);
  }

  _emitPlaybackState() {
    this.engine.events.emit("music:playbackStateChanged");
  }

  // ---------------------------------------------------------------------
  // Library roots
  // ---------------------------------------------------------------------

  isScanningSupported() {
    return typeof window.showDirectoryPicker === "function";
  }

  /** Must be called from inside a user-gesture handler (a click). */
  async addRootViaPicker() {
    if (!this.isScanningSupported()) throw new Error("This browser doesn't support folder scanning (see docs/MUSIC.md).");
    const handle = await window.showDirectoryPicker({ id: "workshop-music", mode: "read" });
    const rootId = this.libraryStore.addRoot(handle.name);
    await this.handleStore.put(rootId, handle);
    this._rootHandleCache.set(rootId, handle);
    await this.rescanRoot(rootId);
    return rootId;
  }

  async rescanRoot(rootId) {
    this._rootStatus.set(rootId, "scanning");
    this.engine.events.emit("music:rootsChanged");
    try {
      const handle = await this._resolveRootHandle(rootId);
      if (!handle) {
        this._rootStatus.set(rootId, "needs-permission");
        this.engine.events.emit("music:rootsChanged");
        return;
      }
      const scanned = await scanRoot(handle);
      this.libraryStore.mergeScan(rootId, scanned);
      this._rootStatus.set(rootId, "granted");
    } catch (err) {
      console.error("[MusicSystem] scan failed:", err);
      this._rootStatus.set(rootId, "error");
    }
    this.engine.events.emit("music:rootsChanged");
  }

  /** Must be called from inside a user-gesture handler (a click). */
  async reconnectRoot(rootId) {
    const granted = await this.handleStore.requestPermission(rootId);
    if (granted) {
      this._rootHandleCache.delete(rootId);
      await this.rescanRoot(rootId);
    } else {
      this._rootStatus.set(rootId, "needs-permission");
      this.engine.events.emit("music:rootsChanged");
    }
    return granted;
  }

  async removeRoot(rootId) {
    this._rootHandleCache.delete(rootId);
    this._rootStatus.delete(rootId);
    await this.handleStore.remove(rootId);
    this.libraryStore.removeRoot(rootId);
    this.engine.events.emit("music:rootsChanged");
  }

  getRootStatus(rootId) {
    return this._rootStatus.get(rootId) ?? "missing";
  }

  async _resolveRootHandle(rootId) {
    if (this._rootHandleCache.has(rootId)) return this._rootHandleCache.get(rootId);
    const handle = await this.handleStore.get(rootId);
    if (!handle) {
      this._rootStatus.set(rootId, "missing");
      return null;
    }
    const state = await handle.queryPermission({ mode: "read" });
    if (state !== "granted") {
      this._rootStatus.set(rootId, "needs-permission");
      return null;
    }
    this._rootHandleCache.set(rootId, handle);
    return handle;
  }

  // ---------------------------------------------------------------------
  // Duration + cover art (both resolved lazily, on demand from the UI)
  // ---------------------------------------------------------------------

  async resolveDuration(songId) {
    const song = this.libraryStore.getSong(songId);
    if (!song || song.duration != null) return;
    const rootHandle = await this._resolveRootHandle(song.rootId);
    if (!rootHandle) return;
    const file = await resolveFile(rootHandle, song.artist, this.libraryStore.getAlbum(song.album)?.name ?? "", song.filename);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = "metadata";
    await new Promise((resolve) => {
      probe.addEventListener("loadedmetadata", resolve, { once: true });
      probe.addEventListener("error", resolve, { once: true });
      probe.src = url;
    });
    if (Number.isFinite(probe.duration)) this.libraryStore.setSongDuration(songId, probe.duration);
    URL.revokeObjectURL(url);
  }

  async getCoverUrl(albumId) {
    if (this._coverCache.has(albumId)) return this._coverCache.get(albumId);
    const album = this.libraryStore.getAlbum(albumId);
    if (!album?.hasCover) return null;
    const rootHandle = await this._resolveRootHandle(album.rootId);
    if (!rootHandle) return null;
    const file = await resolveCoverFile(rootHandle, album.artist, album.name);
    if (!file) return null;

    if (this._coverCache.size >= COVER_CACHE_LIMIT) {
      const oldestKey = this._coverCache.keys().next().value;
      URL.revokeObjectURL(this._coverCache.get(oldestKey));
      this._coverCache.delete(oldestKey);
    }
    const url = URL.createObjectURL(file);
    this._coverCache.set(albumId, url);
    return url;
  }

  update(_dt) {}
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
