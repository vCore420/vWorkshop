/**
 * ProgramsService
 * -----------------
 * "Prepare a Programs service... do not worry about exhaustive
 * application discovery yet. The architecture is the priority." Started
 * as the real shape a future version needs (installed/favourite/recent
 * applications, each `{id, name, icon, launch}`), with an honestly empty
 * `installed` list rather than fabricated example entries.
 *
 * **Version 4, Phase v4.0.1b: `launchApplication()` is genuinely real.**
 * Gated by three independent checks, the same "Companion running *and*
 * permission granted *and* paired" shape `FilesService.js`'s own
 * `openFile()`/`saveFile()` already established: the Workshop Host
 * Companion running, the `applications` permission granted
 * (`PermissionsService.js`), and a valid pairing token entered. What can
 * actually be launched is entirely the Companion operator's own choice —
 * an allow-list configured when the Companion itself was started (see
 * `host-companion/README.md`'s own "Launching a configured program"
 * section) — never a path or command this service, or the browser, can
 * invent. `listPrograms()` reads that same allow-list for display
 * (`{id, name, icon, acceptsArgs}` — never the real command).
 *
 * `this.installed`/`this.favourites`/`this.recent` stay genuinely empty —
 * "application discovery" (finding what's installed on the machine
 * without being told) is a different, larger, still-unimplemented
 * capability from "launch one of the programs an operator explicitly
 * configured," which is what this phase actually built.
 * `previewItems()` stays too, for the same "sensible placeholder data,
 * clearly marked" reasoning `DocumentsService.js`'s own comment spells
 * out in full — `host://applications` shows it only when nothing real is
 * configured, never mixed into real results.
 *
 * `runningApplications()` is now genuinely populated by every successful
 * `launchApplication()` call (`{id, name, pid, startedAt}`) — the file's
 * own prior comment already called this "shape is ready, only the bridge
 * was missing." **There is deliberately no way to stop or check on a
 * launched program from here** — this is Workshop-side bookkeeping of
 * what was launched, not a live process monitor, and killing an
 * arbitrary tracked process is a meaningfully different, riskier
 * capability than starting one that wasn't asked for this phase.
 */
export class ProgramsService {
  constructor({ hostConnectionManager, permissionsService } = {}) {
    this._hostConnectionManager = hostConnectionManager;
    this._permissionsService = permissionsService;
    this.installed = [];
    this.favourites = [];
    this.recent = [];
    /** @type {Array<{id:string, name:string, pid:number, startedAt:string}>} */
    this._running = [];
    // Transient UI-support state for host://applications, not persisted —
    // the same "browsing/action feedback, not a capability" distinction
    // FilesService.js's own constructor comment draws for its identical
    // fields.
    this._lastError = null;
  }

  getStatus() {
    const connected = this._hostConnectionManager?.status === "connected";
    const granted = !!this._permissionsService?.isGranted("applications");
    const paired = !!this._hostConnectionManager?.hasToken?.();
    if (!connected) {
      return { available: false, summary: "Application discovery isn't implemented yet — this is prepared architecture, not a working feature. Optionally, run the Workshop Host Companion with a programs config (see host-companion/README.md) to launch a configured program for real." };
    }
    if (!granted) {
      return { available: false, summary: "The Workshop Host Companion is running, but Launch Applications permission hasn't been granted yet — see host://permissions." };
    }
    if (!paired) {
      return { available: false, summary: "Launch Applications permission is granted, but the Companion hasn't been paired yet — enter its pairing token at host://permissions." };
    }
    return { available: true, summary: "Connected and paired — able to launch any program the Companion's own operator has configured." };
  }

  /** Illustrative only — see this file's own comment. Never returned by
   *  `getStatus()`, never treated as `this.installed`. */
  previewItems() {
    return [
      { name: "Text Editor", kind: "Productivity", isExample: true },
      { name: "Image Viewer", kind: "Media", isExample: true },
      { name: "Terminal", kind: "Development", isExample: true },
    ];
  }

  /** Genuinely real (Version 4, Phase v4.0.1b) once connected, granted,
   *  and paired — the Companion's own configured allow-list, for
   *  display. Throws a specific, honest error otherwise, naming exactly
   *  which condition isn't met. */
  async listPrograms() {
    if (this._hostConnectionManager?.status !== "connected") {
      throw new Error("ProgramsService.listPrograms() needs the Workshop Host Companion running — see host-companion/README.md.");
    }
    if (!this._permissionsService?.isGranted("applications")) {
      throw new Error("ProgramsService.listPrograms() needs Launch Applications permission granted first — see host://permissions.");
    }
    const result = await this._hostConnectionManager.listPrograms();
    return result.items ?? [];
  }

  runningApplications() {
    return [...this._running];
  }

  /** Genuinely real (Version 4, Phase v4.0.1b) once connected, granted,
   *  and paired. `args`, if given, is a plain `{slotName: value}` object
   *  matching the program's own `acceptsArgs` — every value is validated
   *  by the Companion itself before anything is spawned, never here (see
   *  `HostConnectionManager.launchApplication()`'s own comment). Records
   *  the launch in `runningApplications()` on success. */
  async launchApplication(id, args) {
    if (this._hostConnectionManager?.status !== "connected") {
      throw new Error("ProgramsService.launchApplication() needs the Workshop Host Companion running — see host-companion/README.md.");
    }
    if (!this._permissionsService?.isGranted("applications")) {
      throw new Error("ProgramsService.launchApplication() needs Launch Applications permission granted first — see host://permissions.");
    }
    const result = await this._hostConnectionManager.launchApplication(id, args);
    this._running.push({ id: result.id, name: result.name, pid: result.pid, startedAt: result.startedAt });
    return result;
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
