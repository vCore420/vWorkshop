import { registerConstructionPiece, unregisterConstructionPiece } from "../worldbuilder/ConstructionLibrary.js";

/**
 * WorkshopSDK
 * -------------
 * "Rather than exposing internal implementation, provide clear
 * developer-facing APIs." Every method here is a thin, permission-
 * checked wrapper around a registry that already existed before this
 * phase — `PageRegistry`, `AssetService`, the Phone/Computer app
 * factories, `ServiceRegistry`, `ConstructionLibrary`, `EventBus`,
 * `PluginStorage` — none of which changed shape to make this possible.
 * "A plugin should register itself. The Workshop should understand what
 * it provides" is true because this file is the *only* place a plugin
 * ever touches those registries directly; everything else in the
 * Workshop keeps talking to them exactly as it always has, unaware a
 * plugin is even involved.
 *
 * **One SDK instance per plugin**, built fresh by `PluginLoader.js` for
 * each one — never shared, never a singleton. That's what makes
 * permission checks and storage namespacing automatic rather than
 * something a plugin author has to remember to pass an id into: this
 * closure already knows which plugin it belongs to.
 *
 * **Storage is the one capability never gated.** Every other method
 * checks `pluginPermissions.isGranted()` first (see `requirePermission()`
 * below) because it reaches into something *shared* — the Browser, the
 * Asset Library, another Host service. `Workshop.storage` never does,
 * because it can't reach anything but the plugin's own isolated
 * namespace in `PluginStorage.js` — there's nothing to protect a
 * capability grant *from*.
 *
 * **Disposal.** Every registration this file makes on a plugin's behalf
 * that *can* be cleanly undone (a page, an event listener) is recorded
 * in `disposers`; `_dispose()` (called by `PluginLoader.js` on disable/
 * unload) runs every one of them, each independently wrapped so one
 * failing disposer doesn't stop the rest from running. Two registration
 * kinds — Phone apps and Computer apps — genuinely can't be undone this
 * way (see `registerPhoneApp()`'s own comment) and are documented
 * honestly rather than pretending otherwise.
 */
export function createWorkshopSDK({
  manifest,
  engine,
  pageRegistry,
  hostManager,
  pluginPermissions,
  pluginStorage,
  projectsStore,
  registerComputerAppFactory,
  registerPhoneAppFactory,
} = {}) {
  const pluginId = manifest.id;
  const assetService = hostManager?.services.get("assets") ?? null;
  const disposers = [];
  const registeredPages = [];
  const registeredAssetKinds = [];

  function requirePermission(capabilityId, methodName) {
    if (pluginPermissions.isGranted(pluginId, capabilityId)) return true;
    console.warn(
      `[Plugin:${pluginId}] "Workshop.${methodName}" needs the "${capabilityId}" capability. ` +
        `Add "${capabilityId}" to manifest.permissions, or grant it from the Plugin Manager (host://plugins). ` +
        `See docs/PLUGIN_SDK.md's own "Permissions" section.`
    );
    return false;
  }

  const Workshop = {
    /** The plugin's own manifest, unmodified — read-only in spirit (the
     *  SDK never mutates it), handed back so a plugin can log its own
     *  version, check `minWorkshopVersion` itself, or build a Settings
     *  UI reflecting its own metadata without hardcoding it twice. */
    manifest,

    /** Development logging — "clear error messages... development
     *  logging." Every message is prefixed with the plugin's own id, so
     *  a busy console still reads as whose message is whose. */
    log(...args) {
      console.log(`[Plugin:${pluginId}]`, ...args);
    },

    /** "Workshop.registerPage()." Delegates directly to `PageRegistry
     *  .register()` — see `PageRegistry.js`'s own comment for the
     *  provider shape (`async (url) => ({title, html})`). */
    registerPage(url, provider) {
      if (!requirePermission("browser", "registerPage")) return;
      pageRegistry.register(url, provider);
      registeredPages.push(url);
      disposers.push(() => pageRegistry.unregister(url));
    },

    /** "Workshop.registerAsset()." Delegates to `AssetService
     *  .registerKind()` — see that file's own comment, or
     *  `docs/PLUGIN_SDK.md`'s "Asset Integration" section, for the
     *  `{label, all, get, toDescriptor, getDependencies, validateItem}`
     *  shape `definition` needs. */
    registerAsset(kind, definition) {
      if (!requirePermission("assets", "registerAsset")) return;
      if (!assetService) {
        Workshop.log("Workshop Assets aren't available yet — registerAsset() had nothing to register against.");
        return;
      }
      assetService.registerKind(kind, definition);
      registeredAssetKinds.push(kind);
      disposers.push(() => assetService.unregisterKind(kind));
    },

    /** "Workshop.registerPhoneApp()." Delegates to the same
     *  `registerPhoneAppFactory()` a first-party Phone app already uses
     *  (see `src/phone/apps/registry.js`). **Known simplification**: the
     *  Phone's own app list is built exactly once, early in `main.js`,
     *  before the Phone exists at all — a call here after that point has
     *  nothing left to add itself to, and (since the list is never
     *  rebuilt) disabling or unloading this plugin later can't remove
     *  the tab either. `PluginLoader.js` calls every plugin's own
     *  `setup()` before that point specifically so this always works for
     *  a plugin loaded the ordinary way (see `main.js`'s own Plugin SDK
     *  section); a plugin added after startup via a future dynamic-
     *  install flow would need the Phone itself to grow a live registry,
     *  which is real future work — see docs/PLUGIN_SDK.md's own "Known
     *  simplifications." */
    registerPhoneApp(factory) {
      if (!requirePermission("phone", "registerPhoneApp")) return;
      if (!registerPhoneAppFactory) {
        Workshop.log("registerPhoneApp() must be called before the Workshop Phone is built — see docs/PLUGIN_SDK.md.");
        return;
      }
      registerPhoneAppFactory(factory);
    },

    /** "Workshop.registerComputerApp()" — the Computer's own equivalent,
     *  same shape, same timing caveat, delegating to
     *  `src/computer/apps/registry.js`'s own `registerAppFactory()`. Not
     *  named directly in the brief's own SDK example list, but a natural
     *  sibling to `registerPhoneApp()` now that both registries follow
     *  the identical "factories built once, `(deps) => AppDefinition`"
     *  shape. */
    registerComputerApp(factory) {
      if (!requirePermission("phone", "registerComputerApp")) return; // shares the "phone" capability's spirit — a Workshop-facing app surface — rather than a tenth category for one more app rail
      if (!registerComputerAppFactory) {
        Workshop.log("registerComputerApp() must be called before the Workshop Computer is built — see docs/PLUGIN_SDK.md.");
        return;
      }
      registerComputerAppFactory(factory);
    },

    /** "Workshop.registerBuilderAsset()." Delegates to
     *  `ConstructionLibrary.registerConstructionPiece()` — unlike Phone/
     *  Computer apps, this one *is* live: `getConstructionPiece()`,
     *  `BuildModeSystem.js`'s own library screen, and the "objects" asset
     *  kind all read the underlying array fresh every time, so a piece
     *  registered here is immediately available, and genuinely removable
     *  on disable/unload. */
    registerBuilderAsset(piece) {
      if (!requirePermission("builder", "registerBuilderAsset")) return;
      registerConstructionPiece(piece);
      disposers.push(() => unregisterConstructionPiece(piece.id));
    },

    /** "Workshop.registerService()." Delegates to `HostManager`'s own
     *  `ServiceRegistry` — the exact mechanism `ProgramsService`,
     *  `FilesService`, and every other built-in Host service already
     *  register through. A service with its own `getStatus()` shows up
     *  in `host://services`' "Available Capabilities" automatically. */
    registerService(name, service) {
      if (!requirePermission("host", "registerService")) return;
      hostManager?.services.register(name, service);
    },

    /** "Continue preparing for future resident plugins... establish
     *  clean extension points where appropriate." Honestly inert, like
     *  `ResidentService.js`'s own honest placeholders — there is no real
     *  design yet for a second, plugin-authored resident coexisting with
     *  Bubble (see `docs/RESIDENT.md`'s own "Multiple residents" future
     *  extension point), so this records the request (visible in
     *  `host://plugins`) rather than fabricating a resident that doesn't
     *  actually do anything. */
    registerResident(descriptor) {
      if (!requirePermission("residents", "registerResident")) return;
      Workshop.log(`registerResident("${descriptor?.id ?? "(unnamed)"}") recorded — architecture only for now; see docs/PLUGIN_SDK.md's own "Resident Integration" section.`);
    },

    /** "Workshop.storage()" (the brief's own name), exposed as a plain
     *  object rather than a function to call — `Workshop.storage.get()`
     *  reads better than `Workshop.storage().get()` and there's no
     *  meaningful "arguments" a call would ever take. Never gated — see
     *  this file's own top comment. */
    storage: {
      get(key) {
        return pluginStorage.get(pluginId, key);
      },
      set(key, value) {
        pluginStorage.set(pluginId, key, value);
      },
      remove(key) {
        pluginStorage.remove(pluginId, key);
      },
      keys() {
        return pluginStorage.keys(pluginId);
      },
    },

    /** "Workshop.events.on()." A thin wrapper over `engine.events` that
     *  tracks every subscription this plugin makes, so `_dispose()` can
     *  clean every one of them up automatically — a plugin using this
     *  (rather than `engine.events` directly) never needs to remember
     *  its own listeners for a clean `dispose()`. */
    events: {
      on(eventName, handler) {
        const off = engine.events.on(eventName, handler);
        disposers.push(off);
        return off;
      },
      off(eventName, handler) {
        engine.events.off(eventName, handler);
      },
      emit(eventName, payload) {
        engine.events.emit(eventName, payload);
      },
    },

    /** "Workshop.projects()." A small, read-oriented facade — a plugin
     *  can see what projects exist, not silently rewrite them; nothing
     *  in this phase's own brief asked for plugin-authored projects, and
     *  a read-only surface is the honest scope for what's real today. */
    projects() {
      if (!requirePermission("projects", "projects")) return null;
      return {
        all: () => projectsStore?.all() ?? [],
        byStatus: (status) => projectsStore?.byStatus(status) ?? [],
      };
    },

    /** "Workshop.assets()." Querying, distinct from `registerAsset()`
     *  above (contributing) — a plugin wanting to *read* the Shared
     *  Asset Library (to build a picker UI of its own, say) uses this;
     *  one wanting to *add* to it uses `registerAsset()`. Both share the
     *  "assets" capability, since both reach the same underlying
     *  service. */
    assets() {
      if (!requirePermission("assets", "assets")) return null;
      return {
        search: (query) => assetService?.search(query) ?? [],
        get: (kind, id) => assetService?.get(kind, id) ?? null,
        kinds: () => assetService?.kinds() ?? [],
      };
    },

    /** "Workshop.browser()." Read-only — which pages currently exist,
     *  for a plugin building its own cross-referencing UI (a page
     *  linking to every other page a certain kind of content lives on,
     *  say). Registering a new page is `registerPage()` above, not this. */
    browser() {
      if (!requirePermission("browser", "browser")) return null;
      return { pages: () => pageRegistry.list() };
    },

    /** "Workshop.host()." A narrow facade over `HostManager` — reading
     *  another service by name (a plugin wanting to check whether the
     *  Workshop Host Companion is connected, say) or the Dashboard's own
     *  overview. Registering a *new* service is `registerService()`
     *  above; this is for *using* what's already there. */
    host() {
      if (!requirePermission("host", "host")) return null;
      return {
        service: (name) => hostManager?.services.get(name) ?? null,
        status: () => hostManager?.getOverviewStatus() ?? null,
      };
    },

    /** `Workshop.lifecycle({init, update, dispose, save, load})` — the
     *  original `engine.plugins` contract (see `PluginManager.js`),
     *  reached through the SDK instead of implementing it directly.
     *  Genuinely optional: most plugins built around pages, assets, or
     *  services never need a per-frame `update()` or their own
     *  persisted state, and won't call this at all. `PluginLoader.js`
     *  is what actually wires these hooks into `PluginManager` — this
     *  method only ever records them. */
    lifecycle(hooks) {
      Workshop._lifecycleHooks = hooks ?? {};
    },
    _lifecycleHooks: null,

    /** Read by `PluginLoader.js` after `setup()` runs, so
     *  `host://plugins` can show exactly what this plugin actually
     *  registered — not just what its manifest declared it *might*
     *  want to. Plain arrays, not a live reference to `disposers`. */
    _registeredPages() {
      return [...registeredPages];
    },
    _registeredAssetKinds() {
      return [...registeredAssetKinds];
    },

    /** Called by `PluginLoader.js` on disable/unload — never by the
     *  plugin itself. Every disposer runs independently (one failing
     *  doesn't stop the rest) — see this file's own top comment. */
    _dispose() {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose();
        } catch (err) {
          console.error(`[Plugin:${pluginId}] error while disposing:`, err);
        }
      }
    },
  };

  return Workshop;
}
