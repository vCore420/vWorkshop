import { buildSongList, buildAlbumGrid, buildCoverArt, escapeHtml } from "./domHelpers.js";

/**
 * libraryViews.js
 * -----------------
 * One render function per sidebar section, all sharing the same small
 * shape: `render(container, deps)` where `deps` is
 * `{ libraryStore, musicSystem, playlistStore, navigate }`. `navigate(view)`
 * is how a view pushes the user somewhere else (an album card opening its
 * detail page, an artist row opening its albums) without knowing anything
 * about `MusicOverlay`'s own routing — see that file.
 */

function heading(text, subtitle) {
  const wrap = document.createElement("div");
  wrap.className = "music-view-heading";
  const h = document.createElement("h2");
  h.textContent = text;
  wrap.appendChild(h);
  if (subtitle) {
    const p = document.createElement("p");
    p.textContent = subtitle;
    wrap.appendChild(p);
  }
  return wrap;
}

export function renderArtistsView(container, { libraryStore, navigate }) {
  container.appendChild(heading("Artists"));
  const artists = libraryStore.allArtists();
  const list = document.createElement("ul");
  list.className = "music-artist-list";
  if (artists.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No artists yet — add a music folder from Manage Library.";
    list.appendChild(empty);
  }
  for (const artist of artists) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-artist-row";
    const name = document.createElement("span");
    name.textContent = artist.name;
    const count = document.createElement("span");
    count.className = "music-artist-count";
    count.textContent = `${artist.albumIds.length} album${artist.albumIds.length === 1 ? "" : "s"}`;
    btn.append(name, count);
    btn.addEventListener("click", () => navigate({ type: "artist", name: artist.name }));
    li.appendChild(btn);
    list.appendChild(li);
  }
  container.appendChild(list);
}

export function renderArtistDetailView(container, artistName, { libraryStore, musicSystem, playlistStore, navigate }) {
  container.appendChild(heading(artistName, "Artist"));
  const albums = libraryStore.albumsByArtist(artistName);
  container.appendChild(buildAlbumGrid(albums, musicSystem, (albumId) => navigate({ type: "album", id: albumId }), "No albums found for this artist."));
}

export function renderAlbumsView(container, { libraryStore, musicSystem, playlistStore, navigate }) {
  container.appendChild(heading("Albums"));
  container.appendChild(buildAlbumGrid(libraryStore.allAlbums(), musicSystem, (albumId) => navigate({ type: "album", id: albumId }), "No albums yet — add a music folder from Manage Library."));
}

export function renderAlbumDetailView(container, albumId, { libraryStore, musicSystem, playlistStore, navigate }) {
  const album = libraryStore.getAlbum(albumId);
  if (!album) {
    container.appendChild(heading("Album not found"));
    return;
  }
  const head = document.createElement("div");
  head.className = "music-album-detail-head";
  head.appendChild(buildCoverArt(albumId, musicSystem, { size: "large" }));
  const info = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = album.name;
  const artistLink = document.createElement("button");
  artistLink.type = "button";
  artistLink.className = "music-link-button";
  artistLink.textContent = album.artist;
  artistLink.addEventListener("click", () => navigate({ type: "artist", name: album.artist }));
  const playAllBtn = document.createElement("button");
  playAllBtn.type = "button";
  playAllBtn.className = "music-play-all";
  playAllBtn.textContent = "\u25B6 Play album";
  const songs = libraryStore.songsByAlbum(albumId);
  playAllBtn.addEventListener("click", () => musicSystem.playQueue(songs.map((s) => s.id), 0));
  info.append(title, artistLink, playAllBtn);
  head.appendChild(info);
  container.appendChild(head);

  container.appendChild(buildSongList(songs, { musicSystem, libraryStore, playlistStore, emptyText: "No songs found in this album." }));
}

export function renderSongsView(container, { libraryStore, musicSystem, playlistStore }) {
  container.appendChild(heading("Songs"));
  container.appendChild(buildSongList(libraryStore.allSongs(), { musicSystem, libraryStore, playlistStore, showAlbum: true, emptyText: "No songs yet — add a music folder from Manage Library." }));
}

export function renderRecentlyAddedView(container, { libraryStore, musicSystem, playlistStore }) {
  container.appendChild(heading("Recently Added"));
  container.appendChild(buildSongList(libraryStore.recentlyAdded(), { musicSystem, libraryStore, playlistStore, showAlbum: true, emptyText: "Nothing scanned yet." }));
}

export function renderRecentlyPlayedView(container, { libraryStore, musicSystem, playlistStore }) {
  container.appendChild(heading("Recently Played"));
  container.appendChild(buildSongList(libraryStore.recentlyPlayedSongs(), { musicSystem, libraryStore, playlistStore, showAlbum: true, emptyText: "Nothing played yet — it'll show up here once you've listened to something." }));
}

export function renderMostPlayedView(container, { libraryStore, musicSystem, playlistStore }) {
  container.appendChild(heading("Most Played"));
  container.appendChild(buildSongList(libraryStore.mostPlayedSongs(), { musicSystem, libraryStore, playlistStore, showAlbum: true, emptyText: "Nothing played enough yet to rank." }));
}

export function renderFavouritesView(container, { libraryStore, musicSystem, playlistStore }) {
  container.appendChild(heading("Favourites"));
  container.appendChild(buildSongList(libraryStore.favouriteSongs(), { musicSystem, libraryStore, playlistStore, showAlbum: true, emptyText: "Tap the heart on any song to favourite it." }));
}

export function renderSearchResultsView(container, query, { libraryStore, musicSystem, playlistStore, navigate }) {
  container.appendChild(heading(`Search: "${escapeHtml(query)}"`));
  const results = libraryStore.search(query);
  const total = results.artists.length + results.albums.length + results.songs.length;
  if (total === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No matches.";
    container.appendChild(empty);
    return;
  }

  if (results.artists.length) {
    const section = document.createElement("div");
    section.className = "music-search-section";
    const h = document.createElement("h3");
    h.textContent = "Artists";
    section.appendChild(h);
    const list = document.createElement("ul");
    list.className = "music-artist-list";
    for (const artist of results.artists) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "music-artist-row";
      btn.textContent = artist.name;
      btn.addEventListener("click", () => navigate({ type: "artist", name: artist.name }));
      li.appendChild(btn);
      list.appendChild(li);
    }
    section.appendChild(list);
    container.appendChild(section);
  }

  if (results.albums.length) {
    const section = document.createElement("div");
    section.className = "music-search-section";
    const h = document.createElement("h3");
    h.textContent = "Albums";
    section.appendChild(h);
    section.appendChild(buildAlbumGrid(results.albums, musicSystem, (albumId) => navigate({ type: "album", id: albumId })));
    container.appendChild(section);
  }

  if (results.songs.length) {
    const section = document.createElement("div");
    section.className = "music-search-section";
    const h = document.createElement("h3");
    h.textContent = "Songs";
    section.appendChild(h);
    section.appendChild(buildSongList(results.songs, { musicSystem, libraryStore, playlistStore, showAlbum: true }));
    container.appendChild(section);
  }
}
