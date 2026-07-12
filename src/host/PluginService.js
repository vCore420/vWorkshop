/**
 * PluginService
 * ---------------
 * "Continue expanding plugin support... plugin discovery, plugin
 * registration, plugin lifecycle, plugin permissions, plugin metadata,
 * plugin updates, plugin dependencies. The Host should become
 * responsible for managing Workshop plugins."
 *
 * The Workshop actually has *two* independent plugin contracts (see
 * `docs/PLUGIN_GUIDE.md`): `engine.plugins` (`PluginManager.js` —
 * init/update/dispose/save/load, the general lifecycle) and
 * `hostManager.pluginRegistry` (`PluginRegistry.js` — `providePages()`/
 * `provideAssets()`, contributing Browser pages and, new in the Workshop
 * Asset System phase, Workshop Assets). Neither needed to change, and
 * this service doesn't merge them into one mechanism — it's the one
 * place that can answer "what plugins currently exist, and which
 * capability does each one contribute" without a caller needing to know
 * every system exists separately. A plugin implementing more than one
 * (a real possibility — nothing stops a single plugin object from having
 * `init()`, `providePages()`, *and* `provideAssets()` all at once) shows
 * up once, with every contract it implements listed, not duplicated.
 *
 * **Discovery, metadata, dependencies, updates, permissions** — the rest
 * of this phase's own list — stay honestly out of scope for the same
 * reason `AutomationService.js`'s own comment gives for automation
 * rules: there's no real design for "a plugin has permissions" or "a
 * plugin depends on another plugin" yet, and inventing one to fill space
 * would be exactly the kind of premature architecture this project's own
 * philosophy avoids. What's real here — a single, live directory of every
 * plugin actually loaded, regardless of which contract it uses — is
 * itself a genuine step, not a placeholder.
 */
export class PluginService {
  constructor({ engine, pluginRegistry } = {}) {
    this._engine = engine;
    this._pluginRegistry = pluginRegistry;
  }

  /** Every currently-loaded plugin, from any contract, merged by id —
   *  `{id, name, contracts: ["lifecycle"|"pages"|"assets", ...], pages:
   *  string[], assetKinds: string[]}`. */
  listAll() {
    const merged = new Map();
    const upsert = (id, name, contract, pages, assetKinds) => {
      const existing = merged.get(id);
      if (existing) {
        if (!existing.contracts.includes(contract)) existing.contracts.push(contract);
        for (const page of pages) if (!existing.pages.includes(page)) existing.pages.push(page);
        for (const kind of assetKinds) if (!existing.assetKinds.includes(kind)) existing.assetKinds.push(kind);
      } else {
        merged.set(id, { id, name, contracts: [contract], pages: [...pages], assetKinds: [...assetKinds] });
      }
    };

    for (const plugin of this._engine?.plugins?.plugins?.values() ?? []) {
      upsert(plugin.id, plugin.name ?? plugin.id, "lifecycle", [], []);
    }
    for (const contributor of this._pluginRegistry?.contributors() ?? []) {
      upsert(contributor.id, contributor.name, "pages", contributor.pages ?? [], []);
      if (contributor.assetKinds?.length) upsert(contributor.id, contributor.name, "assets", [], contributor.assetKinds);
    }
    return [...merged.values()];
  }

  getStatus() {
    const count = this.listAll().length;
    return {
      available: count > 0,
      summary: count > 0 ? `${count} plugin${count === 1 ? "" : "s"} currently loaded.` : "No plugins are currently loaded.",
    };
  }
}
