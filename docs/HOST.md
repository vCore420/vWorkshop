# The Workshop Host

"This is NOT about creating another application. This is about creating
the Workshop's bridge to the local machine." The Host is a lightweight,
purely architectural companion — no window, no rail icon, no interface of
its own. Everything it offers is reached through the Browser, exactly the
way the brief's own diagram describes it. This document covers how it's
built; `docs/BROWSER.md` covers the Browser side of the same relationship.

## Host philosophy

```
Browser
  ↓
Workshop Host
  ↓
Local Machine
```

"The Browser displays pages. The Host provides services. The Browser
should never directly perform local machine operations." This separation
is real in the code, not just a diagram: `BrowserApp.js` has no
`src/host/` import anywhere in it, and never will need one — it only ever
talks to `PageRegistry`, exactly as it talks to every other `workshop://`
page source. `src/host/HostManager.js` has no computer-app entry, no rail
icon, no window — "the Host should never create separate windows or
interfaces." Every capability it will ever offer arrives as a
`workshop://` page (`HostPages.js`), the same mechanism `docs/BROWSER.md`
already established for Home, Docs, and Projects.

## Architecture: eight small, separated files

`src/host/`, following the exact "separate responsibilities" instinct
`src/ai/` and `src/resident/` already established:

- **`ServiceRegistry.js`** — the generic registry a service registers
  itself with, the same shape `PageRegistry.js` already uses for pages.
- **`HostManager.js`** — the one top-level container: owns the registry,
  registers every built-in service at construction, and computes the
  Dashboard's own overview status live from whatever's actually
  registered.
- **`ProgramsService.js`**, **`ProjectsService.js`**, **`FilesService.js`**,
  **`AutomationService.js`**, **`HardwareService.js`** — one file per
  future capability, each honestly unimplemented (see "Known
  simplifications" below) but with the *real* shape a future version
  needs already in place.
- **`PluginRegistry.js`** — distinct from `src/core/PluginManager.js`
  (which already exists, handling a plugin's general lifecycle); this is
  narrower, specifically about which `workshop://` pages a plugin
  contributes.

"Future services should be able to register themselves without requiring
modifications to existing systems" is true today, not just planned — a
new service is `hostManager.services.register("name", new
SomeService())`, and it appears in the Dashboard's own "Services" section
automatically, since that section iterates `ServiceRegistry.list()`
rather than a hardcoded array.

## The Host Dashboard

`workshop://host` — Status (running, version, capability counts), a live
list of every registered service and its own status message, and links
to each service's own dedicated page
(`workshop://programs`/`projects`/`files`/`models`/`plugins`/`automation`).
Every number and every service row comes from
`HostManager.getOverviewStatus()`, called fresh on each visit, not a
snapshot frozen at registration.

**`workshop://projects` shows two genuinely different things, on
purpose, rather than colliding.** The Workshop's own internal projects
(Notebook entries — real, working, already documented in
`docs/BROWSER.md`) and the Host's own future *local filesystem* projects
(folders on the player's actual computer) happen to share the word
"projects" but aren't the same concept at all. Rather than the Host's own
`ProjectsService` claiming the URL and regressing a page that already
works, `WorkshopPages.js`'s own `projectsPage()` now shows both sections
on the one page — Workshop Projects above, Local Projects (Host, not yet
active) below.

**`workshop://models` is a real, working page**, not a placeholder —
it reads `ModelRegistry` live, the exact same store AI Mission Control's
own Model Selection section already populates. "Live from the same
connection AI Mission Control uses" is the whole design: no separate copy
of the model list exists anywhere in `src/host/`.

## Service Registry and honest placeholders

Every other service (Programs, Files, Automation, Hardware, and the
*local-project* half of Projects) is genuinely unimplemented this phase —
"do not worry about exhaustive application discovery yet... do not
overbuild this... simply establish a location within the architecture."
Each one's own `getStatus()` returns `{available: false, summary: "..."}`
with an honest sentence explaining exactly that, and every method that
would eventually do something real (`launchApplication()`,
`openProject()`, `openFile()`, `showSaveDialog()`) throws a clear error
naming itself rather than silently doing nothing — a future caller finds
out immediately that the bridge doesn't exist yet, rather than wondering
why nothing happened.

None of these fake their own functionality with browser-side shims
(there was no attempt at simulating a native file picker with an
`<input type="file">`, for instance) — a convincing fake would be more
misleading than an honest "not yet," once a real Host exists to do these
properly.

## Preparing the Ollama migration

"Currently Mission Control communicates directly with Ollama. Future
architecture should instead become: Mission Control → Browser → Workshop
Host → Ollama... do not fully migrate this behaviour yet." This phase
doesn't move `AIConnectionManager.js`'s own `fetch()` calls anywhere —
they still talk to Ollama directly, exactly as `docs/AI.md` already
describes. What already holds true, and is the actual preparation: every
one of those calls already lives in one small, isolated class
(`AIConnectionManager`), not scattered across the codebase — a future
migration is "swap what's inside `checkConnection()`/`sendTestPrompt()`
for a call to a Host service instead," not a rewrite of everything that
currently depends on `AIConnectionManager`'s own public shape
(`status`, `checkConnection()`, `sendTestPrompt()`). This will eventually
remove the browser CORS limitation `docs/AI.md`'s own "Connection
Manager" section already documents honestly, since a Host with real
local-machine access wouldn't be subject to a browser tab's own
same-origin restrictions the way `fetch()` from inside the Workshop's own
page currently is.

## Plugin preparation

"The Browser should eventually discover additional Workshop pages
through registered plugins." `PluginRegistry.registerPlugin(plugin)`
already exists and already works end to end — a plugin shaped
`{id, name, providePages(pageRegistry)}` gets its `providePages()`
called once, immediately, with the real `PageRegistry` to register
against directly, the exact same call any built-in system (Docs,
Projects, the Host itself) already makes. `workshop://plugins` lists
every plugin that's contributed pages this way; nothing currently calls
`registerPlugin()`, since no plugin system exists yet to call it from,
but the mechanism itself needed no more preparation than this.

## Browser Refinement: the page-refresh bug, fixed at its root

Before extending the Browser, this phase also resolved a reported issue:
"after navigating to a page, the Browser often does not visually update
until the player switches to another tab and then returns." The root
cause was `BrowserApp.js` reusing the same `<iframe>` element across
navigations within one tab, mutating its `src`/`srcdoc` in place — a
well-known class of browser rendering quirk where an iframe's own
rendered layer isn't always reliably invalidated when its content changes
while the element itself never moves, resizes, or toggles visibility.
Switching tabs "fixed" it only as a side effect, by forcing a
`display:none`→`block` toggle, which happens to force a genuine relayout.

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

- **No actual bridge to the local machine exists at all** — every service
  is honestly unimplemented; this phase is entirely about the shape those
  services will eventually fill, not the capabilities themselves.
- **Ollama communication hasn't moved** — see "Preparing the Ollama
  migration" above; `AIConnectionManager` still talks to Ollama directly.
- **No plugin actually calls `PluginRegistry.registerPlugin()` yet** —
  the mechanism is real and complete; there's simply nothing using it
  until a real plugin system exists.
- **`HostManager.getOverviewStatus()`'s "Running" is always true** — the
  Host doesn't have a separate process to actually be running or not;
  it exists exactly as long as the Workshop's own page does.

## Future extension points

- **A real bridge for each service** — Programs (application discovery
  and launching), Projects (opening local folders, external editors),
  Files (native open/save dialogs) — each service's own honestly-thrown
  errors are the exact seams a real implementation fills in, with no
  architectural change needed anywhere that already calls them.
- **The Ollama migration itself** — see "Preparing the Ollama migration"
  above; `AIConnectionManager`'s own narrow, already-isolated shape is
  the reason this will eventually be a contained change, not a rewrite.
- **A real plugin system**, calling `PluginRegistry.registerPlugin()` for
  each plugin it loads — see `docs/PLUGIN_GUIDE.md`.
- **Automation and Hardware**, once there's a concrete design worth
  building rather than a placeholder worth reserving space for.
- **Workshop Phone, Development Tools** — both listed among future
  Workshop phases; both would most naturally arrive as more
  `workshop://` pages this same registry already knows how to display.
