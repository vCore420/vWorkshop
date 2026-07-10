/**
 * ImageAssetStore
 * -----------------
 * The actual bytes behind `ImageLibraryStore.js`'s own index — real image
 * data, not something that belongs crammed into a JSON blob in
 * `localStorage`. The same deliberate exception `HandleStore.js` and
 * `TextureStore.js` already make, kept as its own separate IndexedDB
 * object store rather than reusing `TextureStore.js` directly: that one's
 * own comment is explicit about being sized for "a handful of 64-256px
 * texture sheets," where a Display Surface image (a full poster, a
 * screenshot) is a genuinely different scale of asset.
 *
 * Stores data URLs, exactly like `TextureStore.js`, for the same reason —
 * hydrating straight into an `<img>` with no extra async decode step.
 */

const DB_NAME = "workshop-display-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

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

export class ImageAssetStore {
  async put(imageId, dataUrl) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, imageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(imageId) {
    if (!imageId) return null;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(imageId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(imageId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(imageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Resolves an image id straight to a loaded `<img>` element, ready to
   *  use as a texture source — the same "resolve id -> usable image"
   *  convenience `TextureStore.getAsImage()` already provides. */
  async getAsImage(imageId) {
    const dataUrl = await this.get(imageId);
    if (!dataUrl) return null;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Couldn't decode image "${imageId}".`));
      img.src = dataUrl;
    });
  }
}
