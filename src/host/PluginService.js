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
 * `hostManager.pluginRegistry` (`PluginRegistry.js` — `providePages()`,
 * contributing Browser pages). Neither needed to change, and this
 * service doesn't merge them into one mechanism — it's the one place
 * that can answer "what plugins currently exist, and which of the two
 * contracts does each one implement" without a caller needing to know
 * both systems exist separately. A plugin implementing *both* contracts
 * (a real possibility — nothing stops a single plugin object from having
 * both `init()` and `providePages()`) shows up once, with both contracts
 * listed, not twice.
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

  /** Every currently-loaded plugin, from either contract, merged by id —
   *  `{id, name, contracts: ["lifecycle"|"pages", ...], pages: string[]}`. */
  listAll() {
    const merged = new Map();
    const upsert = (id, name, contract, pages) => {
      const existing = merged.get(id);
      if (existing) {
        if (!existing.contracts.includes(contract)) existing.contracts.push(contract);
        for (const page of pages) if (!existing.pages.includes(page)) existing.pages.push(page);
      } else {
        merged.set(id, { id, name, contracts: [contract], pages: [...pages] });
      }
    };

    for (const plugin of this._engine?.plugins?.plugins?.values() ?? []) {
      upsert(plugin.id, plugin.name ?? plugin.id, "lifecycle", []);
    }
    for (const contributor of this._pluginRegistry?.contributors() ?? []) {
      upsert(contributor.id, contributor.name, "pages", contributor.pages ?? []);
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
