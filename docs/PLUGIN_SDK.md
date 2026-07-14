# Plugin SDK (Version 2, Phase 12)

"Without modifying the Workshop source code, a developer should be
capable of creating a plugin that adds a Browser page, a Phone
application, a Builder asset, and a Workshop service using only the
documentation and the included example plugin." This document, and
`src/plugins/examples/workshopToolkitPlugin.js`, are that documentation
and that example.

If you've read `docs/PLUGIN_GUIDE.md` already: this doc doesn't replace
it. The Plugin SDK is a friendlier facade *built on top of* the
registries `PLUGIN_GUIDE.md` documents (`PageRegistry`, `AssetService`,
the Phone/Computer app registries, `ServiceRegistry`, the Construction
Library) — none of them changed shape. If you're maintaining an existing
plugin written against one of those directly, it still works exactly as
it did; there's nothing to migrate. If you're starting a new plugin,
start here instead — it's less to learn, and it comes with real
permissions and lifecycle management the older contracts don't have.

## Quick start

```js
// myPlugin.js
export function myPlugin() {
  return {
    manifest: {
      id: "your-name.my-plugin",
      name: "My Plugin",
      version: "1.0.0",
      permissions: ["browser"],
    },
    setup(Workshop) {
      Workshop.registerPage("plugin://my-thing", () => ({
        title: "My Thing",
        html: "<h1>My Thing</h1><p>Hello from a plugin.</p>",
      }));
    },
  };
}
```

```js
// main.js, alongside the Workshop's own Plugin SDK section
import { myPlugin } from "./plugins/examples/myPlugin.js";
loadWorkshopPlugin(myPlugin(), pluginContext);
```

That's a complete, working plugin. Everything below is what else `Workshop` can do, and why it's built the way it is.

## Plugin architecture

A plugin is two things:

1. **A manifest** — a plain object describing what the plugin is and
   what it wants to do. See "Manifest" below.
2. **A `setup(Workshop)` function** — called once, handed a `Workshop`
   object scoped to this one plugin. Everything the plugin does, it does
   through `Workshop`.

```js
{
  manifest: { id, name, version, permissions, ... },
  setup(Workshop) { /* ... */ },
}
```

Nothing else is required. A plugin that only wants a Browser page never
needs to touch anything about assets, the Phone, or storage.

**Why a facade, not direct access to the real registries.** "A plugin
should register itself. The Workshop should understand what it
provides." `Workshop` is the one place that's true: every
`Workshop.register*()` call is tracked (for `host://plugins`, the Plugin
Manager), every capability is checked against what the manifest actually
declared (for a clear warning instead of a silent no-op), and every
registration this file makes gets automatically undone if the plugin is
later disabled — none of which a plugin reaching into `PageRegistry`
directly would get for free. See `src/plugins/WorkshopSDK.js` for the
real implementation; it's short, and worth reading once.

## Plugin lifecycle

```
Loading → Validation → Registration → Initialization → Activation
                                                            ↕
                                                       Deactivation
                                                            ↓
                                                        Unloading
```

- **Loading** — your plugin module is imported (an ordinary ES module
  import) and its factory function called, producing the
  `{manifest, setup}` object.
- **Validation** — `loadWorkshopPlugin()` checks the manifest
  (`PluginManifest.validateManifest()`) before anything else happens. A
  missing `id`/`name`/`version`, or an unknown `permissions` entry,
  refuses the plugin with a specific, actionable console error — nothing
  partially loads.
- **Registration** — the plugin becomes a real entry in `PluginManager`
  (`engine.plugins`), the same one `docs/PLUGIN_GUIDE.md`'s original
  contract already used. This is what makes it visible to
  `host://plugins`, `Enable`/`Disable`/`Reload`-able, and error-isolated.
- **Initialization/Activation** — `setup(Workshop)` runs, followed by
  `Workshop.lifecycle()`'s own `init()` hook if the plugin registered
  one. From this point the plugin is `"active"`.
- **Deactivation** — `Disable` (from `host://plugins`, or a future
  automated reason) calls `Workshop.lifecycle()`'s own `dispose()` hook,
  then automatically undoes every page/asset/event-listener registration
  the SDK tracked. The plugin's own manifest and permission record stay
  intact — this is "turned off," not "forgotten."
- **Unloading** — genuinely removing a plugin's own record entirely
  (its permission grants, its storage). Not exposed as a one-click
  Plugin Manager action in this phase — see "Known simplifications."

**"The Workshop should remain stable even if a plugin fails."** Every
call into a plugin's own code — `setup()`, any `Workshop.lifecycle()`
hook — is wrapped by `PluginManager._safeCall()`. A thrown error is
logged clearly, marks that one plugin `"error"`, and stops there; it
never reaches `engine.init()` or the frame loop, and every other
plugin (and the Workshop itself) keeps working normally.

## Manifest

```js
{
  id: "your-name.plugin-id",  // required — unique. Dotted convention (author.plugin) by voluntary practice, not enforced
  name: "Human-Readable Name", // required
  version: "1.0.0",            // required — a plain string
  description: "What it does.", // optional
  author: "Your name",          // optional
  permissions: ["assets", "browser"], // optional — see "Permissions" below
  minWorkshopVersion: "2.1.2",  // optional — see "Version checking" below
}
```

`id`/`name`/`version` are the only required fields — see
`src/plugins/PluginManifest.js`'s own `validateManifest()` for the exact
rule set. Extra fields you add for your own purposes (a `homepage`, a
`license`) are preserved on the manifest object and simply ignored by
the Workshop itself.

**Version checking.** `minWorkshopVersion` is compared against the
Workshop's own running version with a small semver-lite comparison
(`PluginManifest.isVersionAtLeast()` — no `^`/`~`/pre-release ranges,
just "is this at least that new"). A mismatch **warns, it doesn't
block** — there's no reliable way to know in advance whether a plugin
actually needs the newer version for something essential or would work
fine regardless, so the honest choice is to say so clearly and let the
plugin try anyway.

## Permissions

"Plugins should request access to Workshop capabilities rather than
receiving unrestricted access... permissions should be easy for users to
understand."

| Capability | What it gates |
|---|---|
| `assets` | `registerAsset()`, `assets()` |
| `browser` | `registerPage()`, `browser()` |
| `phone` | `registerPhoneApp()`, `registerComputerApp()` |
| `builder` | `registerBuilderAsset()` |
| `host` | `registerService()`, `host()` |
| `projects` | `projects()` |
| `storage` | never gated — see below |
| `residents` | `registerResident()` — architecture only, not yet functional |
| `automation` | reserved for a future capability — not yet functional |
| `hardware` | reserved for a future capability — not yet functional |

**Auto-granted, not a blocking install prompt.** There's no real sandbox
here — a plugin is same-origin JavaScript running in the same page as
everything else, loaded because a person chose to add it to their own
Workshop. A permission *prompt* in that situation can't actually stop a
plugin's own code from doing anything JavaScript can do — it would be
theatre. What's real, and what this phase actually builds, is
**transparency and after-the-fact control**: every capability a
manifest declares is recorded and granted immediately (so the plugin
works the moment it loads), and `host://plugins` shows exactly what each
plugin asked for, with a genuine revoke available any time. Revoke one,
and the matching `Workshop.*` method stops working immediately — it logs
a clear warning and returns, rather than silently pretending to succeed.

**`storage` is never gated.** `Workshop.storage` can only ever reach the
plugin's own isolated namespace (see "Storage" below) — there's nothing
shared for a capability grant to protect it from.

Call `Workshop.registerX()` without declaring the matching capability,
and you'll see this in the console instead of your registration
happening:

```
[Plugin:your-name.my-plugin] "Workshop.registerPage" needs the "browser"
capability. Add "browser" to manifest.permissions, or grant it from the
Plugin Manager (host://plugins).
```

## SDK APIs

Every method below is available on the `Workshop` object your `setup()`
receives.

```js
Workshop.manifest                        // this plugin's own manifest, unmodified
Workshop.log(...args)                    // console.log, prefixed "[Plugin:your-id]"

Workshop.registerPage(url, provider)     // needs "browser" — see docs/BROWSER.md
Workshop.registerAsset(kind, definition) // needs "assets" — see docs/ASSETS.md
Workshop.registerPhoneApp(factory)       // needs "phone" — see docs/PHONE.md
Workshop.registerComputerApp(factory)    // needs "phone" — the Computer's own equivalent
Workshop.registerBuilderAsset(piece)     // needs "builder" — see docs/WORLDBUILDER.md
Workshop.registerService(name, service)  // needs "host" — see docs/HOST.md
Workshop.registerResident(descriptor)    // needs "residents" — architecture only, see below

Workshop.lifecycle({init, update, dispose, save, load}) // the original engine.plugins contract, reached through the SDK

Workshop.events.on(eventName, handler)   // never gated — auto-cleaned-up on disable
Workshop.events.off(eventName, handler)
Workshop.events.emit(eventName, payload)

Workshop.storage.get(key)                // never gated — isolated per plugin
Workshop.storage.set(key, value)
Workshop.storage.remove(key)
Workshop.storage.keys()

Workshop.projects()   // needs "projects" — { all(), byStatus(status) }
Workshop.assets()     // needs "assets"   — { search(query), get(kind, id), kinds() }
Workshop.browser()    // needs "browser"  — { pages() }
Workshop.host()       // needs "host"     — { service(name), status() }
```

Each is a thin wrapper over a registry that already existed — see
`src/plugins/WorkshopSDK.js`'s own comments for exactly what each one
delegates to. None of the underlying registries changed shape for this
phase; the SDK is the only new surface.

### Registering a Browser page

```js
Workshop.registerPage("plugin://my-thing", () => ({
  title: "My Thing",
  html: "<h1>My Thing</h1>",
}));
```

The provider can be `async` and read live data — see
`docs/BROWSER.md`'s "Plugin Pages" section for the full `{title, html}`
contract, and `src/plugins/examples/calculatorPlugin.js` for a page
that's a genuinely interactive small application, not just a document.

**A page runs in a sandboxed `srcdoc`, not your plugin's own JS
context.** It can `postMessage` to the parent for specific actions
already wired up by the Workshop (see `host://permissions`' own
checkboxes for the pattern), but it has no direct access to `Workshop`
or your plugin's own closures. If you need real interactivity backed by
`Workshop.storage` or another SDK capability, a Phone or Computer app is
the better fit — see `workshopToolkitPlugin.js`'s own "Why the Phone
app, not the Browser page" comment for this reasoning in full.

### Registering a Phone or Computer app

```js
Workshop.registerPhoneApp(() => ({
  id: "my-app",
  label: "My App",
  glyph: "\u2726",
  mount(container) {
    container.innerHTML = "<h2>My App</h2>";
    return () => { /* optional cleanup */ };
  },
}));
```

Identical shape for `registerComputerApp()`. **Known simplification**:
call this from `setup()`, called the ordinary way (see "Developer
workflow" below) — the Phone and Computer each build their own app list
exactly once, early in `main.js`, before either exists. A plugin loaded
the ordinary way always makes this deadline; see "Known simplifications"
for what that means for disable/reload.

### Registering a Builder asset

```js
Workshop.registerBuilderAsset({
  id: "myPiece",
  name: "My Piece",
  description: "What it is.",
  group: "Utilities", // optional — see ConstructionLibrary.js's own CONSTRUCTION_GROUP_ORDER
  parts: [
    { id: "a", type: "box", position: [0, 0.5, 0], rotationY: 0, scale: [0.4, 1, 0.4], color: "#8a6a48" },
  ],
});
```

The same `parts` shape any Construction Library piece or Builder-designed
object uses — see `docs/WORLDBUILDER.md`. Unlike Phone/Computer apps,
this one is genuinely live: available in Build Mode immediately, and
cleanly removed if the plugin is disabled.

### Registering a service

```js
Workshop.registerService("my-service", {
  getStatus() { return { available: true, summary: "Working." }; },
});
```

Shows up in `host://services`' own "Available Capabilities" the moment
it registers — see `docs/HOST.md`.

### Storage

```js
Workshop.storage.set("settings", { theme: "dark" });
const settings = Workshop.storage.get("settings");
```

Isolated per plugin (two plugins can both use the key `"settings"`
without collision), persisted exactly like everything else in the
Workshop, with no plugin-specific persistence code to write. Values must
be JSON-serialisable and reasonably small (under roughly 500KB once
serialised) — this is for settings and small data sets, not a general
file store. See `src/plugins/PluginStorage.js`.

### Events

```js
Workshop.events.on("timeofday:changed", ({ hour }) => { /* ... */ });
```

The full event vocabulary is the same one every core system already
uses — see `docs/ARCHITECTURE.md`'s own event list. Subscriptions made
this way are tracked and automatically removed if the plugin is
disabled; a plugin that needs a listener to survive its own disable
(rare) can still reach `engine.events` directly via
`Workshop.lifecycle({init(engine) {...}})`.

## Asset Integration

"Everything should become discoverable through the existing Asset
Library." `Workshop.registerAsset(kind, definition)` is
`AssetService.registerKind()` — the exact mechanism Objects, Blueprints,
Animations, Models, Images, and Music already use. `definition` is:

```js
{
  label: "My Things",
  all: () => [...],              // every item of this kind
  get: (id) => item | null,
  toDescriptor: (item) => ({ name, author, categories, tags, thumbnail }),
  getDependencies: (item) => [],  // optional
  validateItem: (item) => [],     // optional — array of problem strings
}
```

Once registered, items of this kind appear in the Shared Asset Library,
`workshop://search`, and everywhere else a Workshop Asset shows up —
nothing about `AssetService.js`, `AssetPages.js`, or search needed to
change, or even know, a plugin is the source. See `docs/ASSETS.md` and
`src/host/WorkshopAssetSchema.js`'s own `buildSwatchThumbnail()` for a
simple way to build a thumbnail with no image file.

## Browser Integration

See "Registering a Browser page" above and `docs/BROWSER.md`'s own
"Plugin Pages" section. Plugin pages live under `plugin://` alongside
`workshop://` and `host://` — the Browser treats every internal scheme
identically.

## Phone Integration

See "Registering a Phone or Computer app" above and `docs/PHONE.md`.

## Builder Integration

See "Registering a Builder asset" above and `docs/WORLDBUILDER.md`. A
plugin wanting a genuinely new *behaviour* (not just a new piece) still
uses the original, lower-level `registerBehaviour()` from
`docs/PLUGIN_GUIDE.md` — the SDK doesn't wrap that one yet; see "Known
simplifications."

## Resident Integration

"Continue preparing for future resident plugins... establish clean
extension points where appropriate." `Workshop.registerResident()`
exists and is reachable, but is honestly inert — it logs the request and
nothing more. There's no real design yet for a second, plugin-authored
resident coexisting with Bubble (see `docs/RESIDENT.md`'s own "Multiple
residents" future extension point); inventing one to fill space here
would be exactly the kind of premature architecture this project's own
philosophy avoids. When that design exists, this is the method that
will do something.

## The Plugin Manager

`host://plugins` (also `workshop://plugins`) is "the central place for
managing Workshop extensions" — every currently-loaded plugin, from any
of the Workshop's three plugin mechanisms (the original `engine.plugins`
contract, the original `pluginRegistry` pages/assets contract, and this
phase's own SDK), with:

- **Status** — Active, Disabled, or Error (with the actual error
  message) — only ever real for a plugin loaded through
  `loadWorkshopPlugin()`; the two original example plugins show as
  "engine.plugins / pluginRegistry contract (no manifest)" instead,
  honestly, since that contract has no status concept at all.
- **Enable / Disable / Reload** — real buttons, calling straight through
  to `PluginManager`. See "Plugin lifecycle" above for exactly what each
  one does.
- **Permissions** — every capability the plugin's manifest declared,
  each with a genuine grant/revoke checkbox.
- **What it actually registered** — its pages and asset kinds, read live
  from the plugin's own SDK instance, not just what the manifest
  declared it might want.

## Developer workflow

1. Copy `src/plugins/examples/workshopToolkitPlugin.js` as a starting
   point, or write the "Quick start" shape above from scratch.
2. Import your plugin factory in `main.js`, near the existing Plugin SDK
   section (search for `loadWorkshopPlugin`), and call
   `loadWorkshopPlugin(myPlugin(), pluginContext)` there.
3. Reload the Workshop. Check the console for validation errors or
   permission warnings — both are specific and actionable by design (see
   "Developer Experience" below).
4. Visit `host://plugins` to confirm your plugin loaded, see what it
   registered, and review its permissions.
5. **Hot reload where practical** — a Browser page, an asset kind, a
   service, or a `Workshop.lifecycle()` hook can all be genuinely
   reloaded from `host://plugins`' own "Reload" button while the
   Workshop keeps running. A Phone or Computer app registration can't
   (see "Known simplifications") — for those, reload the whole page.

There's no separate build step or plugin bundler — a plugin is an
ordinary ES module, imported the same way every other file in this
project is.

## Best practices

- **Declare only the permissions you use.** `host://plugins` is more
  useful, and more trustworthy, when a plugin's declared permissions
  actually reflect what it does.
- **Prefer `Workshop.events.on()` over `engine.events` directly** (only
  reachable via `Workshop.lifecycle({init(engine)})`) so your
  subscriptions clean up automatically on disable.
- **Keep `Workshop.storage` values small and simple** — settings and
  small data sets, not a general file store (see "Storage" above).
- **One manifest `id`, chosen once.** Changing it later is registering a
  new, unrelated plugin as far as permissions and storage are concerned
  — neither carries over.
- **Read `src/plugins/examples/workshopToolkitPlugin.js` end to end**
  before writing your own — it's short, and every capability above
  appears in it at least once, in context.

## Known simplifications (by design, for this phase)

- **Phone/Computer app registrations can't be cleanly undone.** Both
  registries build their app list exactly once, early in startup —
  disabling a plugin that registered one leaves the tab in place until
  the Workshop itself reloads. Pages, asset kinds, services, and event
  listeners all genuinely reload; this one honestly doesn't yet.
- **No dynamic install/uninstall flow.** Every plugin currently loads
  from a `loadWorkshopPlugin()` call written into `main.js` — there's no
  "paste a URL and install it" UI. `host://plugins`' own "Unload"
  concept (see "Plugin lifecycle" above) exists in the architecture
  (`PluginPermissions.forget()`, `PluginStorage.clear()`) but isn't
  wired to a one-click action yet, since without real install/uninstall
  there's nothing meaningful to trigger it from.
- **No dependency resolution.** A manifest doesn't currently declare
  "requires plugin X" — every plugin loads independently, in whatever
  order `main.js` lists them.
- **`registerBehaviour()` (a new Builder *behaviour*, not just a new
  piece) isn't wrapped by the SDK** — it's still reached the original,
  lower-level way documented in `docs/PLUGIN_GUIDE.md`.
- **Version checking warns, never blocks** — see "Manifest" above.
- **No real sandboxing** — see "Permissions" above. This is an honest
  property of same-origin JavaScript, not something a future phase can
  simply add; genuine isolation would mean running plugin code in a
  Worker or iframe, a materially different (and much larger)
  undertaking than this phase's own scope.

## Future extension points

- **A real install/uninstall flow** — pasting a URL or picking a file,
  rather than every plugin being a line in `main.js`. The permission and
  storage architecture (`forget()`/`clear()`) is already shaped to
  support genuinely removing a plugin's own record; only the UI and the
  loading mechanism itself are missing.
- **A live Phone/Computer app registry** — the one piece of "hot reload
  where practical" this phase couldn't reach; see "Known
  simplifications."
- **Dependency declarations** (`manifest.dependencies`, named in the
  brief) — real plugin-to-plugin dependencies, once more than one
  interdependent plugin actually exists to design against.
- **`registerBehaviour()` through the SDK**, completing Builder
  Integration.
- **Real Resident plugins** — see "Resident Integration" above.
- **Automation and Hardware capabilities becoming real** — both already
  have a named place in `PLUGIN_CAPABILITIES`; each needs the matching
  Host-level capability (`AutomationService.js`, `HardwareService.js`) to
  become real first, the same dependency `docs/HOST.md`'s own honest
  placeholders already describe.
- **A plugin marketplace or directory** — genuinely out of scope until
  install/uninstall exists to install *into*.
