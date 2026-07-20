/**
 * domHelpers.js
 * ---------------
 * Small, framework-free rendering helpers shared by every music view
 * (Songs, an album's detail page, a playlist, search results, Favourites,
 * ...) so a song always looks and behaves the same regardless of which
 * list it's showing up in.
 */

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Renders one row for `song` into a `<li>`. `context.songIds` is the full
 * list this row belongs to (so clicking it queues the rest of the list,
 * via `MusicSystem.playFromList`) — every view passes its own full list,
 * even a search result or a single album's tracklist.
 *
 * Every row gets the same "\u22EF" menu (play next, add to queue, add to a
 * playlist) — queuing and playlist membership are universal capabilities,
 * not something only the playlist's own view offers. It expands inline
 * rather than floating, so there's no popover-positioning/clipping logic
 * to get wrong inside a scrolling list.
 *
 * `extraActions(song)` lets a view add its *own* trailing buttons on top of
 * that (a playlist's own "remove from this playlist", say).
 */
export function buildSongRow(song, { songIds, musicSystem, libraryStore, playlistStore, showAlbum = false, extraActions } = {}) {
  const li = document.createElement("li");
  li.className = "music-song-row";
  if (musicSystem.currentSongId === song.id) li.classList.add("current");

  const mainRow = document.createElement("div");
  mainRow.className = "music-song-row-main";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "music-song-play";
  playBtn.textContent = musicSystem.currentSongId === song.id && musicSystem.isPlaying ? "\u266B" : "\u25B6";
  playBtn.setAttribute("aria-label", `Play ${song.title}`);
  playBtn.addEventListener("click", () => musicSystem.playFromList(songIds, song.id));
  mainRow.appendChild(playBtn);

  const info = document.createElement("div");
  info.className = "music-song-info";
  const title = document.createElement("div");
  title.className = "music-song-title";
  title.textContent = song.title;
  info.appendChild(title);
  if (showAlbum) {
    const sub = document.createElement("div");
    sub.className = "music-song-sub";
    sub.textContent = `${song.artist} \u00b7 ${libraryStore.getAlbum(song.album)?.name ?? ""}`;
    info.appendChild(sub);
  }
  mainRow.appendChild(info);

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "music-song-fav";
  const setFavGlyph = () => {
    favBtn.textContent = libraryStore.isFavourite(song.id) ? "\u2665" : "\u2661";
    favBtn.classList.toggle("active", libraryStore.isFavourite(song.id));
  };
  setFavGlyph();
  favBtn.addEventListener("click", () => {
    libraryStore.toggleFavourite(song.id);
    setFavGlyph();
  });
  mainRow.appendChild(favBtn);

  const duration = document.createElement("span");
  duration.className = "music-song-duration";
  duration.textContent = formatTime(song.duration);
  mainRow.appendChild(duration);
  if (song.duration == null) musicSystem.resolveDuration(song.id).then(() => {
    duration.textContent = formatTime(libraryStore.getSong(song.id)?.duration);
  });

  if (extraActions) {
    for (const btn of extraActions(song)) mainRow.appendChild(btn);
  }

  if (playlistStore) {
    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "music-song-menu-toggle";
    menuBtn.textContent = "\u22EF";
    menuBtn.setAttribute("aria-label", "More actions");
    mainRow.appendChild(menuBtn);

    const menu = buildSongMenu(song, { musicSystem, playlistStore });
    menuBtn.addEventListener("click", () => li.classList.toggle("menu-open"));
    li.append(mainRow, menu);
  } else {
    li.appendChild(mainRow);
  }

  return li;
}

function buildSongMenu(song, { musicSystem, playlistStore }) {
  const menu = document.createElement("div");
  menu.className = "music-song-menu";

  const playNextBtn = document.createElement("button");
  playNextBtn.type = "button";
  playNextBtn.textContent = "Play next";
  playNextBtn.addEventListener("click", () => musicSystem.addNext(song.id));
  menu.appendChild(playNextBtn);

  const queueEndBtn = document.createElement("button");
  queueEndBtn.type = "button";
  queueEndBtn.textContent = "Add to queue";
  queueEndBtn.addEventListener("click", () => musicSystem.addToEndOfQueue(song.id));
  menu.appendChild(queueEndBtn);

  const label = document.createElement("div");
  label.className = "music-song-menu-label";
  label.textContent = "Add to playlist";
  menu.appendChild(label);

  const renderPlaylistButtons = () => {
    menu.querySelectorAll(".music-song-menu-playlist").forEach((el) => el.remove());
    for (const playlist of playlistStore.all()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "music-song-menu-playlist";
      const already = playlist.songIds.includes(song.id);
      btn.textContent = already ? `\u2713 ${playlist.name}` : playlist.name;
      btn.disabled = already;
      btn.addEventListener("click", () => {
        playlistStore.addSong(playlist.id, song.id);
        renderPlaylistButtons();
      });
      menu.appendChild(btn);
    }
    if (playlistStore.all().length === 0) {
      const none = document.createElement("div");
      none.className = "music-song-menu-playlist music-song-menu-empty";
      none.textContent = "No playlists yet";
      menu.appendChild(none);
    }
  };
  renderPlaylistButtons();

  return menu;
}

export function buildSongList(songs, opts) {
  const ul = document.createElement("ul");
  ul.className = "music-song-list";
  const songIds = opts.songIds ?? songs.map((s) => s.id);
  if (songs.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = opts.emptyText ?? "Nothing here yet.";
    ul.appendChild(empty);
    return ul;
  }
  for (const song of songs) ul.appendChild(buildSongRow(song, { ...opts, songIds }));
  return ul;
}

/** A small square cover-art (or placeholder) element, resolved lazily. */
export function buildCoverArt(albumId, musicSystem, { size = "medium" } = {}) {
  const el = document.createElement("div");
  el.className = `music-cover music-cover-${size}`;
  const glyph = document.createElement("span");
  glyph.textContent = "\u266A";
  el.appendChild(glyph);
  musicSystem.getCoverUrl(albumId).then((url) => {
    if (!url) return;
    el.style.backgroundImage = `url(${url})`;
    el.classList.add("has-image");
  });
  return el;
}

export function buildAlbumCard(album, musicSystem, onOpen) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "music-album-card";
  card.appendChild(buildCoverArt(album.id, musicSystem));
  const name = document.createElement("div");
  name.className = "music-album-card-name";
  name.textContent = album.name;
  const artist = document.createElement("div");
  artist.className = "music-album-card-artist";
  artist.textContent = album.artist;
  card.append(name, artist);
  card.addEventListener("click", () => onOpen(album.id));
  return card;
}

export function buildAlbumGrid(albums, musicSystem, onOpen, emptyText = "No albums yet.") {
  const grid = document.createElement("div");
  grid.className = "music-album-grid";
  if (albums.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    grid.appendChild(empty);
    return grid;
  }
  for (const album of albums) grid.appendChild(buildAlbumCard(album, musicSystem, onOpen));
  return grid;
}
