import { EventBus } from "../core/EventBus.js";

/** "Filesystem access, hardware access, plugin capabilities, automation
 *  permissions, future network access" — the five categories named
 *  directly in this phase's own brief.
 *
 *  **Version 4, Phase 1: filesystem access split in two.** The original
 *  single `filesystem` boolean gated only ever one real capability
 *  (listing a folder). Now that `FilesService.openFile()`/`saveFile()`
 *  are genuinely real too, reading and writing are different enough risk
 *  levels to deserve independent grants — revoking the ability to write
 *  shouldn't also revoke the ability to read, and vice versa.
 *  `filesystem-read` covers listing and opening; `filesystem-write`
 *  covers saving. `applications` was added alongside them, prepared the
 *  same honest way `hardware`/`automation`/`network` still are —
 *  and, as of Version 4, Phase v4.0.1b, is genuinely real too:
 *  `ProgramsService.listPrograms()`/`launchApplication()` both check
 *  `isGranted("applications")` before reaching the Companion, the same
 *  "connected *and* granted *and* paired" shape `FilesService.js`
 *  already established. What can actually be launched is entirely the
 *  Companion operator's own configured allow-list — granting this
 *  permission only lets the *Workshop* ask to launch one of those
 *  already-approved programs, never supply its own. See
 *  `src/systems/SaveMigrations.js`'s own v4→v5 entry for how an existing
 *  `filesystem: true` grant carries forward (as `filesystem-read`, not
 *  also `filesystem-write` — write is a strictly more powerful
 *  capability nobody had actually consented to yet). */
export const PERMISSION_CATEGORIES = [
  { id: "filesystem-read", label: "Filesystem Read", description: "Listing folders and reading files on your own computer." },
  { id: "filesystem-write", label: "Filesystem Write", description: "Creating or editing files on your own computer." },
  { id: "hardware", label: "Hardware Access", description: "Controllers, microphones, USB, Bluetooth, and other connected devices." },
  { id: "applications", label: "Launch Applications", description: "Launching a program the Workshop Host Companion's own operator has explicitly configured — the Workshop can never choose its own program or command." },
  { id: "plugins", label: "Plugin Capabilities", description: "What a Workshop plugin is allowed to do beyond the Browser itself." },
  { id: "automation", label: "Automation", description: "Scheduled tasks and background jobs acting on your behalf." },
  { id: "network", label: "Network Access", description: "Connecting to services beyond your own computer." },
];

/**
 * PermissionsService
 * ---------------------
 * "Please begin introducing a permissions architecture... the goal is
 * simply to prepare a sensible architecture for future Workshop
 * expansion." Genuinely real, unlike most of what this phase prepares —
 * there's no local-machine bridge yet for any of these categories to
 * meaningfully gate, but the grant/revoke state itself is ordinary,
 * working, persisted data; nothing about it is a placeholder.
 *
 * **Already has real teeth, not just a future promise.** The Workshop
 * Host Companion (`docs/HOST.md`'s own "Workshop Host Companion"
 * section) is the real local-machine bridge every one of these checks
 * ultimately gates — `FilesService.js` checks `isGranted("filesystem-read")`/
 * `isGranted("filesystem-write")`, and (Version 4, Phase v4.0.1b)
 * `ProgramsService.js` checks `isGranted("applications")`, each *before*
 * attempting any real call to it, denying the request with an honest,
 * specific error if the relevant category hasn't been granted, even when
 * the Companion itself is reachable. `hardware`/`plugins`/`automation`/
 * `network` are the remaining categories with nothing real to gate yet,
 * which is exactly why they stay simple booleans rather than something
 * more elaborate — there's nothing to design against until a real
 * capability exists to protect.
 *
 * All-`false` by default — "granted" is something a person opts into,
 * never an assumed starting state, the same instinct behind
 * `MemoryConfiguration.js`'s own `mode: "disabled"` default.
 */
export class PermissionsService {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, boolean>} */
    this.grants = {};
    for (const category of PERMISSION_CATEGORIES) this.grants[category.id] = false;
  }

  categories() {
    return PERMISSION_CATEGORIES;
  }

  isGranted(id) {
    return this.grants[id] === true;
  }

  grant(id) {
    if (!(id in this.grants) || this.grants[id]) return;
    this.grants[id] = true;
    this._emitChanged();
  }

  revoke(id) {
    if (!(id in this.grants) || !this.grants[id]) return;
    this.grants[id] = false;
    this._emitChanged();
  }

  _emitChanged() {
    this.events.emit("permissions:changed");
    this.events.emit("persistence:saveRequested");
  }

  getStatus() {
    const grantedCount = Object.values(this.grants).filter(Boolean).length;
    return { available: true, summary: `${grantedCount} of ${PERMISSION_CATEGORIES.length} permission categories currently granted.` };
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { grants: this.grants };
  }

  load(data) {
    if (!data?.grants) return;
    for (const category of PERMISSION_CATEGORIES) {
      if (typeof data.grants[category.id] === "boolean") this.grants[category.id] = data.grants[category.id];
    }
  }
}
