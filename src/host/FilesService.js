/**
 * FilesService
 * --------------
 * "Future responsibilities include: opening files, opening folders,
 * import, export, file selection, save dialogs. Do not overbuild this.
 * Simply establish the framework." The four real future entry points,
 * each honestly unimplemented — no attempt at a browser-side file-picker
 * shim standing in for the real thing, since a convincing fake would be
 * more misleading than an honest "not yet" once a real Host actually
 * exists to do this properly (native file dialogs, real filesystem
 * access — categorically different from anything reachable from inside
 * a browser tab).
 */
export class FilesService {
  getStatus() {
    return { available: false, summary: "File access isn't implemented yet — this is prepared architecture, not a working feature." };
  }

  openFile(_path) {
    throw new Error("FilesService.openFile() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  openFolder(_path) {
    throw new Error("FilesService.openFolder() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  showSaveDialog(_suggestedName) {
    throw new Error("FilesService.showSaveDialog() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  showOpenDialog() {
    throw new Error("FilesService.showOpenDialog() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
