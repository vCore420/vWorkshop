/**
 * StorageUtils
 * ------------
 * Thin, defensive wrapper around localStorage. Kept separate from
 * PersistenceSystem so the *storage medium* (localStorage today, maybe
 * IndexedDB or a cloud sync backend later) can change without touching the
 * system that decides *what* gets saved.
 */
const memoryFallback = new Map();
let storageAvailable = true;

try {
  const testKey = "__workshop_storage_test__";
  window.localStorage.setItem(testKey, "1");
  window.localStorage.removeItem(testKey);
} catch {
  storageAvailable = false;
  console.warn("[StorageUtils] localStorage unavailable — falling back to in-memory storage for this session only.");
}

export const StorageUtils = {
  get(key) {
    try {
      const raw = storageAvailable ? window.localStorage.getItem(key) : memoryFallback.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error(`[StorageUtils] failed to read "${key}"`, err);
      return null;
    }
  },

  set(key, value) {
    try {
      const raw = JSON.stringify(value);
      if (storageAvailable) window.localStorage.setItem(key, raw);
      else memoryFallback.set(key, raw);
      return true;
    } catch (err) {
      console.error(`[StorageUtils] failed to write "${key}"`, err);
      return false;
    }
  },

  remove(key) {
    if (storageAvailable) window.localStorage.removeItem(key);
    else memoryFallback.delete(key);
  },

  isAvailable() {
    return storageAvailable;
  },

  /** Triggers a browser download of arbitrary JSON — used for manual backups. */
  downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** Opens a file picker and resolves with the parsed JSON contents. */
  uploadJSON() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error("No file selected"));
        const reader = new FileReader();
        reader.onload = () => {
          try {
            resolve(JSON.parse(reader.result));
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      };
      input.click();
    });
  },
};
