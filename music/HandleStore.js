/**
 * HandleStore
 * -----------
 * Every other persisted thing in the workshop is plain JSON, saved through
 * `PersistenceSystem` into `localStorage` (see `docs/ARCHITECTURE.md`).
 * This is the one deliberate exception: a `FileSystemDirectoryHandle` (from
 * the File System Access API) is a live handle to a real folder on disk —
 * it can't be serialized to JSON at all, but it *can* be stored directly in
 * IndexedDB (which supports structured cloning of these handles), and
 * later re-opened without asking the person to re-pick the folder, as long
 * as the browser still considers the permission grant valid.
 *
 * This store holds exactly one thing: `rootId -> FileSystemDirectoryHandle`.
 * Everything else about a music library root (its display name, and every
 * artist/album/song discovered inside it) is perfectly ordinary JSON and
 * lives in `MusicLibraryStore` instead, following the normal
 * `PersistenceSystem` path. That split is what lets the library be
 * *browsable* (artists, albums, favourites, playlists) even in a session
 * where a root hasn't been reconnected yet — only actually reading a file's
 * bytes (to play it, or to show its cover art) needs the handle.
 */

const DB_NAME = "workshop-music-handles";
const DB_VERSION = 1;
const STORE_NAME = "roots";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class HandleStore {
  async isSupported() {
    return "indexedDB" in window && typeof window.showDirectoryPicker === "function";
  }

  async put(rootId, directoryHandle) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(directoryHandle, rootId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(rootId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(rootId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(rootId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(rootId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Resolves a handle to an actually-usable state: `"granted"` (ready to
   * use, silently), `"needs-permission"` (the handle still exists but the
   * browser wants a fresh user gesture before allowing reads again — see
   * `requestPermission`), or `"missing"` (no handle stored at all, the
   * root needs to be re-added from scratch).
   */
  async permissionState(rootId) {
    const handle = await this.get(rootId);
    if (!handle) return "missing";
    const state = await handle.queryPermission({ mode: "read" });
    return state === "granted" ? "granted" : "needs-permission";
  }

  /** Must be called from inside a user-gesture handler (a click). */
  async requestPermission(rootId) {
    const handle = await this.get(rootId);
    if (!handle) return false;
    const state = await handle.requestPermission({ mode: "read" });
    return state === "granted";
  }
}
