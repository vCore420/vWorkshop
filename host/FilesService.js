/**
 * FilesService
 * --------------
 * "Continue expanding local file support... opening files, opening
 * folders, creating, renaming, copying, moving, deleting, watching files
 * for changes, metadata, file associations. The Host should become the
 * Workshop's gateway to the local filesystem."
 *
 * **One real capability, gated by two independent checks.** `listFiles()`
 * genuinely works — but only once the Workshop Host Companion is running
 * (`host-companion/`, polled by `HostConnectionManager.js`) *and* the
 * Filesystem permission has been explicitly granted
 * (`PermissionsService.js`) — a reachable Companion alone is
 * deliberately not enough. This is the one place in the whole Host that
 * genuinely reaches outside the browser today; see
 * `host-companion/README.md`'s own security reasoning for why even that
 * one capability stays read-only, metadata-only, and confined to one
 * folder.
 *
 * **Everything else stays honestly unimplemented, on purpose, even with
 * the Companion running.** Opening a file, opening a folder, creating,
 * renaming, copying, moving, deleting, watching for changes, and file
 * associations all throw a clear, specific error — not because nobody
 * got to them yet, but because none of them can be done safely from
 * something any browser tab's own JavaScript can reach without a real
 * design for doing so (see `host-companion/README.md`'s own "A note on
 * origins and security"). A convincing fake would be more misleading
 * than an honest "not yet."
 */
export class FilesService {
  constructor({ hostConnectionManager, permissionsService } = {}) {
    this._hostConnectionManager = hostConnectionManager;
    this._permissionsService = permissionsService;
  }

  getStatus() {
    if (this._hostConnectionManager?.status !== "connected") {
      return {
        available: false,
        summary: "File access isn't implemented yet — this is prepared architecture, not a working feature. Optionally, run the Workshop Host Companion (see host-companion/README.md) for real, read-only folder browsing.",
      };
    }
    if (!this._permissionsService?.isGranted("filesystem")) {
      return {
        available: false,
        summary: `The Workshop Host Companion is running (workspace: ${this._hostConnectionManager.workspaceRoot ?? "unknown"}), but Filesystem permission hasn't been granted yet — see host://services.`,
      };
    }
    return { available: true, summary: `Connected to the Workshop Host Companion — browsing ${this._hostConnectionManager.workspaceRoot}.` };
  }

  /** Genuinely real when the Companion is connected and Filesystem
   *  permission is granted — lists names, sizes, and modified times
   *  within the Companion's own configured workspace root. Throws a
   *  specific, honest error otherwise, naming exactly which of the two
   *  conditions isn't met rather than a generic failure. */
  async listFiles(relativePath = ".") {
    if (this._hostConnectionManager?.status !== "connected") {
      throw new Error("FilesService.listFiles() needs the Workshop Host Companion running — see host-companion/README.md.");
    }
    if (!this._permissionsService?.isGranted("filesystem")) {
      throw new Error("FilesService.listFiles() needs Filesystem permission granted first — see host://services.");
    }
    return this._hostConnectionManager.listFiles(relativePath);
  }

  openFile(_path) {
    throw new Error("FilesService.openFile() isn't implemented yet — see host-companion/README.md's own reasoning for why this stays unimplemented even with the Companion running.");
  }

  openFolder(_path) {
    throw new Error("FilesService.openFolder() isn't implemented yet — see host-companion/README.md's own reasoning for why this stays unimplemented even with the Companion running.");
  }

  createFile(_path) {
    throw new Error("FilesService.createFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes.");
  }

  renameFile(_path, _newName) {
    throw new Error("FilesService.renameFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes.");
  }

  copyFile(_path, _destination) {
    throw new Error("FilesService.copyFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes.");
  }

  moveFile(_path, _destination) {
    throw new Error("FilesService.moveFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes.");
  }

  deleteFile(_path) {
    throw new Error("FilesService.deleteFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes.");
  }

  watchFile(_path, _onChange) {
    throw new Error("FilesService.watchFile() isn't implemented yet — the Workshop Host Companion doesn't currently expose a file-watching endpoint.");
  }

  getFileAssociations(_extension) {
    throw new Error("FilesService.getFileAssociations() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine's own file associations.");
  }

  showSaveDialog(_suggestedName) {
    throw new Error("FilesService.showSaveDialog() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  showOpenDialog() {
    throw new Error("FilesService.showOpenDialog() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
