/**
 * TextureStore
 * --------------
 * A painted or imported texture is real image data — exactly the kind of
 * thing that doesn't belong crammed into a JSON blob in `localStorage` (a
 * handful of custom texture sheets could easily blow through its typical
 * 5–10MB quota). This is the same deliberate exception `HandleStore.js`
 * made for file system handles: one small IndexedDB-backed store, holding
 * exactly one thing — `textureId -> data URL` — while everything else
 * about an outfit (proportions, colours, which texture id a part is using)
 * stays ordinary JSON through the normal `PersistenceSystem` path. See
 * docs/PLAYER.md.
 *
 * Stores data URLs rather than raw Blobs specifically so a texture can be
 * hydrated straight into an `<img>`/canvas without an extra async decode
 * step — simpler at the small scale (a handful of 64–256px texture sheets)
 * this is meant for.
 */

const DB_NAME = "workshop-player-textures";
const DB_VERSION = 1;
const STORE_NAME = "textures";

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

export class TextureStore {
  async put(textureId, dataUrl) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, textureId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(textureId) {
    if (!textureId) return null;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(textureId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(textureId) {
    if (!textureId) return;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(textureId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Loads a data URL straight into an Image, ready to feed to `THREE.CanvasTexture`/draw onto a canvas. */
  async getAsImage(textureId) {
    const dataUrl = await this.get(textureId);
    if (!dataUrl) return null;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  generateId() {
    return `tex-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  }
}
