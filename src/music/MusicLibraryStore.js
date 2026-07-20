import { EventBus } from "../core/EventBus.js";

/**
 * MusicLibraryStore
 * -------------------
 * The library's index: what artists, albums, and songs exist, and how the
 * person has used them (favourites, play counts, recently played) — never
 * the audio bytes themselves (see `HandleStore.js` for why that's a
 * separate, IndexedDB-based store).
 *
 * IDs are deterministic, path-shaped strings derived from folder/file
 * names — `"Artist"`, `"Artist/Album"`, `"Artist/Album/song.mp3"` — not
 * auto-incrementing numbers. Three things fall out of that for free:
 *
 *   - Re-scanning a root is naturally idempotent: the same file always
 *     produces the same id, so `LibraryScanner` can tell "already knew
 *     about this" from "genuinely new" without keeping a separate mapping.
 *   - Favourites/play-counts/recently-played, keyed by these same ids,
 *     survive a rescan untouched even though the artists/albums/songs
 *     index itself gets rebuilt — they're stored in entirely separate maps
 *     that a rescan never touches.
 *   - An artist (or album) with the same name found under two different
 *     root folders merges into one entry automatically, which matches how
 *     the brief frames the folder structure as "the primary source of
 *     organisation" — a person's library is one library, however many
 *     folders it's spread across.
 *
 * See `docs/MUSIC.md` for the full shape of a song/album/artist record and
 * why duration is resolved lazily rather than during scanning.
 */
export class MusicLibraryStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{id:string, name:string, kind:string}>} */
    this.roots = [];
    /** @type {Record<string, {name:string, albumIds:string[]}>} */
    this.artists = {};
    /** @type {Record<string, {id:string, artist:string, name:string, hasCover:boolean, rootId:string, songIds:string[]}>} */
    this.albums = {};
    /** @type {Record<string, {id:string, artist:string, album:string, filename:string, title:string, rootId:string, duration:number|null}>} */
    this.songs = {};
    /** @type {Record<string, number>} */
    this.playCounts = {};
    /** @type {string[]} */
    this.favourites = [];
    /** @type {string[]} most-recent first */
    this.recentlyPlayed = [];
  }

  // ---- roots ----

  /** `kind` distinguishes a real, reopenable `FileSystemDirectoryHandle`
   *  root ("handle", the default) from a Phase 12 fallback root built
   *  from an ordinary file picker ("memory" — see
   *  `MemoryDirectoryHandle.js`), which can't be silently reconnected
   *  next session and needs its own "re-select" UI instead of
   *  "reconnect" (see `LibraryManager.js`). */
  addRoot(name, kind = "handle") {
    const id = `root-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    this.roots.push({ id, name, kind });
    this._emitChanged();
    return id;
  }

  removeRoot(rootId) {
    this.roots = this.roots.filter((r) => r.id !== rootId);
    // Drop everything that came from this root. An artist/album that also
    // has content in another root simply loses those specific entries.
    for (const [songId, song] of Object.entries(this.songs)) {
      if (song.rootId === rootId) delete this.songs[songId];
    }
    for (const [albumId, album] of Object.entries(this.albums)) {
      album.songIds = album.songIds.filter((id) => this.songs[id]);
      if (album.rootId === rootId && album.songIds.length === 0) delete this.albums[albumId];
    }
    for (const [artistName, artist] of Object.entries(this.artists)) {
      artist.albumIds = artist.albumIds.filter((id) => this.albums[id]);
      if (artist.albumIds.length === 0) delete this.artists[artistName];
    }
    this._emitChanged();
  }

  // ---- merging a scan result (see LibraryScanner.js) ----

  /**
   * Merges a fresh scan of one root into the library, adding new artists/
   * albums/songs, updating ones that still exist (preserving any already-
   * cached `duration`), and removing ones that disappeared. Never touches
   * `favourites`/`playCounts`/`recentlyPlayed` — see the class comment.
   */
  mergeScan(rootId, scannedArtists) {
    const seenSongIds = new Set();
    const seenAlbumIds = new Set();
    const seenArtistNames = new Set();

    for (const scannedArtist of scannedArtists) {
      seenArtistNames.add(scannedArtist.name);
      const artist = this.artists[scannedArtist.name] ?? { name: scannedArtist.name, albumIds: [] };
      this.artists[scannedArtist.name] = artist;

      for (const scannedAlbum of scannedArtist.albums) {
        const albumId = `${scannedArtist.name}/${scannedAlbum.name}`;
        seenAlbumIds.add(albumId);
        if (!artist.albumIds.includes(albumId)) artist.albumIds.push(albumId);

        const album = this.albums[albumId] ?? { id: albumId, artist: scannedArtist.name, name: scannedAlbum.name, hasCover: false, rootId, songIds: [] };
        album.hasCover = scannedAlbum.hasCover;
        album.rootId = rootId;
        album.songIds = [];
        this.albums[albumId] = album;

        for (const filename of scannedAlbum.songs) {
          const songId = `${albumId}/${filename}`;
          seenSongIds.add(songId);
          album.songIds.push(songId);
          const existing = this.songs[songId];
          this.songs[songId] = {
            id: songId,
            artist: scannedArtist.name,
            album: albumId,
            filename,
            title: stripExtension(filename),
            rootId,
            duration: existing?.duration ?? null,
          };
        }
      }
    }

    // Remove anything that belonged to this root but wasn't seen this time.
    for (const [songId, song] of Object.entries(this.songs)) {
      if (song.rootId === rootId && !seenSongIds.has(songId)) delete this.songs[songId];
    }
    for (const [albumId, album] of Object.entries(this.albums)) {
      if (album.rootId === rootId && !seenAlbumIds.has(albumId)) delete this.albums[albumId];
    }
    for (const [artistName, artist] of Object.entries(this.artists)) {
      artist.albumIds = artist.albumIds.filter((id) => this.albums[id]);
      if (artist.albumIds.length === 0 && !seenArtistNames.has(artistName)) delete this.artists[artistName];
    }

    this._emitChanged();
  }

  setSongDuration(songId, duration) {
    const song = this.songs[songId];
    if (!song) return;
    song.duration = duration;
    this.events.emit("library:changed"); // no persistence:saveRequested here — durations aren't worth an eager save
  }

  // ---- browsing helpers ----

  allArtists() {
    return Object.values(this.artists).sort((a, b) => a.name.localeCompare(b.name));
  }

  allAlbums() {
    return Object.values(this.albums).sort((a, b) => a.name.localeCompare(b.name));
  }

  allSongs() {
    return Object.values(this.songs).sort((a, b) => a.title.localeCompare(b.title));
  }

  albumsByArtist(artistName) {
    const artist = this.artists[artistName];
    if (!artist) return [];
    return artist.albumIds.map((id) => this.albums[id]).filter(Boolean);
  }

  songsByAlbum(albumId) {
    const album = this.albums[albumId];
    if (!album) return [];
    return album.songIds.map((id) => this.songs[id]).filter(Boolean);
  }

  getSong(songId) {
    return this.songs[songId] ?? null;
  }

  getAlbum(albumId) {
    return this.albums[albumId] ?? null;
  }

  recentlyAdded(limit = 40) {
    // Song ids embed no timestamp, so "added" order falls back to whatever
    // order merging discovered them in — good enough without maintaining a
    // separate added-at field for every song in a potentially large library.
    return Object.values(this.songs).slice(-limit).reverse();
  }

  recentlyPlayedSongs(limit = 40) {
    return this.recentlyPlayed.slice(0, limit).map((id) => this.songs[id]).filter(Boolean);
  }

  mostPlayedSongs(limit = 40) {
    return Object.entries(this.playCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.songs[id])
      .filter(Boolean);
  }

  favouriteSongs() {
    return this.favourites.map((id) => this.songs[id]).filter(Boolean);
  }

  isFavourite(songId) {
    return this.favourites.includes(songId);
  }

  toggleFavourite(songId) {
    if (this.favourites.includes(songId)) this.favourites = this.favourites.filter((id) => id !== songId);
    else this.favourites.unshift(songId);
    this._emitChanged();
  }

  /** Called by MusicSystem once a song has genuinely been listened to (not just skipped past). */
  recordPlay(songId) {
    this.playCounts[songId] = (this.playCounts[songId] ?? 0) + 1;
    this.recentlyPlayed = [songId, ...this.recentlyPlayed.filter((id) => id !== songId)].slice(0, 100);
    this._emitChanged();
  }

  /** Substring search across artists, albums, and songs — case-insensitive, unaccelerated (fine at personal-library scale). */
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return { artists: [], albums: [], songs: [] };
    return {
      artists: this.allArtists().filter((a) => a.name.toLowerCase().includes(q)),
      albums: this.allAlbums().filter((a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)),
      songs: this.allSongs().filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)),
    };
  }

  _emitChanged() {
    this.events.emit("library:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return {
      roots: this.roots,
      artists: this.artists,
      albums: this.albums,
      songs: this.songs,
      playCounts: this.playCounts,
      favourites: this.favourites,
      recentlyPlayed: this.recentlyPlayed,
    };
  }

  load(data) {
    if (!data) return;
    this.roots = data.roots ?? [];
    this.artists = data.artists ?? {};
    this.albums = data.albums ?? {};
    this.songs = data.songs ?? {};
    this.playCounts = data.playCounts ?? {};
    this.favourites = data.favourites ?? [];
    this.recentlyPlayed = data.recentlyPlayed ?? [];
    this.events.emit("library:changed");
  }
}

function stripExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}
