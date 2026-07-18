import { HandleStore } from "./HandleStore.js";
import { scanRoot, resolveFile, resolveCoverFile } from "./LibraryScanner.js";

const PLAY_COUNT_THRESHOLD_SECONDS = 20; // a skip within the first 20s doesn't count as "played"
const COVER_CACHE_LIMIT = 60;
const MAX_CONCURRENT_DURATION_PROBES = 3; // see resolveDuration's own comment

/**
 * MusicSystem
 * -------------
 * Owns the one real `<audio>` element in the workshop and everything about
 * what it's doing — the queue, shuffle/repeat, volume, and which song is
 * current. This is a permanent Engine system, not something tied to
 * whether the music overlay happens to be open: playback continues
 * exactly as it would on a real device, whether you're standing at the
 * music cabinet, walking across the room, or out in the world (see
 * `docs/MUSIC.md`).
 *
 * Nothing here is specific to any one object. Any interactable — the
 * music cabinet today, a future Builder object with a `musicPlayer`
 * behaviour tomorrow — opens the exact same UI the exact same way: by
 * triggering the `"music"` overlay (see
 * `src/entities/furniture/MusicCabinet.js` and
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
    // Version 3, Phase 4 ("Workshop Rituals") — "turning on the radio."
    // `wasPlaying` has been captured into every save since this system
    // existed, and never once read back — playback always restores
    // paused (the browser's own autoplay policy leaves no honest
    // alternative; see docs/MUSIC.md). This is that flag's first real
    // reader: true for exactly the moment between a session restoring a
    // paused-but-loaded queue and the player's first real playback
    // action, so the UI (see PlaybackBar.js) can offer "pick up where
    // you left off" as a genuine invitation rather than the queue simply
    // looking coincidentally ready. Cleared the instant that first real
    // action happens — resuming, choosing something else, skipping —
    // never left showing once it's no longer true.
    this.wasPlayingLastSession = false;
    this.playbackError = null; // set by _onPlaybackError() — a plain, honest message for the UI, cleared the moment a track actually starts playing successfully
    this.volume = 0.7;
    this.muted = false;
    // Settings app's Audio tab (master x music) — layered on top of the
    // volume slider in the player itself, applied via _applyVolume()
    // rather than each volume-related call site computing it separately.
    this._settingsMultiplier = 1;

    this._rootHandleCache = new Map(); // rootId -> live FileSystemDirectoryHandle
    this._rootStatus = new Map(); // rootId -> "granted" | "needs-permission" | "missing" | "scanning" | "error"
    this._coverCache = new Map(); // albumId -> object URL
    this._currentObjectUrl = null;
    this._playCounted = false;
    this._pendingRestore = null; // {queue, queuePosition, shuffle, repeat, position, wasPlaying} from a loaded save, applied once metadata is ready

    // Duration resolution — see resolveDuration()'s own comment for why
    // this needs to be a small, reusable pool rather than "one new Audio()
    // per song".
    this._durationProbePool = []; // reusable, idle <audio> elements
    this._durationActiveCount = 0;
    this._durationQueue = []; // [{songId, resolve}]
    this._durationQueued = new Set(); // songIds already queued or in flight, to skip duplicate enqueues
  }

  async init(engine) {
    this.engine = engine;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this._applyVolume();

    this.audio.addEventListener("ended", () => this._onEnded());
    this.audio.addEventListener("timeupdate", () => this._onTimeUpdate());
    this.audio.addEventListener("loadedmetadata", () => this._onLoadedMetadata());
    // "Music loading behaves differently between Chromium, Firefox and
    // Safari" — different browsers support different audio codecs, so a
    // track that plays fine in one can genuinely fail to decode in
    // another. Previously nothing here listened for that at all — a
    // failed track left isPlaying stuck true with nothing actually
    // playing and no explanation. playbackError carries a plain, honest
    // message the UI can show (MediaApp.js's own now-playing display),
    // the same shape EnvironmentSystem.liveError already establishes for
    // "this failed, and here's why, without treating it as a crash."
    this.audio.addEventListener("error", () => this._onPlaybackError());

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
      this._applyVolume();
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
    this.wasPlayingLastSession = !!restore.wasPlaying;
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
    this.wasPlayingLastSession = false;
    this._loadCurrentSong({ autoplay: true });
  }

  togglePlayPause() {
    if (!this.currentSongId) return;
    if (this.isPlaying) this.pause();
    else this.resume();
  }

  resume() {
    // Cleared unconditionally, even if there's nothing to actually
    // resume (the root that had this song became unreachable between
    // sessions, say) — a "pick up where you left off" invitation that
    // silently does nothing when clicked should still go away, not sit
    // there forever offering something it can no longer deliver.
    this.wasPlayingLastSession = false;
    if (!this.audio.src) {
      this._emitPlaybackState(); // still tell the UI, so the now-cleared hint above actually disappears
      return;
    }
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
    this.wasPlayingLastSession = false;
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
    this.wasPlayingLastSession = false;
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
    this._applyVolume();
    this._emitPlaybackState();
    this.engine.events.emit("persistence:saveRequested");
  }

  /** Called by SettingsSystem whenever the Audio tab's master/music
   *  sliders change — layered on top of the player's own volume slider,
   *  not a replacement for it (same relationship AudioSystem's own
   *  multipliers have to its existing volume/balance choices). */
  setSettingsMultiplier(multiplier) {
    this._settingsMultiplier = multiplier;
    this._applyVolume();
  }

  _applyVolume() {
    this.audio.volume = (this.muted ? 0 : this.volume) * this._settingsMultiplier;
  }

  toggleMute() {
    this.muted = !this.muted;
    this._applyVolume();
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
    this.playbackError = null; // successfully decoding metadata means this track genuinely works in this browser
    const song = this.currentSong;
    if (song && (song.duration == null || Math.abs(song.duration - this.audio.duration) > 0.5)) {
      this.libraryStore.setSongDuration(song.id, this.audio.duration);
    }
  }

  /** "Music loading behaves differently between Chromium, Firefox and
   *  Safari" — most often a codec this particular browser simply can't
   *  decode, even though the same file plays fine elsewhere. Rather than
   *  leaving `isPlaying` stuck true with nothing actually audible,
   *  reports it plainly and skips ahead — the same "keep going, don't get
   *  stuck" instinct `_onEnded()` already has for repeat/queue exhaustion,
   *  just triggered by a decode failure instead of the track finishing. */
  _onPlaybackError() {
    const code = this.audio.error?.code;
    const reason =
      code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE
        ? "This browser can't play this track's audio format."
        : "This track couldn't be loaded.";
    this.playbackError = this.currentSong ? `${reason} (${this.currentSong.title})` : reason;
    this.isPlaying = false;
    this._emitPlaybackState();
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

  /**
   * Resolves and caches a song's duration, lazily, the first time it's
   * actually shown or played. Returns a promise that resolves once the
   * duration is known (or gives up) — callers (see ui/domHelpers.js's
   * buildSongRow) call this once per visible song row, with no shared
   * coordination between them, so a view showing a few hundred songs
   * calls this a few hundred times in a single burst.
   *
   * That used to mean a few hundred concurrent `new Audio()` probes, each
   * holding a real native media-decoder resource — which is exactly what
   * "Blocked attempt to create a WebMediaPlayer as there are too many
   * WebMediaPlayers already in existence" is Chrome protecting against.
   * Fixed with a small, bounded pool of reusable probe elements
   * (`MAX_CONCURRENT_DURATION_PROBES`) and a queue: however many songs
   * need a duration, at most that many temporary elements ever exist at
   * once, and each one is reused for the next song once it's done rather
   * than thrown away. See docs/MUSIC.md.
   */
  resolveDuration(songId) {
    if (this._durationQueued.has(songId)) return Promise.resolve();
    const song = this.libraryStore.getSong(songId);
    if (!song || song.duration != null) return Promise.resolve();
    this._durationQueued.add(songId);
    return new Promise((resolve) => {
      this._durationQueue.push({ songId, resolve });
      this._pumpDurationQueue();
    });
  }

  _pumpDurationQueue() {
    while (this._durationActiveCount < MAX_CONCURRENT_DURATION_PROBES && this._durationQueue.length > 0) {
      const { songId, resolve } = this._durationQueue.shift();
      this._durationActiveCount++;
      this._resolveOneDuration(songId)
        .catch((err) => console.warn(`[MusicSystem] duration probe failed for "${songId}":`, err))
        .finally(() => {
          this._durationActiveCount--;
          this._durationQueued.delete(songId);
          resolve();
          this._pumpDurationQueue();
        });
    }
  }

  async _resolveOneDuration(songId) {
    const song = this.libraryStore.getSong(songId);
    if (!song || song.duration != null) return;
    const rootHandle = await this._resolveRootHandle(song.rootId);
    if (!rootHandle) return;
    const file = await resolveFile(rootHandle, song.artist, this.libraryStore.getAlbum(song.album)?.name ?? "", song.filename);
    if (!file) return;

    const url = URL.createObjectURL(file);
    const probe = this._durationProbePool.pop() ?? new Audio();
    probe.preload = "metadata";
    try {
      await new Promise((resolveLoad) => {
        const onDone = () => {
          probe.removeEventListener("loadedmetadata", onDone);
          probe.removeEventListener("error", onDone);
          resolveLoad();
        };
        probe.addEventListener("loadedmetadata", onDone, { once: true });
        probe.addEventListener("error", onDone, { once: true });
        probe.src = url;
      });
      if (Number.isFinite(probe.duration)) this.libraryStore.setSongDuration(songId, probe.duration);
    } finally {
      probe.removeAttribute("src");
      probe.load(); // releases the previous src's underlying resource before this probe goes back in the pool
      URL.revokeObjectURL(url);
      this._durationProbePool.push(probe);
    }
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
