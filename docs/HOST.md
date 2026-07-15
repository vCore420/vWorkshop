# The Workshop Host

"Version 1 introduced the Workshop Host as a proof of concept. Version 2
is about completing it... the Host should become the Workshop's
operating system. The Browser remains where the player interacts with
the Workshop. The Host becomes the engine quietly working beneath it."
The Host is a lightweight, purely architectural companion — no window, no
rail icon, no interface of its own. Everything it offers is reached
through the Browser. This document covers how it's built; `docs/BROWSER.md`
covers the Browser side of the same relationship.

## Host philosophy

```
Browser
  ↓
Workshop Host        (this file, and everything under src/host/)
  ↓
Local Machine        (optionally, for real, via the Workshop Host
                       Companion — see "The Workshop Host Companion"
                       below)
```

"The Browser displays pages. The Host provides services. The Browser
should never directly perform local machine operations." This separation
is real in the code, not just a diagram: `BrowserApp.js` has no
`src/host/` import anywhere in it besides `hostManager` itself (passed in
for exactly two things — the Permissions checkboxes and the pinned-
projects buttons, both of which still only ever call a Host *service*
method, never touch a local machine directly). Every capability the Host
offers arrives as a `workshop://`/`host://` page, the same mechanism
`docs/BROWSER.md` established for every other page.

"The player should rarely think about the Host directly. Instead, they
should simply notice that everything within the Workshop naturally works
together." Concretely: nobody needs to know `HostConnectionManager.js`
exists to use the Workshop. The one thing that *is* worth a player's
attention — granting a permission, running the Companion — is exactly
the one thing this phase makes genuinely visible and interactive
(`host://permissions`), not buried.

## Architecture: eighteen small, separated files

`src/host/`, following the exact "separate responsibilities" instinct
`src/ai/` and `src/resident/` already established. This phase's own
brief names nine services explicitly; all nine now exist.

- **`ServiceRegistry.js`** — the generic registry a service registers
  itself with, the same shape `PageRegistry.js` already uses for pages.
- **`HostManager.js`** — the one top-level container: owns the registry,
  the `PluginRegistry`, and (new this phase) `PermissionsService`
  directly (`hostManager.permissions`, not filed under `services` like
  everything else — see "Permissions" below for why); registers every
  service that doesn't need late-constructed dependencies at
  construction time, and computes the Dashboard's own overview status
  live from whatever's actually registered.
- **Application Service** (`ProgramsService.js`, registered under both
  `"programs"` and `"applications"`), **File Service**
  (`FilesService.js`), **Project Service** (`ProjectsService.js`),
  **Automation Service** (`AutomationService.js`), **Hardware Service**
  (`HardwareService.js`), **Documents** (`DocumentsService.js`),
  **Downloads** (`DownloadsService.js`) — each with the *real* shape a
  future version needs already in place; see "Service Registry and
  honest placeholders" below for which parts of each are genuinely real
  today.
- **Asset Service** (`AssetService.js`, new in the Workshop Platform
  phase, substantially expanded in the Workshop Asset System phase) —
  genuinely real, not honestly-empty; paired with **`WorkshopAssetSchema.js`**
  (new in the Workshop Asset System phase — the shared descriptor shape
  and category vocabulary, not a service itself). See docs/ASSETS.md for
  the full account.
- **Plugin Service** (`PluginService.js`, new this phase), **Resident
  Service** (`ResidentService.js`, new this phase), **Diagnostics
  Service** (`DiagnosticsService.js`, new this phase) — all three need
  stores or the engine itself, neither of which exist yet at the point
  `main.js` constructs `HostManager`; all three are constructed and
  registered later, in `main.js`'s own "Workshop Platform" wiring block,
  the exact "register once every dependency is real" timing page
  registration already established in the Browser Ecosystem phase.
- **`PluginRegistry.js`** — distinct from `src/core/PluginManager.js`
  (general plugin lifecycle); this is narrower, specifically about which
  pages a plugin contributes. `PluginService.js` is the new, unifying
  view across both — see "Plugin Service" below.
- **`HostConnectionManager.js`** (new this phase) — the Workshop-side
  half of the real Workshop Host Companion; see its own section below.
- **`HostPages.js`** — registers every Host page under its own `host://`
  scheme.

"Future services should be able to register themselves without requiring
modifications to existing systems" is true today, not just planned — a
new service is `hostManager.services.register("name", new
SomeService())`, and it appears in the Dashboard's own "Services" section
automatically, since that section iterates whatever's actually
registered rather than a hardcoded array. See "Dynamic Registration"
below for how far this actually extends.

## The Host Dashboard

`host://services` (`workshop://host` keeps resolving as an alias) —
Status (running, version, capability counts), a live list of every
registered service and its own status message, and links to every
service's own dedicated page. Every number and every service row comes
from `HostManager.getOverviewStatus()`, called fresh on each visit, not a
snapshot frozen at registration — including, now, Asset, Resident,
Plugin, and Diagnostics, the moment `main.js`'s own late wiring registers
them, with zero changes needed to the Dashboard's own rendering.

**`ProgramsService` is registered under two names, `"programs"` and
`"applications"`, pointing at the identical instance** — the brief's own
"Application Service" naming, plus the original key kept for anything
already reading it. `getOverviewStatus()` filters the alias out of its
own service list specifically so a status count doesn't quietly double-
count one real service as two.

**`host://projects` shows the Host's own side of a two-page split**,
rather than colliding with the Workshop's own internal Projects
(Notebook entries, `workshop://projects`/`project://`) — a different
concept that happens to share a name. See `ProjectsService.js`'s own
comment.

**`host://models` is a real, working page**, reading `ModelRegistry`
live — the exact same store AI Mission Control's own Model Selection
section already populates.

## Service Registry and honest placeholders

Every service started this project genuinely unimplemented —
"do not worry about exhaustive application discovery yet... do not
overbuild this... simply establish a location within the architecture."
Each one's own `getStatus()` returns an honest sentence, and every method
that would eventually do something real throws a clear, named error
rather than silently doing nothing.

**"Sensible placeholder data," reconciled with "honestly empty" (Browser
Ecosystem phase, still true).** `ProgramsService`/`ProjectsService`/
`DocumentsService`/`DownloadsService` each keep their own real state
(`this.installed`, `this.recent`) genuinely empty, while a separate
`previewItems()` returns clearly `isExample: true`-tagged illustrative
rows, rendered with a visible "Example" badge, never mixed into anything
that looks like real data.

**Workshop Platform phase: some of this is now genuinely real, not
placeholder at all.**

- **Asset Service** is fully real — see its own section.
- **Resident Service, Diagnostics Service, Plugin Service** are fully
  real — each is a live view over something that already, genuinely,
  exists (the resident system, the engine itself, both plugin
  contracts).
- **Permissions** is fully real, persisted data — see its own section.
- **Project Service's pinned projects** are fully real, persisted data —
  see its own section.
- **File Service's `listFiles()`** is fully real *when* the Workshop Host
  Companion is running *and* Filesystem permission is granted — the one
  place this phase actually reaches outside the browser. Every other
  File Service method (opening, creating, renaming, copying, moving,
  deleting, watching, associations) stays honestly unimplemented even
  then — see "The Workshop Host Companion" below for exactly why.
- **Automation Service's task descriptors** are real data, with nothing
  yet reading or executing them — see "Automation Service" below.

The distinction that actually matters, throughout, isn't "empty vs.
populated," it's "could a person mistake this for something real" — every
illustrative row stays visibly, permanently marked as one.

## The Workshop Host Companion

"Some capabilities requested during this phase cannot reasonably exist
inside a browser environment alone... please feel free to think beyond
JavaScript running in the browser." A browser tab cannot read a person's
files or launch a program — not a Workshop limitation, a deliberate
property of every browser, for good reason. The Workshop Host Companion
(`host-companion/workshop-host-companion.js`) is a small, real, separate,
**optional** local program that can.

**What it actually is.** A zero-dependency Node.js HTTP server — only
Node's own built-in modules, so running it is exactly `node
workshop-host-companion.js`, nothing to install first. Two endpoints:
`GET /status` (reveals nothing sensitive) and `GET /files?path=...`
(lists names, sizes, and modified times — never file contents — inside
one folder chosen when it's started, with path traversal rejected
outright). Full account, including the security reasoning behind
deliberately stopping at these two endpoints, lives in
`host-companion/README.md` — read that before running it.

**How it's started.** Manually, by the player, from a terminal or the
included `start.sh`/`start.ps1` launcher — never automatically, never
bundled into the Workshop's own page load. It's genuinely optional in
the same way Ollama is: the overwhelming majority of the time nobody has
it running, and the Workshop treats that as the ordinary, expected case.

**How the Workshop finds it.** `src/host/HostConnectionManager.js` polls
`http://localhost:7777/status` every ten seconds — the identical calm,
never-blocking pattern `AIConnectionManager.js` already established for
Ollama (see `docs/AI.md`). `status` is `"connecting"` |
`"connected"` | `"disconnected"`, and nothing about the rest of the
Workshop changes behaviour based on it except `FilesService.js`, the one
consumer that actually uses a live connection.

**How it fits the platform architecture.** It's the proof that "the Host
should quietly provide capabilities... without exposing unnecessary
complexity to the player" scales past *simulated* capabilities — when
the Companion is running and Filesystem permission is granted,
`host://files` genuinely lists a real folder on the player's own
computer, through the exact same page a person was already looking at
when nothing was connected. Nothing about `HostPages.js`, `BrowserApp.js`,
or any page's own HTML needed to change between those two states; only
`FilesService.getStatus()`'s own returned sentence did.

## Permissions

"Please begin introducing a permissions architecture... filesystem
access, hardware access, plugin capabilities, automation permissions,
future network access. The goal is simply to prepare a sensible
architecture for future Workshop expansion." `PermissionsService.js` —
five categories, each a persisted boolean, all `false` by default
("granted" is something a person opts into, the same instinct behind
`MemoryConfiguration.js`'s own `mode: "disabled"` default).

**Already has real teeth, not just a future promise.** Filesystem is the
one category with something real to gate today —
`FilesService.listFiles()` checks `isGranted("filesystem")` *before*
attempting any real call to the Companion, denying the request with an
honest, specific error even when the Companion itself is reachable. The
other four categories (hardware, plugins, automation, network) have
nothing real to protect yet, which is exactly why they stay simple
booleans rather than something more elaborate.

`host://permissions` is genuinely interactive — a real checkbox per
category, `BrowserApp.js`'s own new `workshop-browser-set-permission`
message handler is the one place that actually calls `grant()`/`revoke()`
on the real service (the page itself never touches `PermissionsService`
directly, the same "the real state change always happens in
`BrowserApp.js`, never inside the `srcdoc` page" pattern
`workshop-browser-remove-bookmark` already established).

**A second, deliberately separate permissions system, since the Plugin
SDK phase.** `PluginPermissions.js` grants *per plugin*, not per
Workshop — "can `your-name.my-plugin` register a Browser page," not "can
plugins in general do X." This isn't a replacement for the category
above (`PermissionsService`'s own `"plugins"` entry keeps its existing,
honest, not-yet-real status — a global switch with nothing to gate) —
it's a different shape entirely, real from the moment a plugin's own
manifest declares what it wants. See `docs/PLUGIN_SDK.md`'s own
"Permissions" section for the full account, including why capabilities
are auto-granted rather than gated behind a blocking prompt.

## Asset Service

"Begin preparing the Host for the future Shared Asset Library... the
Host should understand assets independently of the Builder or Browser."
`AssetService.js` is genuinely real, not honestly-empty, because every
asset kind it knows about already has a real backing store — Objects,
Blueprints, Animations, Models, Images, Music are all registered with one
`registerKind()` call each, in `main.js`'s own late wiring block, each
just handing over the real `all`/`get` functions its own store already
exposes.

**The Workshop Asset System phase (v2.0.5) took this considerably
further** — a full shared metadata envelope, real favourites and
recently-viewed, unified search across every individual asset, real
Blueprint→Object dependencies and their reverse (used-by), real
validation, and genuine (if simple) thumbnails for two kinds. See
**`docs/ASSETS.md`** for the complete account — this section stays a
short summary of where `AssetService` sits in the Host's own
architecture specifically.

Materials, Textures, Audio, and Particles (also named in the brief) have
no dedicated store of their own yet — they're one more `registerKind()`
call away from appearing everywhere this service is already consulted,
with zero changes to `AssetService.js` itself. See `docs/BROWSER.md`'s
own "File Pages" section for the Browser-facing side of this (`asset://`,
the canonical scheme), and `docs/PLUGIN_GUIDE.md`'s own "Adding your own
Workshop Asset" section for how a plugin joins in exactly the same way.

## Resident Service, Diagnostics Service

Both new in an earlier phase, both genuinely real, both the identical
shape as Asset Service: a Host-level view over something that already,
independently, exists (`docs/RESIDENT.md`'s resident system;
`workshop://diagnostics`'s own Workshop-wide health check, now formalised
into one reusable `DiagnosticsService.getReport()` that both
`workshop://diagnostics` and `host://services` read, rather than two
slowly-diverging copies of the same computation).

**Deepened substantially in the Workshop Diagnostics phase** — real
computed health levels (not just raw counts), performance/AI/resident/
plugin/asset diagnostics, a new technical Workshop Event Log, self-checks,
and suggested fixes, all layered onto exactly this same service and
exactly this same page. See `docs/DIAGNOSTICS.md` for the full account;
this section stays the original introduction.

## Plugin Service

"Continue expanding plugin support... plugin discovery, registration,
lifecycle, permissions, metadata, updates, dependencies. The Host should
become responsible for managing Workshop plugins." The Workshop now has
*three* ways a plugin can exist (see `docs/PLUGIN_SDK.md`): the original
`engine.plugins` (general lifecycle), the original
`hostManager.pluginRegistry` (Browser pages and Workshop Assets, via
`providePages()`/`provideAssets()` — still fully supported, unchanged),
and, since the Plugin SDK phase, any plugin loaded through
`PluginLoader.js` — which also becomes a real `engine.plugins` entry,
carrying a manifest, live status, and permission grants along with it.
`PluginService.js` is still the one place that can answer "what plugins
currently exist, and what does each one provide" without a caller
needing to know any of these mechanisms exist separately.

**Workshop Diagnostics phase** — `PluginManager._safeCall()` now emits a
real `"plugin:error"` event the moment any plugin's own code throws, not
just recording it silently in `_status`. `WorkshopEventLog.js` listens
for exactly this, so a plugin failure becomes a real, timestamped entry
in the Workshop's own Event Log — see `docs/DIAGNOSTICS.md`.

**Discovery, metadata, and permissions are now genuinely real** — a
plugin's manifest (`id`, `name`, `version`, `description`, `author`),
its live status (`active`/`disabled`/`error`, with the actual error
message), and its per-capability permission grants (via
`PluginPermissions.js`) are all real, persisted, and shown at
`host://plugins`, which is now genuinely interactive: Enable/Disable/
Reload buttons and permission checkboxes, the identical `postMessage`
pattern `host://permissions`' own checkboxes established. **Dependencies
and updates stay honestly out of scope** — there's still no real design
for "a plugin depends on another plugin" or "a plugin has a newer
version available," and inventing either to fill space would be
premature architecture, not preparation. See `docs/PLUGIN_SDK.md` for
the complete account — this section stays a short summary of where
`PluginService` sits in the Host's own architecture specifically.

## Automation Service

"Please introduce the foundations for Workshop automation... scheduled
tasks, background jobs, future automation rules, asset processing,
project maintenance, resident maintenance. The goal is simply to
establish the architecture. Please avoid implementing large automation
systems during this phase." `scheduleTask()`/`listTasks()`/
`cancelTask()` are genuinely real — ordinary, working data — but nothing
executes a task on any schedule; there's no timer loop, no execution
engine. A task descriptor is inert data until a real automation engine
exists to read it, which is precisely the "foundations, not a working
scheduler" the brief asks for.

## Hardware Service

"Please begin preparing for future hardware integration... game
controllers, microphones, serial devices, USB devices, Bluetooth,
network devices, future Arduino support, future Workshop hardware." No
code complexity was added — `HardwareService.js` now names every
category explicitly (`categories()`) so a future phase implementing, say,
controller support specifically has an obvious, already-agreed name to
build against, rather than inventing one at that point. Still, honestly,
nothing works.

## Local Protocols

"Continue expanding Workshop protocols... `workshop://`, `host://`,
`plugin://`, `asset://`, `resident://`, `project://`." Three new schemes
this phase, registered in `PageRegistry.INTERNAL_SCHEMES` alongside the
three that already existed — `BrowserApp.js` itself needed zero changes
for any of them, since it never checks a specific scheme by name, only
`isInternalUrl()`. `asset://` and `resident://` are the new canonical
names for what were `workshop://assets`/`workshop://residents`
(both kept resolving as aliases); `project://` is the new canonical name
for the Workshop's own internal Projects specifically — deliberately
distinct from `host://projects`, the separate local-filesystem one. See
`docs/BROWSER.md`'s own "Local Protocols" section for the full account.

## Dynamic Registration

"Avoid hardcoded systems wherever possible. Applications, plugins,
assets, residents, services, protocols should all be capable of
registering themselves with the Host." Concretely, as of this phase:

- **Services** — `ServiceRegistry.register()`, true since the Host's
  first phase.
- **Pages/protocols** — `PageRegistry.register()`/`registerDynamic()`,
  true since Version 1; `INTERNAL_SCHEMES` itself is one array literal to
  extend, not a set of hardcoded checks scattered through `BrowserApp.js`.
- **Plugins** — `PluginRegistry.registerPlugin()` (Browser pages, and —
  new in the Workshop Asset System phase — Workshop Assets, via the same
  registry's own `provideAssets()`) and `engine.plugins.register()`
  (lifecycle), all now visible together through `PluginService.listAll()`.
- **Assets** — `AssetService.registerKind()` — real for both built-in
  kinds (`main.js`'s own wiring) and plugin-provided ones (a plugin's own
  `provideAssets()`); see docs/ASSETS.md for the full account.
- **Residents** — not yet a registration-based system in the same
  sense; `ResidentService.js` reads a fixed set of stores today (see
  docs/RESIDENT.md's own "Future extension points" for what multi-
  resident registration would eventually need).

## Preparing the Ollama migration

"Currently Mission Control communicates directly with Ollama. Future
architecture should instead become: Mission Control → Browser → Workshop
Host → Ollama... do not fully migrate this behaviour yet." Still true —
`AIConnectionManager.js` still talks to Ollama directly. What's changed
is that the Host now has a genuine, working example of exactly this
shape (`HostConnectionManager` → the Companion), which is the concrete
template a future Ollama migration would follow, not just a diagram.

## Plugin preparation, now genuinely exercised

Unchanged from the Browser Ecosystem phase's own account — two real
plugins (`plugin://example-plugin`, `plugin://calculator`) prove the
Browser-page contract end-to-end; see `docs/BROWSER.md`'s own "Plugin
Pages" section and `docs/PLUGIN_GUIDE.md`. A third,
`plugin://workshop-toolkit`, joined them in the Plugin SDK phase — see
`docs/PLUGIN_SDK.md`.

## Browser Refinement: the page-refresh bug, fixed at its root

Before extending the Browser in the Browser Ecosystem phase, a reported
issue was resolved first: "after navigating to a page, the Browser often
does not visually update until the player switches to another tab and
then returns." The root cause was `BrowserApp.js` reusing the same
`<iframe>` element across navigations within one tab, mutating its
`src`/`srcdoc` in place — a well-known class of browser rendering quirk
where an iframe's own rendered layer isn't always reliably invalidated
when its content changes while the element itself never moves, resizes,
or toggles visibility. Switching tabs "fixed" it only as a side effect,
by forcing a `display:none`→`block` toggle, which happens to force a
genuine relayout.

The fix creates a fresh `<iframe>` element for every navigation instead
of mutating an existing one — a real architectural change, not a forced
extra redraw layered on top of the old behaviour. Nothing about "keeping
frames alive between navigations" (so switching *tabs* still never
reloads or loses state) was lost: navigating to a new URL already resets
scroll position regardless, so there was never any state worth preserving
across a URL change *within* one tab in the first place. See
`docs/BROWSER.md`'s own "Browser architecture" section for the updated
account.

## Known simplifications (by design, for this phase)

- **The Companion is entirely optional and manual** — nothing in the
  Workshop assumes it's running; the overwhelming majority of sessions
  will never have it started, and everything works exactly as before in
  that case.
- **Only one File Service capability is real even with the Companion
  connected** — listing a folder's contents. Opening, creating, renaming,
  copying, moving, deleting, watching, and file associations all stay
  honestly unimplemented — see `host-companion/README.md`'s own security
  reasoning for why that's a considered boundary, not an oversight.
- **Automation task descriptors don't execute** — see "Automation
  Service" above.
- **Permissions don't gate hardware, plugins, automation, or network
  yet** — there's nothing real behind any of those four categories to
  protect.
- **`HostManager.getOverviewStatus()`'s "Running" is always true** — the
  Host doesn't have a separate process to actually be running or not
  (the Companion does, separately, and is reflected in its own service's
  status instead).
- **Preview data is illustrative, not configurable** — `previewItems()`
  returns a fixed, small set of example rows.

## Future extension points

- **More Companion endpoints, carefully** — opening a file with its
  default handler is the natural next step, once there's a real design
  for doing so safely from something any browser tab can reach (see
  `host-companion/README.md`'s own security section for exactly what
  that would need to address first).
- **The Ollama migration itself**, following the Companion's own shape.
- **Real additional Asset kinds** — Materials, Textures, Audio, Particles
  — one `registerKind()` call each, the moment a real backing store
  exists for any of them.
- **A real automation engine** reading `AutomationService`'s own task
  descriptors and actually executing something on a schedule.
- **Permissions gating hardware/plugins/automation/network**, once each
  has something real to protect.
- **Per-resident, per-plugin, per-project registration** rather than
  today's fixed store references — see docs/RESIDENT.md's own "Future
  extension points" for the resident side of this.
- **Workshop Phone, Development Tools** — both listed among future
  Workshop phases; both would most naturally arrive as more `host://`
  pages this same registry already knows how to display.
