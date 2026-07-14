import { validateManifest, isVersionAtLeast } from "./PluginManifest.js";
import { createWorkshopSDK } from "./WorkshopSDK.js";

/**
 * PluginLoader
 * --------------
 * "Loading. Registration. Initialization. Activation. Deactivation.
 * Unloading. Version checking. Validation. Error reporting." The one
 * function every SDK-style plugin passes through, tying together
 * everything else this phase added — `PluginManifest.js` (validation,
 * version checking), `WorkshopSDK.js` (the facade), `PluginPermissions
 * .js` (capability requests), and `PluginManager.js` (the actual
 * lifecycle: init/update/dispose/save/load, error isolation, enable/
 * disable/reload) — without any of those four files needing to know
 * about each other directly.
 *
 * A plugin passed here is `{ manifest, setup(Workshop) }` — deliberately
 * the smallest possible shape. `setup()` receives the one `Workshop`
 * object and does everything through it (`registerPage`, `registerAsset`,
 * `lifecycle`, ...); there's no second `providePages`/`provideAssets`
 * split to remember, unlike the older direct
 * `hostManager.pluginRegistry.registerPlugin()` contract (still fully
 * supported, unchanged, for anything already written against it — see
 * `docs/PLUGIN_GUIDE.md`).
 *
 * **Every SDK-style plugin becomes a real `engine.plugins` entry**,
 * even one that never calls `Workshop.lifecycle()` — this is what makes
 * `PluginManager` the single, authoritative place `host://plugins`
 * reads from for status, manifest, and permissions, rather than a third
 * parallel bookkeeping structure. A plugin's own `update()`/`save()`/
 * `load()` only ever fire if it opted in via `Workshop.lifecycle()`;
 * `init()`/`dispose()` always fire (calling `setup()`/tearing down the
 * SDK's own disposers), whether or not lifecycle hooks exist.
 */
export function loadWorkshopPlugin(plugin, context) {
  const { engine, pluginPermissions } = context;
  const manifest = plugin?.manifest;

  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    console.error(`[PluginLoader] Refused to load a plugin — invalid manifest:`, errors);
    return null;
  }

  if (manifest.minWorkshopVersion && context.workshopVersion && !isVersionAtLeast(context.workshopVersion, manifest.minWorkshopVersion)) {
    console.warn(
      `[PluginLoader] "${manifest.id}" declares minWorkshopVersion "${manifest.minWorkshopVersion}", but this Workshop is "${context.workshopVersion}". ` +
        `Loading anyway — version checks warn, they don't block — but some capabilities this plugin expects may not exist yet.`
    );
  }

  pluginPermissions.requestCapabilities(manifest.id, manifest.permissions ?? []);
  const sdk = createWorkshopSDK({ manifest, ...context });

  const wrapped = {
    id: manifest.id,
    name: manifest.name,
    manifest,
    init: (engineRef) => {
      plugin.setup?.(sdk);
      sdk._lifecycleHooks?.init?.(engineRef);
    },
    update: (dt) => sdk._lifecycleHooks?.update?.(dt),
    dispose: () => {
      sdk._lifecycleHooks?.dispose?.();
      sdk._dispose();
    },
    save: () => sdk._lifecycleHooks?.save?.(),
    load: (data) => sdk._lifecycleHooks?.load?.(data),
    // Read by PluginService.js/host://plugins — what this plugin
    // actually registered through the SDK, not just what its manifest
    // declared it might want to. Live getters, not a snapshot taken
    // once at load time, so they stay accurate through a reload.
    get pages() {
      return sdk._registeredPages();
    },
    get assetKinds() {
      return sdk._registeredAssetKinds();
    },
  };

  engine.plugins.register(wrapped);
  return wrapped;
}
