import { EventBus } from "../core/EventBus.js";

/** "Filesystem access, hardware access, plugin capabilities, automation
 *  permissions, future network access" — the five categories named
 *  directly in this phase's own brief. */
export const PERMISSION_CATEGORIES = [
  { id: "filesystem", label: "Filesystem Access", description: "Reading, opening, or modifying files and folders on your own computer." },
  { id: "hardware", label: "Hardware Access", description: "Controllers, microphones, USB, Bluetooth, and other connected devices." },
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
 * section) is this phase's one genuinely real local-machine bridge —
 * `FilesService.js` checks `isGranted("filesystem")` *before* attempting
 * any real call to it, denying the request with an honest, specific
 * error if the category hasn't been granted, even when the Companion
 * itself is reachable. Every other category (hardware, plugins,
 * automation, network) has nothing real to gate yet, which is exactly
 * why they stay simple booleans rather than something more elaborate —
 * there's nothing to design against until a real capability exists to
 * protect.
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
