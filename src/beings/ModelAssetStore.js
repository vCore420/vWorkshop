/**
 * ModelAssetStore
 * -----------------
 * The actual bytes behind `ModelLibrary.js`'s own index — real 3D model
 * data, not something that belongs crammed into a JSON blob in
 * `localStorage`. The same deliberate exception `ImageAssetStore.js`
 * already makes, kept as its own separate IndexedDB database rather than
 * reusing that one directly: a `.glb` can be a meaningfully larger asset
 * than a poster image, and a model library growing independently of the
 * image library shouldn't make either one slower to open.
 *
 * Stores the raw file as an `ArrayBuffer` (`.glb`, self-contained binary)
 * or plain text (`.gltf`, JSON) — never base64-encoded through a data
 * URL the way `ImageAssetStore` stores images. IndexedDB natively holds
 * binary data; encoding a multi-megabyte model as base64 text first would
 * only add a ~33% size penalty and a decode step for no benefit, unlike
 * an image, which needs to hydrate straight into an `<img src>` anyway.
 */

const DB_NAME = "workshop-models";
const DB_VERSION = 1;
const STORE_NAME = "models";

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

export class ModelAssetStore {
  /** `data` is an `ArrayBuffer` (.glb) or a `string` (.gltf JSON). */
  async put(modelId, data) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(data, modelId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(modelId) {
    if (!modelId) return null;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(modelId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(modelId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(modelId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
