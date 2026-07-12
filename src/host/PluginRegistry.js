/**
 * PluginRegistry (Host)
 * ------------------------
 * "Prepare a Plugin Registry... the Browser should eventually discover
 * additional Workshop pages through registered plugins." Distinct from
 * `src/core/PluginManager.js`, which already exists and already handles
 * a plugin's general lifecycle (`init(engine)`/`update(dt)`/`save()`/
 * `load()` — see `docs/PLUGIN_GUIDE.md`). This is narrower and specific
 * to two things a plugin might want to contribute: pages, and (new in
 * the Workshop Asset System phase) Workshop Assets — so a plugin can
 * extend the Browser or the Asset Library without either system needing
 * to know about the other's internals.
 *
 * A plugin registers its own pages the exact same way any built-in
 * system does — `providePages(pageRegistry)` receives the real
 * `PageRegistry` instance and calls `register()` on it directly (under
 * the `plugin://` scheme, by convention — see `PageRegistry.js`'s own
 * `INTERNAL_SCHEMES`), no separate translation layer. `provideAssets
 * (assetService)` works identically, calling `registerKind()` directly —
 * "assets installed through plugins should appear inside the Workshop
 * Asset Library exactly like native assets" is true by construction,
 * since a plugin-registered kind goes through the exact same
 * `AssetService.registerKind()` every built-in kind (Objects,
 * Blueprints...) already does. This file's own job is just remembering
 * *which* plugins have contributed what, for the Host Dashboard's
 * "Plugins" section to list — it never intercepts or wraps the actual
 * registration itself.
 *
 * Both `providePages`/`provideAssets` are optional — a plugin can
 * implement either, both, or neither (in which case it's only visible
 * through `engine.plugins`, if it implements that contract too; see
 * `PluginService.js`'s own comment on how both contracts are unified for
 * display).
 */
export class PluginRegistry {
  constructor(pageRegistry, assetService) {
    this.pageRegistry = pageRegistry;
    this.assetService = assetService;
    this._contributors = [];
  }

  getStatus() {
    const count = this._contributors.length;
    return count > 0
      ? { available: true, summary: `${count} plugin${count === 1 ? "" : "s"} contributing Workshop pages or assets.` }
      : { available: false, summary: "No plugins have registered any Workshop pages or assets yet — this is prepared architecture, not a working feature." };
  }

  /** `plugin` is `{id, name, pages: string[] (optional), assetKinds:
   *  string[] (optional), providePages(pageRegistry),
   *  provideAssets(assetService)}` — both functions, if present, are
   *  called once, immediately, handing the plugin the real registry/
   *  service to register against directly. */
  registerPlugin(plugin) {
    if (typeof plugin.providePages === "function") plugin.providePages(this.pageRegistry);
    if (typeof plugin.provideAssets === "function" && this.assetService) plugin.provideAssets(this.assetService);
    this._contributors.push({ id: plugin.id, name: plugin.name ?? plugin.id, pages: plugin.pages ?? [], assetKinds: plugin.assetKinds ?? [] });
  }

  contributors() {
    return this._contributors;
  }
}
