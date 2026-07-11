/**
 * PluginRegistry (Host)
 * ------------------------
 * "Prepare a Plugin Registry. Do not build a plugin system yet... the
 * Browser should eventually discover additional Workshop pages through
 * registered plugins." Distinct from `src/core/PluginManager.js`, which
 * already exists and already handles a plugin's general lifecycle
 * (`init(engine)`/`update(dt)`/`save()`/`load()` — see
 * `docs/PLUGIN_GUIDE.md`). This is narrower and specific to one thing:
 * which `workshop://` pages a plugin wants to contribute, so a future
 * plugin can extend the Browser (see `docs/BROWSER.md`) without either
 * system needing to know about the other's internals.
 *
 * A plugin registers its own pages the exact same way any built-in
 * system does — `providePages(pageProvider)` receives the real
 * `PageRegistry` instance and calls `register()` on it directly, no
 * separate translation layer. This file's own job is just remembering
 * *which* plugins have contributed pages, for the Host Dashboard's
 * "Plugins" section to list — it never intercepts or wraps the actual
 * registration itself.
 */
export class PluginRegistry {
  constructor(pageRegistry) {
    this.pageRegistry = pageRegistry;
    this._contributors = [];
  }

  getStatus() {
    return { available: false, summary: "No plugins have registered any Workshop pages yet — this is prepared architecture, not a working feature." };
  }

  /** `plugin` is `{id, name, providePages(pageRegistry)}` — called once,
   *  immediately, handing the plugin the real registry to register
   *  against directly. */
  registerPlugin(plugin) {
    if (typeof plugin.providePages === "function") plugin.providePages(this.pageRegistry);
    this._contributors.push({ id: plugin.id, name: plugin.name ?? plugin.id });
  }

  contributors() {
    return this._contributors;
  }
}
