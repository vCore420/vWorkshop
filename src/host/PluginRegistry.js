/**
 * PluginRegistry (Host)
 * ------------------------
 * "Prepare a Plugin Registry... the Browser should eventually discover
 * additional Workshop pages through registered plugins." Distinct from
 * `src/core/PluginManager.js`, which already exists and already handles
 * a plugin's general lifecycle (`init(engine)`/`update(dt)`/`save()`/
 * `load()` — see `docs/PLUGIN_GUIDE.md`). This is narrower and specific
 * to one thing: which pages a plugin wants to contribute, so a future
 * plugin can extend the Browser (see `docs/BROWSER.md`) without either
 * system needing to know about the other's internals.
 *
 * A plugin registers its own pages the exact same way any built-in
 * system does — `providePages(pageRegistry)` receives the real
 * `PageRegistry` instance and calls `register()` on it directly (under
 * the `plugin://` scheme, by convention — see `PageRegistry.js`'s own
 * `INTERNAL_SCHEMES`), no separate translation layer. This file's own
 * job is just remembering *which* plugins have contributed pages, for
 * the Host Dashboard's "Plugins" section to list — it never intercepts
 * or wraps the actual registration itself.
 *
 * **Browser Ecosystem phase**: `plugin.pages` (optional, an array of the
 * URLs it intends to register) is new — purely a declared manifest for
 * `host://plugins`'s own display, not something this registry verifies
 * against what `providePages()` actually did. Two real, working example
 * plugins now exercise this end-to-end — see
 * `src/plugins/examples/examplePagePlugin.js` and
 * `src/plugins/examples/calculatorPlugin.js` — rather than this
 * mechanism only existing on paper.
 */
export class PluginRegistry {
  constructor(pageRegistry) {
    this.pageRegistry = pageRegistry;
    this._contributors = [];
  }

  getStatus() {
    const count = this._contributors.length;
    return count > 0
      ? { available: true, summary: `${count} plugin${count === 1 ? "" : "s"} contributing Workshop pages.` }
      : { available: false, summary: "No plugins have registered any Workshop pages yet — this is prepared architecture, not a working feature." };
  }

  /** `plugin` is `{id, name, pages: string[] (optional), providePages(pageRegistry)}`
   *  — called once, immediately, handing the plugin the real registry to
   *  register against directly. */
  registerPlugin(plugin) {
    if (typeof plugin.providePages === "function") plugin.providePages(this.pageRegistry);
    this._contributors.push({ id: plugin.id, name: plugin.name ?? plugin.id, pages: plugin.pages ?? [] });
  }

  contributors() {
    return this._contributors;
  }
}
