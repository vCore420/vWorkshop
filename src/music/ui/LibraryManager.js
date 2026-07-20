/**
 * LibraryManager
 * ----------------
 * "Selecting one or more root music folders... remembering previous
 * library locations... rebuilding only what has changed." All of that
 * lives in `MusicSystem`/`HandleStore`; this file is only the view onto
 * it — add a folder, see its status, rescan or remove it, or reconnect one
 * the browser has stopped trusting since last time.
 *
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — "a fallback path
 * ... would bring the feature to every browser rather than one." Browsers
 * without the File System Access API (Firefox, Safari) used to just see
 * an explanation and nothing else. They now get the same "+ Add Music
 * Folder" button, wired to a hidden `<input type="file" webkitdirectory
 * multiple>` instead of `showDirectoryPicker()` — a folder picker every
 * browser supports, just without a reopenable handle behind it (see
 * `MemoryDirectoryHandle.js`). "Memory" roots (`root.kind === "memory"`)
 * show "Re-select Folder" instead of "Reconnect" once their session ends,
 * since there's nothing for `HandleStore` to silently reconnect to.
 */
export function renderLibraryManagerView(container, { musicSystem, libraryStore }) {
  const heading = document.createElement("div");
  heading.className = "music-view-heading";
  const h = document.createElement("h2");
  h.textContent = "Manage Library";
  heading.appendChild(h);

  const supportsHandles = musicSystem.isScanningSupported();
  if (!supportsHandles) {
    const p = document.createElement("p");
    p.className = "music-manager-unsupported";
    p.innerHTML =
      "This browser can't grant a music folder a lasting connection (the File System " +
      "Access API isn't available here — Chrome or Edge support it). You can still add " +
      "one below by selecting its files directly; you'll just need to select it again " +
      "each session, since nothing here can remember it the way a Chromium browser can. " +
      "See <code>docs/MUSIC.md</code> for the full explanation.";
    heading.appendChild(p);
  }
  container.appendChild(heading);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "music-add-folder";
  addBtn.textContent = "+ Add Music Folder";

  // Only ever used on the fallback path (see the click handler below) \u2014
  // built either way so its own event wiring lives in one place.
  const fallbackInput = document.createElement("input");
  fallbackInput.type = "file";
  fallbackInput.setAttribute("webkitdirectory", "");
  fallbackInput.multiple = true;
  fallbackInput.style.display = "none";
  fallbackInput.addEventListener("change", async () => {
    const files = [...fallbackInput.files];
    fallbackInput.value = ""; // so selecting the same folder again still fires "change"
    if (files.length === 0) return;
    addBtn.disabled = true;
    addBtn.textContent = "Reading files\u2026";
    try {
      const folderName = files[0].webkitRelativePath.split("/")[0];
      await musicSystem.addRootViaFileList(files, folderName);
    } catch (err) {
      console.error("[LibraryManager] couldn't add folder from files:", err);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = "+ Add Music Folder";
      renderRootList();
    }
  });
  container.appendChild(fallbackInput);

  addBtn.addEventListener("click", async () => {
    if (!supportsHandles) {
      fallbackInput.click();
      return;
    }
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

  const isMemoryRoot = root.kind === "memory";
  const status = musicSystem.getRootStatus(root.id);
  const statusEl = document.createElement("div");
  statusEl.className = `music-root-status music-root-status-${status}`;
  statusEl.textContent = isMemoryRoot && (status === "needs-permission" || status === "missing")
    ? "Needs re-selecting"
    : ({
        granted: "Connected",
        "needs-permission": "Needs reconnecting",
        missing: "Not connected",
        scanning: "Scanning\u2026",
        error: "Couldn't scan",
      }[status] ?? status);
  li.appendChild(statusEl);

  const actions = document.createElement("div");
  actions.className = "music-root-actions";

  if (status === "needs-permission" || status === "missing") {
    if (isMemoryRoot) {
      // Version 3, Phase 12 \u2014 a "memory" root has nothing in HandleStore
      // to silently reconnect to (see MemoryDirectoryHandle.js's own
      // comment); the only way back is picking the same folder again,
      // via the exact same hidden webkitdirectory input the fallback
      // "Add Music Folder" path already uses.
      const reselectInput = document.createElement("input");
      reselectInput.type = "file";
      reselectInput.setAttribute("webkitdirectory", "");
      reselectInput.multiple = true;
      reselectInput.style.display = "none";
      const reselectBtn = document.createElement("button");
      reselectBtn.type = "button";
      reselectBtn.className = "music-icon-button";
      reselectBtn.textContent = "Re-select Folder";
      reselectInput.addEventListener("change", async () => {
        const files = [...reselectInput.files];
        reselectInput.value = "";
        if (files.length === 0) return;
        reselectBtn.disabled = true;
        await musicSystem.reconnectMemoryRoot(root.id, files);
        refresh();
      });
      reselectBtn.addEventListener("click", () => reselectInput.click());
      actions.append(reselectInput, reselectBtn);
    } else {
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
    }
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
