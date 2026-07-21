/**
 * FilesService
 * --------------
 * "Continue expanding local file support... opening files, opening
 * folders, creating, renaming, copying, moving, deleting, watching files
 * for changes, metadata, file associations. The Host should become the
 * Workshop's gateway to the local filesystem."
 *
 * **Three real capabilities now, each gated by two independent checks.**
 * `listFiles()`/`openFile()` need the Workshop Host Companion running
 * (`host-companion/`, polled by `HostConnectionManager.js`) *and*
 * Filesystem Read permission granted; `saveFile()` needs the Companion
 * running *and* Filesystem Write permission granted — a reachable
 * Companion alone is deliberately not enough for either. Read and write
 * are independently revokable since Version 4, Phase 1 (see
 * `PermissionsService.js`'s own comment on why one blanket `filesystem`
 * boolean stopped being enough the moment writing became real too).
 * `openFile()`/`saveFile()` additionally need the Companion to recognise
 * a pairing token (`HostConnectionManager.setToken()`, entered once at
 * `host://permissions`) — see `host-companion/workshop-host-companion.js`'s
 * own top-of-file comment for why file *contents* need that extra bar
 * and a plain folder *listing* doesn't.
 *
 * **Everything else stays honestly unimplemented, on purpose, even with
 * the Companion running and paired.** Opening a folder (in the OS's own
 * file manager), creating an empty/templated file with no content of its
 * own, renaming, copying, moving, deleting, watching for changes, and
 * file associations all throw a clear, specific error — not because
 * nobody got to them yet, but because none of them were asked for this
 * phase, and a convincing fake would be more misleading than an honest
 * "not yet." Launching a local application is a separate service
 * entirely (`ProgramsService.js`) and stays deferred to its own future
 * phase (v4.0.1b) — see `docs/ROADMAP_V4.md`.
 */
export class FilesService {
  constructor({ hostConnectionManager, permissionsService } = {}) {
    this._hostConnectionManager = hostConnectionManager;
    this._permissionsService = permissionsService;
    // ---- transient UI-support state for host://files, not persisted ----
    // Which folder the Files page is currently showing, and (if any) which
    // file is currently open in its small editor view. Living here rather
    // than as a new dedicated class because FilesService is already the
    // one place "everything about files" lives — this is browsing
    // *position*, not a new capability, the same distinction
    // `BrowserStore`'s own scroll-position tracking already draws between
    // real data and session-only UI state.
    this._currentPath = ".";
    this._openFile = null; // { path, contents, size, modified } | null
    this._lastError = null;
  }

  getStatus() {
    const connected = this._hostConnectionManager?.status === "connected";
    const readGranted = !!this._permissionsService?.isGranted("filesystem-read");
    const writeGranted = !!this._permissionsService?.isGranted("filesystem-write");
    if (!connected) {
      return {
        available: false,
        readAvailable: false,
        writeAvailable: false,
        summary: "File access isn't implemented yet — this is prepared architecture, not a working feature. Optionally, run the Workshop Host Companion (see host-companion/README.md) for real folder browsing, reading, and editing.",
      };
    }
    if (!readGranted) {
      return {
        available: false,
        readAvailable: false,
        writeAvailable: false,
        summary: `The Workshop Host Companion is running (workspace: ${this._hostConnectionManager.workspaceRoot ?? "unknown"}), but Filesystem Read permission hasn't been granted yet — see host://permissions.`,
      };
    }
    return {
      available: true,
      readAvailable: true,
      writeAvailable: writeGranted,
      summary: writeGranted
        ? `Connected to the Workshop Host Companion — browsing and editing ${this._hostConnectionManager.workspaceRoot}.`
        : `Connected to the Workshop Host Companion — browsing ${this._hostConnectionManager.workspaceRoot} (read-only; grant Filesystem Write at host://permissions to edit).`,
    };
  }

  /** Genuinely real when the Companion is connected and Filesystem Read
   *  permission is granted — lists names, sizes, and modified times
   *  within the Companion's own configured workspace root. Throws a
   *  specific, honest error otherwise, naming exactly which of the two
   *  conditions isn't met rather than a generic failure. */
  async listFiles(relativePath = ".") {
    if (this._hostConnectionManager?.status !== "connected") {
      throw new Error("FilesService.listFiles() needs the Workshop Host Companion running — see host-companion/README.md.");
    }
    if (!this._permissionsService?.isGranted("filesystem-read")) {
      throw new Error("FilesService.listFiles() needs Filesystem Read permission granted first — see host://permissions.");
    }
    return this._hostConnectionManager.listFiles(relativePath);
  }

  /** Genuinely real (Version 4, Phase 1) when the Companion is connected,
   *  Filesystem Read permission is granted, and a valid pairing token has
   *  been entered — reads one text file's contents. Returns `{path,
   *  contents, size, modified}`. Throws a specific, honest error for
   *  every distinct way this can fail, including the Companion's own
   *  text-only/size-cap rejections passed straight through. */
  async openFile(relativePath) {
    if (this._hostConnectionManager?.status !== "connected") {
      throw new Error("FilesService.openFile() needs the Workshop Host Companion running — see host-companion/README.md.");
    }
    if (!this._permissionsService?.isGranted("filesystem-read")) {
      throw new Error("FilesService.openFile() needs Filesystem Read permission granted first — see host://permissions.");
    }
    return this._hostConnectionManager.readFile(relativePath);
  }

  /** Genuinely real (Version 4, Phase 1) when the Companion is connected,
   *  Filesystem Write permission is granted, and a valid pairing token
   *  has been entered — writes (creating if new, overwriting if not) one
   *  text file's contents. Returns `{path, size, modified}`. Deliberately
   *  checked independently of `filesystem-read`: the two grants are
   *  orthogonal on purpose, see `PermissionsService.js`'s own comment. */
  async saveFile(relativePath, contents) {
    if (this._hostConnectionManager?.status !== "connected") {
      throw new Error("FilesService.saveFile() needs the Workshop Host Companion running — see host-companion/README.md.");
    }
    if (!this._permissionsService?.isGranted("filesystem-write")) {
      throw new Error("FilesService.saveFile() needs Filesystem Write permission granted first — see host://permissions.");
    }
    return this._hostConnectionManager.saveFile(relativePath, contents);
  }

  openFolder(_path) {
    throw new Error("FilesService.openFolder() isn't implemented yet — see host-companion/README.md's own reasoning for why this stays unimplemented even with the Companion running.");
  }

  /** Distinct from `saveFile()` above: this is "create a new, empty (or
   *  templated) file with no content argument," a smaller and different
   *  contract that was never actually asked for this phase — "open and
   *  read a file, edit and save it back" is. Stays honestly unimplemented. */
  createFile(_path) {
    throw new Error("FilesService.createFile() isn't implemented yet — the Workshop Host doesn't have a bridge for creating an empty file. FilesService.saveFile() covers writing real contents to a new or existing path.");
  }

  renameFile(_path, _newName) {
    throw new Error("FilesService.renameFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes beyond saving a file's own contents.");
  }

  copyFile(_path, _destination) {
    throw new Error("FilesService.copyFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes beyond saving a file's own contents.");
  }

  moveFile(_path, _destination) {
    throw new Error("FilesService.moveFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes beyond saving a file's own contents.");
  }

  deleteFile(_path) {
    throw new Error("FilesService.deleteFile() isn't implemented yet — the Workshop Host doesn't have a bridge for filesystem writes beyond saving a file's own contents.");
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

  // ---- transient UI-support state for host://files — see this class's
  // own constructor comment; none of this is persisted or a capability. ----

  getCurrentPath() {
    return this._currentPath;
  }

  /** Navigating to a different folder implicitly closes whatever file was
   *  open — a file browser showing a folder listing and an open editor at
   *  the same time isn't a state this small page tries to support. */
  setCurrentPath(relativePath) {
    this._currentPath = relativePath || ".";
    this._openFile = null;
    this._lastError = null;
  }

  getOpenFile() {
    return this._openFile;
  }

  setOpenFile(fileData) {
    this._openFile = fileData;
  }

  clearOpenFile() {
    this._openFile = null;
    this._lastError = null;
  }

  getLastError() {
    return this._lastError;
  }

  setLastError(message) {
    this._lastError = message;
  }

  clearLastError() {
    this._lastError = null;
  }
}
