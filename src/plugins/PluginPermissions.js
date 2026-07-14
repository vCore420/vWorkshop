import { EventBus } from "../core/EventBus.js";
import { PLUGIN_CAPABILITIES } from "./PluginManifest.js";

/**
 * PluginPermissions
 * --------------------
 * "Plugins should request access to Workshop capabilities rather than
 * receiving unrestricted access... permissions should be easy for users
 * to understand." One plain, persisted store — `{ [pluginId]: {
 * requested: string[], granted: Record<string, boolean> } }` — kept
 * deliberately separate from the Host's own `PermissionsService.js`
 * (which grants at the *Workshop* level — filesystem, hardware, and so
 * on) rather than merged into it: those are Workshop-wide switches
 * anyone using the Browser sees; these are per-*plugin* records, a
 * different shape and a different audience (`host://plugins`, not
 * `host://permissions`).
 *
 * **Auto-granted on first request, not a blocking install prompt.**
 * There's no real sandbox here — a plugin is same-origin JavaScript
 * running in the same page as everything else, loaded because a person
 * chose to add it to their own Workshop, not a download from a
 * marketplace of strangers. A permission *prompt* in that situation
 * would be theatre: it can't actually stop a plugin's own code from
 * doing anything JavaScript can do. What's real, and worth building, is
 * **transparency and after-the-fact control** — a manifest's declared
 * `permissions` are recorded and immediately granted so the plugin works
 * the moment it loads, and the Plugin Manager (`host://plugins`) shows
 * exactly what each plugin asked for, with a genuine revoke available
 * any time. `WorkshopSDK.js`'s own methods check `isGranted()` before
 * doing anything, so a revoked capability really does stop working —
 * the SDK method logs a clear warning and returns without acting,
 * rather than silently pretending to succeed.
 *
 * Re-requesting (a plugin reload, or the Workshop restarting) preserves
 * any revoke a person made by hand — `requestCapabilities()` only ever
 * fills in capabilities it's never seen before for that plugin id,
 * never resets one already on record.
 */
export class PluginPermissions {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, {requested: string[], granted: Record<string, boolean>}>} */
    this._grants = {};
  }

  /** Called once by `PluginLoader.js` when a plugin first registers.
   *  Unknown capability ids (already caught by `validateManifest()`
   *  before this is ever reached, but checked again here defensively)
   *  are silently dropped rather than recorded. */
  requestCapabilities(pluginId, capabilities = []) {
    const known = capabilities.filter((c) => PLUGIN_CAPABILITIES.some((cap) => cap.id === c));
    const existing = this._grants[pluginId];
    const granted = existing?.granted ?? {};
    for (const capabilityId of known) {
      if (!(capabilityId in granted)) granted[capabilityId] = true; // first time this plugin has ever asked — auto-grant
    }
    this._grants[pluginId] = { requested: known, granted };
    this._emitChanged();
  }

  isGranted(pluginId, capabilityId) {
    return this._grants[pluginId]?.granted?.[capabilityId] === true;
  }

  /** Only ever re-grants a capability the plugin's own manifest actually
   *  requested — this can't be used to hand a plugin something it never
   *  declared wanting. */
  grant(pluginId, capabilityId) {
    const entry = this._grants[pluginId];
    if (!entry || !entry.requested.includes(capabilityId)) return;
    entry.granted[capabilityId] = true;
    this._emitChanged();
  }

  revoke(pluginId, capabilityId) {
    const entry = this._grants[pluginId];
    if (!entry) return;
    entry.granted[capabilityId] = false;
    this._emitChanged();
  }

  /** `[{id, label, description, granted}]` for exactly the capabilities
   *  this plugin declared — the Plugin Manager's own per-plugin
   *  permission list reads this directly, nothing to recompute. */
  forPlugin(pluginId) {
    const entry = this._grants[pluginId];
    if (!entry) return [];
    return entry.requested.map((id) => {
      const capability = PLUGIN_CAPABILITIES.find((c) => c.id === id);
      return { id, label: capability?.label ?? id, description: capability?.description ?? "", granted: entry.granted[id] === true };
    });
  }

  /** Drops a plugin's own record entirely — called when a plugin is
   *  genuinely removed (not merely disabled), so a since-uninstalled
   *  plugin doesn't linger in the Plugin Manager's own permission list
   *  forever. */
  forget(pluginId) {
    delete this._grants[pluginId];
    this._emitChanged();
  }

  _emitChanged() {
    this.events.emit("pluginPermissions:changed");
    this.events.emit("persistence:saveRequested");
  }

  getStatus() {
    const pluginCount = Object.keys(this._grants).length;
    return { available: true, summary: pluginCount > 0 ? `${pluginCount} plugin${pluginCount === 1 ? "" : "s"} with recorded permissions.` : "No plugin has requested any capability yet." };
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { grants: this._grants };
  }

  load(data) {
    if (!data?.grants) return;
    this._grants = data.grants;
  }
}
