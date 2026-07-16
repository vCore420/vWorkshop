/**
 * LibraryManager
 * ----------------
 * "Selecting one or more root music folders... remembering previous
 * library locations... rebuilding only what has changed." All of that
 * lives in `MusicSystem`/`HandleStore`; this file is only the view onto
 * it — add a folder, see its status, rescan or remove it, or reconnect one
 * the browser has stopped trusting since last time.
 */
export function renderLibraryManagerView(container, { musicSystem, libraryStore }) {
  const heading = document.createElement("div");
  heading.className = "music-view-heading";
  const h = document.createElement("h2");
  h.textContent = "Manage Library";
  heading.appendChild(h);

  if (!musicSystem.isScanningSupported()) {
    const p = document.createElement("p");
    p.className = "music-manager-unsupported";
    p.innerHTML =
      "This browser can't grant folder access for scanning a music library " +
      "(the File System Access API isn't available here). Try a Chromium-based " +
      "browser — Chrome or Edge, for instance. See <code>docs/MUSIC.md</code> for why.";
    heading.appendChild(p);
    container.appendChild(heading);
    return;
  }
  container.appendChild(heading);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "music-add-folder";
  addBtn.textContent = "+ Add Music Folder";
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    addBtn.textContent = "Choose a folder\u2026";
    try {
      await musicSystem.addRootViaPicker();
    } catch (err) {
      if (err?.name !== "AbortError") console.error("[LibraryManager] couldn't add folder:", err);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = "+ Add Music Folder";
      renderRootList();
    }
  });
  container.appendChild(addBtn);

  const help = document.createElement("p");
  help.className = "music-manager-help";
  help.textContent = "Each folder should contain Artist \u2192 Album \u2192 song files, with an optional cover.png per album.";
  container.appendChild(help);

  const list = document.createElement("ul");
  list.className = "music-root-list";
  container.appendChild(list);

  function renderRootList() {
    list.innerHTML = "";
    if (libraryStore.roots.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No folders added yet.";
      list.appendChild(empty);
      return;
    }
    for (const root of libraryStore.roots) {
      list.appendChild(buildRootRow(root, musicSystem, renderRootList));
    }
  }

  renderRootList();
  const off = musicSystem.engine.events.on("music:rootsChanged", renderRootList);
  container.dispose = off;
}

function buildRootRow(root, musicSystem, refresh) {
  const li = document.createElement("li");
  li.className = "music-root-row";

  const name = document.createElement("div");
  name.className = "music-root-name";
  name.textContent = root.name;
  li.appendChild(name);

  const status = musicSystem.getRootStatus(root.id);
  const statusEl = document.createElement("div");
  statusEl.className = `music-root-status music-root-status-${status}`;
  statusEl.textContent = {
    granted: "Connected",
    "needs-permission": "Needs reconnecting",
    missing: "Not connected",
    scanning: "Scanning\u2026",
    error: "Couldn't scan",
  }[status] ?? status;
  li.appendChild(statusEl);

  const actions = document.createElement("div");
  actions.className = "music-root-actions";

  if (status === "needs-permission" || status === "missing") {
    const reconnectBtn = document.createElement("button");
    reconnectBtn.type = "button";
    reconnectBtn.className = "music-icon-button";
    reconnectBtn.textContent = "Reconnect";
    reconnectBtn.addEventListener("click", async () => {
      reconnectBtn.disabled = true;
      await musicSystem.reconnectRoot(root.id);
      refresh();
    });
    actions.appendChild(reconnectBtn);
  } else {
    const rescanBtn = document.createElement("button");
    rescanBtn.type = "button";
    rescanBtn.className = "music-icon-button";
    rescanBtn.textContent = "Rescan";
    rescanBtn.disabled = status === "scanning";
    rescanBtn.addEventListener("click", async () => {
      await musicSystem.rescanRoot(root.id);
      refresh();
    });
    actions.appendChild(rescanBtn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "music-icon-button music-icon-button-danger";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", async () => {
    if (!window.confirm(`Remove "${root.name}" from your library? Songs already in playlists or favourites will disappear from those too.`)) return;
    await musicSystem.removeRoot(root.id);
    refresh();
  });
  actions.appendChild(removeBtn);

  li.appendChild(actions);
  return li;
}
