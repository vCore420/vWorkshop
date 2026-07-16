/**
 * LibraryScanner
 * ----------------
 * Turns a `FileSystemDirectoryHandle` into the plain
 * `[{ name, albums: [{ name, hasCover, songs: [...] }] }]` shape
 * `MusicLibraryStore.mergeScan()` expects — nothing more. This file has no
 * opinion about persistence, ids, or the UI; it only knows how to read a
 * folder tree.
 *
 * The expected shape (see the brief, and `docs/MUSIC.md`):
 *
 *   Music/Artist/Album/cover.png
 *   Music/Artist/Album/song1.mp3
 *
 * Two levels of subfolder under the root, exactly — anything at the root
 * level that isn't a folder is ignored, and so is anything inside an
 * "album" folder that isn't a recognised audio file or a cover image.
 * That's the literal implementation of "the folder structure is the
 * primary source of organisation": there's no metadata parsing here at
 * all, just names.
 */

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac", ".weba"]);
const COVER_FILENAMES = new Set(["cover.png", "cover.jpg", "cover.jpeg", "cover.webp"]);

function extensionOf(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(idx).toLowerCase() : "";
}

/** @returns {Promise<Array<{name:string, albums: Array<{name:string, hasCover:boolean, songs:string[]}>}>>} */
export async function scanRoot(rootHandle, { onProgress } = {}) {
  const artists = [];

  for await (const [artistName, artistHandle] of rootHandle.entries()) {
    if (artistHandle.kind !== "directory") continue; // stray files at the root are ignored, not errors

    const albums = [];
    for await (const [albumName, albumHandle] of artistHandle.entries()) {
      if (albumHandle.kind !== "directory") continue;

      let hasCover = false;
      const songs = [];
      for await (const [fileName, fileHandle] of albumHandle.entries()) {
        if (fileHandle.kind !== "file") continue;
        const lower = fileName.toLowerCase();
        if (COVER_FILENAMES.has(lower)) {
          hasCover = true;
          continue;
        }
        if (AUDIO_EXTENSIONS.has(extensionOf(lower))) songs.push(fileName);
        // anything else (.txt, .nfo, thumbs.db, ...) is silently ignored
      }

      songs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); // "2.mp3" before "10.mp3"
      albums.push({ name: albumName, hasCover, songs });
      onProgress?.({ artist: artistName, album: albumName, songCount: songs.length });
    }

    artists.push({ name: artistName, albums });
  }

  return artists;
}

/**
 * Walks `rootId/artist/album/filename` back down to a live `File`, for
 * actual playback or cover-art display. Returns `null` rather than
 * throwing if anything along the path no longer exists (a file could have
 * been deleted/renamed on disk since the last scan) — callers treat that
 * as "can't play this right now", not a crash.
 */
export async function resolveFile(rootHandle, artistName, albumName, filename) {
  try {
    const artistHandle = await rootHandle.getDirectoryHandle(artistName);
    const albumHandle = await artistHandle.getDirectoryHandle(albumName);
    const fileHandle = await albumHandle.getFileHandle(filename);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/** Finds whichever cover filename actually exists in an album folder (see COVER_FILENAMES). */
export async function resolveCoverFile(rootHandle, artistName, albumName) {
  try {
    const artistHandle = await rootHandle.getDirectoryHandle(artistName);
    const albumHandle = await artistHandle.getDirectoryHandle(albumName);
    for (const name of COVER_FILENAMES) {
      try {
        const fileHandle = await albumHandle.getFileHandle(name);
        return await fileHandle.getFile();
      } catch {
        // try the next candidate filename
      }
    }
    return null;
  } catch {
    return null;
  }
}
