/**
 * MemoryDirectoryHandle
 * -----------------------
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — "the personal
 * music library currently depends on a Chromium-only file-system API...
 * a fallback path (even one that trades away live-folder persistence)
 * would bring the feature to every browser rather than one."
 *
 * `LibraryScanner.js`'s `scanRoot()`/`resolveFile()`/`resolveCoverFile()`
 * only ever call four methods on whatever "root handle" they're given:
 * `entries()`, `getDirectoryHandle(name)`, `getFileHandle(name)`, and
 * `getFile()` on whatever `getFileHandle()` returns — exactly the same
 * surface a real `FileSystemDirectoryHandle`/`FileSystemFileHandle` pair
 * expose. Rather than writing a second, parallel scanner for browsers
 * without the File System Access API, this builds a plain in-memory tree
 * from an ordinary `FileList` (an `<input type="file" webkitdirectory
 * multiple>` picker, which every browser supports, unlike the real API)
 * that implements just that surface — `LibraryScanner.js` genuinely
 * cannot tell the difference, so it needed zero changes.
 *
 * The honest tradeoff this trades away: a real `FileSystemDirectoryHandle`
 * can be stored in IndexedDB and silently reopened next session (see
 * `HandleStore.js`); this tree is plain JS objects holding live `File`
 * references from a picker gesture, which can't be persisted or reopened
 * at all — `MusicSystem.js` never puts one in `HandleStore`, so a root
 * built this way genuinely needs picking again next session, exactly the
 * tradeoff the brief names rather than a limitation hidden from the
 * person using it.
 */
class MemoryFileHandle {
  constructor(file) {
    this.kind = "file";
    this._file = file;
  }

  async getFile() {
    return this._file;
  }
}

class MemoryDirectoryHandle {
  constructor(name) {
    this.kind = "directory";
    this.name = name;
    this._children = new Map(); // name -> MemoryDirectoryHandle | MemoryFileHandle
  }

  async *entries() {
    yield* this._children.entries();
  }

  async getDirectoryHandle(name) {
    const child = this._children.get(name);
    if (!child || child.kind !== "directory") throw new Error(`"${name}" not found`);
    return child;
  }

  async getFileHandle(name) {
    const child = this._children.get(name);
    if (!child || child.kind !== "file") throw new Error(`"${name}" not found`);
    return child;
  }
}

/** Builds a `MemoryDirectoryHandle` tree from a flat `FileList`/array of
 *  `File`s whose entries carry `.webkitRelativePath` (the shape
 *  `<input webkitdirectory>` produces, e.g.
 *  `"MyMusic/Artist/Album/song.mp3"`) — the picked folder's own name is
 *  the first path segment and is dropped, so the returned handle's own
 *  `entries()` yields artist-level folders directly, matching what
 *  `scanRoot()` already expects a root handle to yield. */
export function buildMemoryDirectoryTree(files) {
  const root = new MemoryDirectoryHandle("");
  for (const file of files) {
    const parts = (file.webkitRelativePath || "").split("/").slice(1);
    if (parts.length === 0) continue;
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let child = dir._children.get(part);
      if (!child) {
        child = new MemoryDirectoryHandle(part);
        dir._children.set(part, child);
      }
      dir = child;
    }
    dir._children.set(parts[parts.length - 1], new MemoryFileHandle(file));
  }
  return root;
}
