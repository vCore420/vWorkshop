import { buildSongRow } from "./domHelpers.js";

/**
 * playlistViews.js
 * ------------------
 * Adding a song to a playlist happens from *any* song row's "\u22EF" menu
 * (see domHelpers.js) — this file is only about the playlist side:
 * creating/renaming/deleting/duplicating a playlist, and reordering or
 * removing songs once they're in one.
 */

export function renderPlaylistsView(container, { playlistStore, navigate }) {
  const head = document.createElement("div");
  head.className = "music-view-heading music-view-heading-row";
  const h = document.createElement("h2");
  h.textContent = "Playlists";
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "music-new-playlist";
  newBtn.textContent = "+ New Playlist";
  newBtn.addEventListener("click", () => {
    const name = window.prompt("Name this playlist:", "New Playlist");
    if (name === null) return;
    const playlist = playlistStore.create(name);
    navigate({ type: "playlist", id: playlist.id });
  });
  head.append(h, newBtn);
  container.appendChild(head);

  const playlists = playlistStore.all();
  const list = document.createElement("ul");
  list.className = "music-artist-list";
  if (playlists.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No playlists yet — create one, or add a song to a new playlist from its \u22EF menu.";
    list.appendChild(empty);
  }
  for (const playlist of playlists) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-artist-row";
    const name = document.createElement("span");
    name.textContent = playlist.name;
    const count = document.createElement("span");
    count.className = "music-artist-count";
    count.textContent = `${playlist.songIds.length} song${playlist.songIds.length === 1 ? "" : "s"}`;
    btn.append(name, count);
    btn.addEventListener("click", () => navigate({ type: "playlist", id: playlist.id }));
    li.appendChild(btn);
    list.appendChild(li);
  }
  container.appendChild(list);
}

export function renderPlaylistDetailView(container, playlistId, { playlistStore, libraryStore, musicSystem, navigate }) {
  const playlist = playlistStore.get(playlistId);
  if (!playlist) {
    const gone = document.createElement("div");
    gone.className = "empty-state";
    gone.textContent = "This playlist no longer exists.";
    container.appendChild(gone);
    return;
  }

  const head = document.createElement("div");
  head.className = "music-view-heading music-view-heading-row";
  const nameInput = document.createElement("input");
  nameInput.className = "music-playlist-name-input";
  nameInput.value = playlist.name;
  nameInput.addEventListener("change", () => playlistStore.rename(playlistId, nameInput.value));
  head.appendChild(nameInput);

  const actions = document.createElement("div");
  actions.className = "music-playlist-actions";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "music-play-all";
  playBtn.textContent = "\u25B6 Play all";
  playBtn.disabled = playlist.songIds.length === 0;
  playBtn.addEventListener("click", () => musicSystem.playQueue(playlist.songIds, 0));
  actions.appendChild(playBtn);

  const duplicateBtn = document.createElement("button");
  duplicateBtn.type = "button";
  duplicateBtn.className = "music-icon-button";
  duplicateBtn.textContent = "Duplicate";
  duplicateBtn.addEventListener("click", () => {
    const copy = playlistStore.duplicate(playlistId);
    if (copy) navigate({ type: "playlist", id: copy.id });
  });
  actions.appendChild(duplicateBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "music-icon-button music-icon-button-danger";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    if (!window.confirm(`Delete "${playlist.name}"? This can't be undone.`)) return;
    playlistStore.remove(playlistId);
    navigate({ type: "playlists" });
  });
  actions.appendChild(deleteBtn);

  head.appendChild(actions);
  container.appendChild(head);

  const songs = playlist.songIds.map((id) => libraryStore.getSong(id)).filter(Boolean);
  const list = document.createElement("ul");
  list.className = "music-song-list music-song-list-reorderable";
  if (songs.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No songs yet — add some from any song's \u22EF menu.";
    list.appendChild(empty);
  }

  songs.forEach((song, index) => {
    const row = buildSongRow(song, {
      songIds: playlist.songIds,
      musicSystem,
      libraryStore,
      playlistStore,
      showAlbum: true,
      extraActions: () => [buildRemoveButton(playlistId, song.id, playlistStore)],
    });
    row.draggable = true;
    row.dataset.index = String(index);
    wireReorderHandlers(row, playlistId, playlistStore);
    list.appendChild(row);
  });
  container.appendChild(list);
}

function buildRemoveButton(playlistId, songId, playlistStore) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "music-song-remove";
  btn.textContent = "\u2715";
  btn.setAttribute("aria-label", "Remove from playlist");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    playlistStore.removeSong(playlistId, songId);
  });
  return btn;
}

/** Plain HTML5 drag-and-drop — no library, matches the rest of the project. */
function wireReorderHandlers(row, playlistId, playlistStore) {
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", row.dataset.index);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    const toIndex = parseInt(row.dataset.index, 10);
    if (Number.isFinite(fromIndex) && Number.isFinite(toIndex) && fromIndex !== toIndex) {
      playlistStore.reorderSong(playlistId, fromIndex, toIndex);
    }
  });
}
