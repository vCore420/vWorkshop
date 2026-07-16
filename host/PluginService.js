/**
 * PluginService
 * ---------------
 * "Continue expanding plugin support... plugin discovery, plugin
 * registration, plugin lifecycle, plugin permissions, plugin metadata,
 * plugin updates, plugin dependencies. The Host should become
 * responsible for managing Workshop plugins."
 *
 * The Workshop has *three* ways a plugin can currently exist (see
 * `docs/PLUGIN_SDK.md`): the original `engine.plugins`
 * (`PluginManager.js` — init/update/dispose/save/load), the original
 * `hostManager.pluginRegistry` (`PluginRegistry.js` —
 * `providePages()`/`provideAssets()`, still fully supported,
 * unchanged), and, new in the Plugin SDK phase, any plugin loaded
 * through `PluginLoader.js`/`WorkshopSDK.js` — which, notably, *also*
 * becomes a real `engine.plugins` entry (see `PluginLoader.js`'s own
 * comment), carrying its own manifest, live status
 * (`"active"`/`"disabled"`/`"error"`), and permission grants along with
 * it. This service's job is still just answering "what plugins
 * currently exist, and what does each one provide" without a caller
 * needing to know any of these three mechanisms exist separately —
 * `PluginManager.list()` now already carries the richer SDK-era detail,
 * so this file mostly just reads it and folds it in.
 */
export class PluginService {
  constructor({ engine, pluginRegistry, pluginPermissions } = {}) {
    this._engine = engine;
    this._pluginRegistry = pluginRegistry;
    this._pluginPermissions = pluginPermissions;
  }

  /** Every currently-loaded plugin, from any contract, merged by id —
   *  `{id, name, contracts, pages, assetKinds, manifest, state, error,
   *  permissions}`. `manifest`/`state`/`error`/`permissions` are only
   *  ever real for a plugin loaded through `PluginLoader.js`; a plugin
   *  registered the older, direct way still shows up, just without
   *  those fields (`manifest: null`, `state: "active"`, `permissions:
   *  []`) — exactly as honest as that plugin's own contract actually is. */
  listAll() {
    const merged = new Map();
    const ensure = (id, name) => {
      if (!merged.has(id)) merged.set(id, { id, name, contracts: [], pages: [], assetKinds: [], manifest: null, state: "active", error: null, permissions: [] });
      return merged.get(id);
    };
    const addContract = (entry, contract, pages = [], assetKinds = []) => {
      if (!entry.contracts.includes(contract)) entry.contracts.push(contract);
      for (const page of pages) if (!entry.pages.includes(page)) entry.pages.push(page);
      for (const kind of assetKinds) if (!entry.assetKinds.includes(kind)) entry.assetKinds.push(kind);
    };

    for (const plugin of this._engine?.plugins?.list() ?? []) {
      const entry = ensure(plugin.id, plugin.name);
      addContract(entry, "lifecycle");
      entry.manifest = plugin.manifest;
      entry.state = plugin.state ?? "active";
      entry.error = plugin.error ?? null;
      if (plugin.manifest) {
        // Loaded through PluginLoader.js — "sdk" marks that distinctly
        // from a plugin only ever using the bare engine.plugins contract,
        // and its own registered pages/assetKinds (live, from
        // WorkshopSDK.js — see PluginManager.list()'s own comment) fold
        // in exactly like the older pluginRegistry contract's would.
        addContract(entry, "sdk", plugin.pages, plugin.assetKinds);
        entry.permissions = this._pluginPermissions?.forPlugin(plugin.id) ?? [];
      }
    }
    for (const contributor of this._pluginRegistry?.contributors() ?? []) {
      const entry = ensure(contributor.id, contributor.name);
      addContract(entry, "pages", contributor.pages ?? [], []);
      if (contributor.assetKinds?.length) addContract(entry, "assets", [], contributor.assetKinds);
    }
    return [...merged.values()];
  }

  getStatus() {
    const all = this.listAll();
    const errorCount = all.filter((p) => p.state === "error").length;
    return {
      available: all.length > 0,
      summary: all.length > 0
        ? `${all.length} plugin${all.length === 1 ? "" : "s"} currently loaded${errorCount > 0 ? ` (${errorCount} with errors)` : ""}.`
        : "No plugins are currently loaded.",
    };
  }

  // ---- actions, called from BrowserApp.js's own message handler —
  // the same "the real call always happens where the actual reference
  // lives, never inside the srcdoc page itself" rule host://permissions'
  // own checkboxes already follow (see HostPages.js's own comment).
  // Only ever meaningful for a plugin loaded through PluginLoader.js
  // (real engine.plugins entries) — a no-op, not an error, for one
  // registered the older, direct way, since that contract has no
  // enable/disable concept at all.

  enablePlugin(id) {
    this._engine?.plugins?.enable(id);
  }

  disablePlugin(id) {
    this._engine?.plugins?.disable(id);
  }

  reloadPlugin(id) {
    this._engine?.plugins?.reload(id);
  }

  grantPermission(pluginId, capabilityId) {
    this._pluginPermissions?.grant(pluginId, capabilityId);
  }

  revokePermission(pluginId, capabilityId) {
    this._pluginPermissions?.revoke(pluginId, capabilityId);
  }
}
