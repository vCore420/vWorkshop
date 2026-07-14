# Plugin guide

**Starting a new plugin? Read `docs/PLUGIN_SDK.md` first.** The Plugin
SDK phase built a friendlier, permission-aware `Workshop` facade on top
of everything this document describes — one `manifest` + `setup(Workshop)`
function instead of learning each registry below individually. Nothing
here changed shape or stopped working; this document remains accurate
for the underlying mechanisms (and for anything already written directly
against one of them), and the SDK's own docs point back to specific
sections here where it's useful to understand what's actually happening
underneath.

The workshop is meant to grow for a long time. Rather than editing core
systems every time a new idea shows up, most ideas should arrive as
**plugins**: self-contained objects registered with `engine.plugins`, with
no other system needing to know they exist. A second, narrower plugin
contract exists specifically for contributing Browser pages — see
"Adding your own Browser page" below — and the two are independent; a
plugin can use either, both, or neither.

A real, working example lives at
`src/plugins/examples/dustMotesPlugin.js` — it adds a drifting dust-mote
particle effect near the windows, reacts to time-of-day, and registers
(no-op) save/load hooks, without editing a single file outside its own. Read
it alongside this guide.

## The contract

```js
export function myPlugin(options) {
  return {
    id: "unique-plugin-id",        // required, must be unique

    init(engine) {                 // called once, when registered
      // engine.scene, engine.camera, engine.events, engine.entities,
      // engine.getSystem(SomeSystemClass) — all available here.
    },

    update(dt) {                   // optional, called every frame
    },

    dispose() {                    // optional, called if unregistered
    },

    save() {                       // optional — return JSON-serializable state
      return { ... };
    },

    load(data) {                   // optional — restore from previously saved state
    },
  };
}
```

Register it in `main.js`:

```js
import { myPlugin } from "./plugins/examples/myPlugin.js";
engine.plugins.register(myPlugin({ /* options */ }));
```

That's the entire integration surface. `PluginManager` (see
`src/core/PluginManager.js`) calls `init` immediately on registration,
`update` every frame, and wires `save`/`load` into `PersistenceSystem`
automatically — `main.js` already registers `engine.plugins` itself as a
persistence provider, so any plugin with `save`/`load` just works.

## What a plugin can do

Plugins are first-class citizens, not a restricted sandbox. Anything a core
system can do, a plugin can do:

- **Add visible things**: build `THREE.Object3D`s and add them to
  `engine.scene` directly (see the dust motes example), or go further and
  build a full furniture definition and pass it to `registerFurniture()`
  (`src/entities/furniture/registry.js`) — same shape as every built-in
  piece (`{ id, label, footprint, build(), interaction }`).
- **React to what's happening**: subscribe to any event on `engine.events`
  — `timeofday:changed`, `weather:changed`, `interaction:trigger`,
  `audio:trackChanged`, `persistence:save` / `persistence:load`, and so on.
  See the event list in `docs/ARCHITECTURE.md`.
- **Add a new physical interaction**: build an `Entity`, give it an
  `InteractableComponent` (see `src/core/components/InteractableComponent.js`)
  with a `prompt` and `onInteract`, and register it with
  `engine.entities.create(entity)`. If it should open a panel, have
  `onInteract` emit `interaction:trigger` with an `overlayId`, and register
  that overlay with `OverlayManager` (see the next section).
- **Persist state**: implement `save()`/`load(data)` as shown above, or —
  for a plugin with a substantial amount of state — construct its own store
  (like `ProjectsStore`/`NotesStore`) and call
  `engine.getSystem(PersistenceSystem).registerProvider(key, store)`
  directly from `init(engine)`.

## Adding your own workstation app

The computer (`src/computer/`) is its own self-contained object with the
same "register a factory" pattern as furniture and plugins — see
`src/computer/apps/registry.js`. An app is `{ id, label, glyph,
mount(container, ctx) -> dispose? }`, identical in shape to an overlay's
`mount`:

```js
import { registerAppFactory } from "./src/computer/apps/registry.js";

registerAppFactory((deps) => ({
  id: "my-app",
  label: "My App",
  glyph: "\u2726",
  mount(container, ctx) {
    container.innerHTML = "<h2>My App</h2>";
    return () => { /* optional cleanup */ };
  },
}));
```

Call `registerAppFactory` before `main.js` constructs `ComputerSystem`
(which calls `buildApps(deps)` once, in its own `init`). The new tab shows
up in the workstation's icon rail automatically — nothing about the panel,
the projection, or the power-on sequence needs to change.

## Adding your own workbench presence type

The workbench (`src/workbench/`) uses the same pattern again, one level
more granular: instead of registering a whole panel tab, you're registering
one *physical item* a project can choose to have on the bench. See
`src/workbench/presence/registry.js` and any file in
`src/workbench/presence/builders/` for a working example — they're all
short.

```js
import { registerPresenceType } from "./src/workbench/presence/registry.js";

registerPresenceType("myThing", (item) => {
  const object3D = /* build placeholder geometry, local origin at the
                       slot's position, feet at y = 0 relative to the slot */;
  return { object3D, size: "small" }; // or "medium" / "large" — see slots.js
});
```

A project opts into it purely through data — no code changes elsewhere —
by including `{ type: "myThing" }` (plus whatever extra fields your builder
reads off `item`, e.g. `variant` or `color`) in its `presence` array, or by
adding it to a `kindTemplates.js` recipe. `WorkbenchSystem` and `slots.js`
never need to know this type exists; they only ever call
`buildPresenceItem(item)` and place whatever comes back.

## Adding your own object behaviour

The world creation system (`src/worldbuilder/`, see `docs/WORLDBUILDER.md`)
uses the same registration pattern once more, for the smallest unit yet: a
single attachable behaviour any custom Builder-designed object can carry.

```js
import { registerBehaviour } from "./src/worldbuilder/behaviours/registry.js";

registerBehaviour("myBehaviour", {
  label: "My Behaviour",
  ownsInteractable: true, // false if it doesn't attach an InteractableComponent
  propsSchema: [
    { key: "prompt", label: "Prompt", type: "text", default: "Do the thing" },
  ],
  apply({ entity, object3D, properties, engine, instance, definition }) {
    // Usually: entity.addComponent(new InteractableComponent({ ... }))
    // — see any file in src/worldbuilder/behaviours/ for a working example.
  },
});
```

Import your registration file from somewhere that runs before
`main.js` constructs `ComputerSystem` (which builds the Builder app's
behaviour checkboxes from whatever's registered). The Builder's form,
`WorldObjectsSystem`'s spawning, and the interaction pipeline all pick up
a new behaviour with zero other changes — the same "register once, used
everywhere" property every registry in this codebase has.

The **Trigger** behaviour is worth knowing about specifically: it emits
`engine.events.emit("worldObject:trigger", { eventName, instanceId, definitionId })`
on interact, using whatever `eventName` the person building the object
typed in. Nothing listens for a specific name today — a plugin subscribing
to `worldObject:trigger` and switching on `eventName` is the natural way to
make a custom object *do* something a behaviour's `apply()` alone can't
express (open a plugin's own overlay, start a mini-game, whatever), without
the object or the Trigger behaviour needing to change.

## Adding your own overlay

Overlays are plain DOM, deliberately framework-free, and reuse one of four
"materials" defined in `css/overlays.css` (`screen`, `paper`, `cork`,
`panel`) so a new panel feels like it belongs in the room rather than like a
foreign UI kit got pasted in.

```js
overlayManager.register("my-plugin-panel", {
  materialClass: "panel", // or "screen" / "paper" / "cork"
  mount(panelEl, context, engine) {
    panelEl.innerHTML = "<h2>My plugin</h2>";
    // ... build whatever DOM you need inside panelEl ...
    return () => { /* optional cleanup when the overlay closes */ };
  },
});
```

`overlayManager` isn't currently exposed on `engine` — if your plugin needs
to register an overlay, either register it directly in `main.js` next to
the built-in overlays, or have `main.js` pass the `overlayManager` instance
into your plugin's factory function as an option (see how
`createWindowOverlay({ weatherSystem, timeOfDaySystem })` receives its
dependencies for the pattern to follow).

## Adding your own Browser page

"Plugins should be capable of registering Browser pages... naturally
integrate into Browser navigation without requiring hardcoded support."
Distinct from the `engine.plugins` contract above — this is
`src/host/PluginRegistry.js`, narrower and specific to one thing: which
pages a plugin contributes to the Browser (see `docs/BROWSER.md`'s own
"Plugin Pages" section for the full architecture).

```js
export function myPagePlugin() {
  return {
    id: "my-page-plugin",           // required, must be unique
    name: "My Page Plugin",         // shown in host://plugins
    pages: ["plugin://my-thing"],   // optional — purely a declared manifest for host://plugins' own display

    providePages(pageRegistry) {    // called once, immediately, with the real PageRegistry
      pageRegistry.register("plugin://my-thing", () => ({
        title: "My Thing",
        html: `<h1>My Thing</h1><p>Ordinary HTML — see PageShell.js for what wraps this automatically.</p>`,
      }));
    },
  };
}
```

Register it in `main.js`, next to any built-in Host service:

```js
import { myPagePlugin } from "./plugins/examples/myPagePlugin.js";
hostManager.pluginRegistry.registerPlugin(myPagePlugin());
```

That's the entire integration surface — `BrowserApp.js` and
`PageRegistry.js` treat `plugin://` exactly the same way they treat
`workshop://` and `host://`; neither needed a single change for a new
plugin page to become navigable. Two real, working examples exist at
`src/plugins/examples/examplePagePlugin.js` (a minimal reference
implementation — read it alongside this section) and
`src/plugins/examples/calculatorPlugin.js` (a genuinely interactive page,
demonstrating that a plugin page can be a small application, not only a
document). If your page needs real interactivity, an inline `<script>`
tag inside the returned `html` works exactly the way `calculatorPlugin.js`
already demonstrates — the page is rendered via `srcdoc`, so ordinary
DOM APIs and event listeners work as they would anywhere else.

## Adding your own Workshop Asset

"Plugins should naturally register Workshop Assets. Plugins should not
require special handling. Assets installed through plugins should appear
inside the Workshop Asset Library exactly like native assets." The same
`src/host/PluginRegistry.js` a plugin already uses for pages — an
optional second method, `provideAssets(assetService)`, called once,
immediately, with the real `AssetService` (see `docs/HOST.md`'s own
"Asset Service" section and `src/host/WorkshopAssetSchema.js` for the
full architecture).

```js
import { buildSwatchThumbnail } from "../../host/WorkshopAssetSchema.js";

const MY_ITEMS = [{ id: "thing-1", name: "A Thing", color: "#7fae62" }];

export function myAssetPlugin() {
  return {
    id: "my-asset-plugin",
    name: "My Asset Plugin",
    assetKinds: ["my-plugin-things"],  // optional — purely a declared manifest for host://plugins' own display

    provideAssets(assetService) {      // called once, immediately, with the real AssetService
      assetService.registerKind("my-plugin-things", {
        label: "My Plugin Things",
        all: () => MY_ITEMS,
        get: (id) => MY_ITEMS.find((item) => item.id === id) ?? null,
        toDescriptor: (item) => ({
          name: item.name,
          author: "My Asset Plugin",
          categories: ["Effects"],       // see WorkshopAssetSchema.WORKSHOP_ASSET_CATEGORIES for the suggested vocabulary
          tags: ["example"],
          thumbnail: buildSwatchThumbnail([item.color]),
        }),
        // getDependencies(item) and validateItem(item) are both optional
        // too — see AssetService.js's own comment for what each does.
      });
    },
  };
}
```

Register it in `main.js`, the identical line a page-registering plugin
already uses:

```js
hostManager.pluginRegistry.registerPlugin(myAssetPlugin());
```

That's the entire integration surface — `AssetService.js`,
`AssetPages.js`, and `workshop://search` all treat a plugin-registered
kind exactly the same way they treat Objects, Blueprints, or any other
built-in kind; none of them needed a single change. A real, working
example exists at `src/plugins/examples/examplePagePlugin.js` — three
small "sticker" assets, registered alongside that same plugin's own
`plugin://example-plugin` page, demonstrating that a single plugin can
implement both contracts at once.

## Ideas this contract is designed to support later

The brief's "future philosophy" list maps onto this system directly —
none of these need a core-engine change to arrive, just a plugin (and
possibly a furniture definition + overlay):

- **GitHub integration** — a plugin that polls a repo (via `fetch`, from
  `init` or `update`) and renders commit/issue activity into an overlay on,
  say, the pinboard or a new "terminal" object on the desk.
- **Local AI companion** — a plugin occupying the sitting area's `restNook`
  overlay (or its own furniture piece), talking to a locally-run model over
  `fetch`.
- **Workshop calculators** — no longer only an idea: `plugin://calculator`
  (see "Adding your own Browser page" above) is a real, working example.
  A workstation-app version (opened as its own computer tab rather than a
  Browser page) would follow the identical "Adding your own workstation
  app" pattern instead, if that ever reads as the better fit.
- **Seasonal changes** — a plugin listening to `timeofday:changed` (which
  already exposes a normalized `dayFactor`) or a real calendar date, and
  adjusting decoration, window tint, or lighting color temperature.
- **Personal collections** — a furniture definition (a display case, a
  corkboard of photos) plus a store plugin, following the exact same
  pattern as `ProjectsStore` — or, now, simply a Builder-designed object
  with a Decoration behaviour (and a Storage one nearby), no plugin code
  required at all.
- **Anything reacting to a custom object being used** — subscribe to
  `worldObject:trigger` (see "Adding your own object behaviour" above)
  rather than building a bespoke interaction path.

## A note on taste

Not everything needs to be a plugin, and not everything needs to exist yet.
Several furniture pieces in this phase (tool storage, the shelving archive)
are intentionally honest placeholders — interacting with them says "this
isn't built yet" rather than faking a feature. When you do build the real
thing, that's the moment to reach for this guide.
