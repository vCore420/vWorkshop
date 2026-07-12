# The Browser

"Version 2 is about teaching the Browser that it belongs to the
Workshop." What began as the Workshop's connection to the wider digital
world has grown into its universal interface — the Workshop, the local
machine (via the Workshop Host), plugins, and documentation, all reached
the same way, through pages. This document covers how it's built;
`docs/ARCHITECTURE.md` covers how it fits into the rest of the Workshop.

## Design philosophy, briefly

"Does this make the Browser feel more like an application... or more
like the Workshop itself?" Four decisions carry that, across every phase
this Browser has been through:

1. **The Browser displays pages; it doesn't know what they are.** Every
   internal-scheme page comes from `PageRegistry` — a Workshop system
   registers a page, the Browser resolves and renders it, and the
   Browser itself never once mentions "docs," "projects," or "services"
   by name anywhere in its own source. See "Architecture" below.
2. **Persistent sessions, genuinely** — every tab, its full navigation
   history, bookmarks, which tab is active, and (where practical) scroll
   position survive closing and reopening the Workshop. See
   "Persistence".
3. **Three schemes, one mechanism, no special cases.** `workshop://`,
   `host://`, and `plugin://` are all "internal" to `PageRegistry` and
   `BrowserApp.js` in exactly the same way — see "Architecture" for how
   the Browser Ecosystem phase generalised what used to be a single
   hardcoded scheme check into this.
4. **An honest browser, still not a browser-shaped feature list.** No
   extensions, no download manager, no dev tools — what's grown (search,
   bookmarks) grew because this phase's own brief asked for it by name,
   not because "more browser features" is its own goal.

## Architecture: `PageRegistry`, now scheme-aware and dynamic

`src/browser/PageRegistry.js` is the entire mechanism behind "the Browser
should not contain hardcoded knowledge about Workshop systems. Instead,
Workshop systems should simply expose pages that the Browser can
display" — a full URL (`workshop://docs`, `host://services`,
`plugin://calculator`) maps to an `async (url) => ({ title, html })`
provider function. `BrowserApp.js` calls `pageRegistry.resolve(url)` for
any internal-scheme URL and renders whatever comes back. That's the
entire contract; the same "one small, generic registration mechanism,
called by whoever needs it" shape `behaviours/registry.js` (Build Mode)
and `apps/registry.js` (the computer itself) already established,
applied to pages instead of behaviours or apps.

**Browser Ecosystem phase: genuine multi-scheme support.** Previously,
`PageRegistry` implicitly only ever meant `workshop://` — the scheme was
stripped before resolution, and `BrowserApp.js` checked
`url.startsWith("workshop://")` in three separate places. Both are gone
now: `INTERNAL_SCHEMES` (`workshop`, `host`, `plugin`, and — new in the
Workshop Platform phase — `asset`, `resident`, `project`) is the one place
that list lives, `isInternalUrl()`/`schemeOf()` are the only checks
anything needs, and the registry stores keys as the full `scheme://path`
rather than a bare path. `BrowserApp.js` needed exactly one change per
call site (swap a hardcoded `startsWith` for `isInternalUrl()`) to gain
`host://` and `plugin://` for free — nothing about how it displays a page
changed at all.

**Dynamic pages, for things that can't be enumerated ahead of time.**
`registerDynamic(matches, resolve)` is new this phase — a matcher
function decides whether a resolver applies to a given URL, checked only
once no exact match was found. `workshop://asset/object/42` doesn't need
its own `register()` call per object definition; `AssetPages.js`
registers one dynamic resolver covering every `workshop://asset/*` URL,
which naturally grows and shrinks as the player creates and deletes
things. See "File Pages" below.

**Registration is centralised** in `src/browser/WorkshopPages.js`
(Workshop pages), `src/browser/AssetPages.js` (file-aware asset pages),
and `src/host/HostPages.js` (Host pages), each called once from `main.js`
after every store any of them needs already exists — a pragmatic choice,
not a compromise on the separation above. The Browser still only ever
talks to `PageRegistry`, never to a store directly; where the
*registration* code physically lives doesn't change that. A plugin is
just as free to call `pageRegistry.register()` from its own file instead
(see "Plugin Pages" below) — nothing about `PageRegistry` assumes
registration only ever happens from these three files.

**Providers can be genuinely dynamic in the data sense too.**
`workshop://projects` reads live from `ProjectsStore.all()` every time
it's resolved, not a snapshot frozen at registration time, since a
provider is just a function, called fresh on every navigation. Every
provider now also receives the exact URL that was requested — most
ignore it, but `workshop://search?q=...` and every
`workshop://asset/<category>/<id>` page read their own parameters
straight from it, rather than the registry inventing a second, bespoke
way to pass them.

**Real documentation, not stub pages.** `workshop://documentation`
(`workshop://docs` keeps working as an alias, so existing bookmarks and
history don't break), `workshop://builder`, and `workshop://animation`
`fetch()` this project's own actual `README.md`/`docs/WORLDBUILDER.md`/
`docs/PLAYER.md` and render them with `src/utils/SimpleMarkdown.js`.
Reading these always shows the genuine, currently-accurate documentation,
never a copy that drifts out of date.

## Persistence

"Closing and reopening the Workshop should feel like waking up a computer
rather than launching a brand-new browser." `BrowserStore.js` persists
ordinary JSON through the normal `PersistenceSystem` path — every tab is
`{ id, history: string[], historyIndex, scrollY, title }`, plus a shared
`bookmarks: [{url, title}]` list (see "Browser Navigation" below).
`history`/`historyIndex` together are the entire back/forward mechanism.

There is always at least one tab — closing the last one opens a fresh
Home tab rather than leaving the Browser with nothing to show.

**"Scroll positions where practical"** — practical specifically means
same-origin internal-scheme pages. A cross-origin `http(s)://` iframe's
scroll position is genuinely unreadable from the parent page; the
browser's own same-origin policy blocks that, full stop.

## Browser architecture: one persistent iframe *identity* per tab

`BrowserApp.js` keeps one `<iframe>` alive per open *tab* — hidden via
CSS rather than destroyed when its tab isn't active, so switching tabs
never loses a page's live state. Every render reconciles this against
`BrowserStore`'s own tab list.

**Navigating to a new URL *within* a tab creates a fresh iframe
element**, replacing rather than mutating the existing one's
`src`/`srcdoc` — a deliberate fix for a real, reported bug (an iframe's
own rendered layer isn't always reliably invalidated by the browser when
its content changes while the element itself never moves or resizes).
See `docs/HOST.md`'s own "Browser Refinement" section for the full
account.

**Two kinds of page, one display mechanism.** An ordinary `http(s)://`
URL becomes `iframe.src`; any internal-scheme URL resolves through
`PageRegistry` and becomes `iframe.srcdoc` (wrapped in a complete HTML
document by `PageShell.js`, which every internal page shares).

**Internal-scheme links inside a page** aren't a protocol real browsers
understand, so a plain `<a href="host://services">` would otherwise just
do nothing when clicked from inside the iframe. `PageShell.js`'s own
shared script intercepts clicks on any `workshop://`/`host://`/
`plugin://` link (built from `PageRegistry.INTERNAL_SCHEMES`, not a
separate hardcoded list) and `postMessage`s the target URL to the
parent, which is what actually navigates the tab. Ordinary `http(s)://`
links are left alone entirely.

### Address input, URL normalisation, and search

A bare domain, `localhost`, an IP, or `localhost:3000` gets an inferred
`http://`/`https://` scheme rather than being treated as a search query —
the brief's own examples (`github.com`, `localhost`, `127.0.0.1`) are all
addresses, not queries. `workshop://`, `host://`, and `plugin://` inputs
pass straight through, lowercased.

**Browser Ecosystem phase: everything else becomes a search.** Typed
input that doesn't look like any of the above (contains a space, or
simply doesn't match a domain-like shape) now becomes
`workshop://search?q=<query>` instead of a probably-unhelpful `https://`
guess — "please introduce the foundations for unified searching...
integrate wherever practical," made concrete in the one place every
typed address already passes through. See "Unified Search" below.

## A real, honest limitation: `X-Frame-Options`

Unchanged from earlier phases — most modern sites send headers that
block being embedded inside anyone else's page, enforced by the
*visitor's own browser*, not something any code here can change. Every
tab has a small, permanent "Open in a new browser tab ↗" toolbar button
as a real escape hatch.

## Browser Navigation

"Continue improving the browsing experience... bookmarks, history,
persistent sessions, improved navigation, better tab management, internal
Workshop links, natural navigation between Workshop pages." History,
persistent sessions, tab management, and internal-page navigation all
already existed (see "Persistence" and "Browser architecture" above);
this phase's own addition is **bookmarks reaching the full Browser**:

- A one-click star toggle in the toolbar (☆/★) — bookmarking whatever's
  currently showing, reading and writing the exact same
  `BrowserStore.bookmarks` list the Phone's own Browser app already used.
  A bookmark added from either place shows up in both.
- `workshop://bookmarks` — a real page listing every saved bookmark as a
  genuine, clickable link, with a "Remove" action per row (a
  `postMessage`, the same pattern `workshop://settings`'s own "Clear
  Browsing Data" button already established).

## Unified Search

"Please introduce the foundations for unified searching... Workshop
pages, assets, residents, plugins, documentation, Host pages, projects,
future services. For this phase, please establish the architecture and
integrate wherever practical." `src/browser/SearchIndex.js` is that
architecture — a small, flat list of `{url, title, category, keywords}`
entries, contributed explicitly alongside each `pageRegistry.register()`
call (see `SearchIndex.js`'s own comment on why it's a separate,
explicitly-maintained list rather than derived from `PageRegistry`
itself — invoking every provider just to learn its title would be
wasteful and, for a `fetch()`-based page, slow).

`workshop://search` renders every current entry into the page as a plain
JSON array and filters it client-side as the person types — the same
"small, self-contained script" technique `plugin://calculator` uses for
real interactivity inside a `srcdoc` page, escaped defensively (title/
category/url all pass through a client-side `escapeHtml()`) since
`SearchIndex.js`'s own shape explicitly invites a future phase to index
individual, player-named things the same way. The address bar itself
routes anything that doesn't look like a URL straight to this page (see
"Address input" above) — typing "residents" or "calculator" into the
address bar and pressing Enter is a real, working search today, not only
a dedicated search page someone has to know to visit.

**What's indexed today**: every built-in `workshop://` and `host://`
page, by its own static title and a handful of keywords. **What's
deliberately not indexed yet**: individual assets, individual residents,
individual projects — "establish the architecture and integrate wherever
practical" is honest about scope here; per-item indexing is a natural
next step (see "Future extension points"), not something this phase
claims to have finished.

## Host Pages

"Continue expanding Host integration... `host://applications`,
`host://projects`, `host://documents`, `host://downloads`,
`host://services`, `host://plugins`... where Host functionality has not
yet been implemented, prepare the page architecture and use sensible
placeholder data." See `docs/HOST.md` for the complete account — this
section covers only what changed about the Browser's own relationship to
Host pages.

**A real `host://` scheme**, replacing what used to live entirely under
`workshop://` (`workshop://host`, `workshop://programs`, and so on).
`workshop://host`/`workshop://programs`/`workshop://files`/
`workshop://automation`/`workshop://models`/`workshop://plugins` all keep
resolving, registered alongside their new `host://` names against the
identical provider, so nothing already bookmarked or in someone's history
quietly breaks.

**Sensible placeholder data, honestly labelled.** This phase's own brief
asks for placeholder data "so the interface is ready for future
integration" — a real tension with earlier Host phases' own "an
honestly empty list rather than fabricated example entries... a
convincing fake would be more misleading than an honest 'not yet.'" Both
survive intact: every Host service's own *real* state
(`ProgramsService.installed`, `DocumentsService.recent`, and so on) stays
genuinely empty; a new, separate `previewItems()` method returns a
handful of clearly-labelled illustrative rows, rendered with a visible
"Example" badge and a dashed border (`.workshop-example-row`,
`.workshop-example-badge` — see `css/browser-pages.css`) that never mixes
into anything that looks like real data. See `docs/HOST.md`'s own account
of each individual service for the reasoning spelled out per-service.

## File Pages

"Please begin introducing file-aware pages... whenever practical, opening
a Workshop asset should display an informative page rather than simply
downloading the file... preview, metadata, categories, creation date,
actions, relationships." `src/browser/AssetPages.js`, new this phase:

- **`workshop://assets`** — the overview. Every category the Workshop has
  a library for (Objects, Blueprints, Animations, Models, Images, Music),
  each a live count read straight from its own store.
- **`workshop://asset/<category>/<id>`** — real per-item detail pages for
  three of those six (Objects, Blueprints, Animations), registered as a
  single dynamic resolver rather than one exact registration per item
  (see "Architecture" above). Each shows a genuine preview (an object or
  blueprint's own part colours, rendered as a small row of swatches —
  there's no practical way to render an actual live 3D preview inside a
  `srcdoc` iframe without embedding a second Three.js scene per page
  view, out of proportion for this phase, so the swatches are a real,
  if simplified, visual built from the definition's own actual data, not
  a placeholder image), real metadata (category, tags, part/frame count,
  creation and last-updated dates), real relationships (an object shows
  how many times it's currently placed in the Workshop, cross-referenced
  against `WorldObjectsStore`; a blueprint lists the real pieces it's
  made of, cross-referenced against `ObjectLibraryStore`), and honest
  actions — a pointer to where the real action happens (open the Builder
  or Animation Editor from the Computer's rail), not a fabricated button
  that would need a cross-app-switching bridge this phase doesn't build.
- **Models, Images, and Music** get real counts on the overview page but
  no deep per-item page yet — each already has its own dedicated computer
  app for browsing in depth today, and a model/image/song's own detail
  page is a reasonable, explicitly scoped future extension rather than
  something this phase claims to cover exhaustively.

## Plugin Pages

"Please continue preparing for plugins. Plugins should be capable of
registering Browser pages... naturally integrate into Browser navigation
without requiring hardcoded support." Already architecturally true before
this phase — `src/host/PluginRegistry.js`'s own `registerPlugin(plugin)`
hands a plugin the real `PageRegistry` to call `register()` against
directly, no translation layer — but nothing had ever actually exercised
it. Two real, working plugins now do:

- **`plugin://example-plugin`** (`src/plugins/examples/
  examplePagePlugin.js`) — the reference implementation, the same role
  `dustMotesPlugin.js` plays for the *other* plugin contract
  (`src/core/PluginManager.js`'s lifecycle one). Its own page *is* the
  documentation, explaining exactly how it got there.
- **`plugin://calculator`** (`src/plugins/examples/calculatorPlugin.js`)
  — a genuinely working four-function calculator, entirely self-contained
  inside the page's own `<script>` tag. Chosen over the brief's other
  example names (`plugin://weather`, `plugin://inventory`) specifically
  because it can be genuinely real without either faking a live data
  source or inventing a backing store with no natural owner yet.

Both are registered with three lines in `main.js`
(`hostManager.pluginRegistry.registerPlugin(examplePagePlugin())`), and
neither `BrowserApp.js` nor `PageRegistry.js` needed a single change for
either to exist — the entire point being demonstrated. `host://plugins`
lists every contributing plugin and which pages each one declared
(`plugin.pages`, an optional manifest field, purely for display).

## Local Protocols (Workshop Platform phase)

"Continue expanding Workshop protocols... `asset://`, `resident://`,
`project://`... ensure future services can naturally expose functionality
through these protocols." Three new schemes, registered in
`PageRegistry.INTERNAL_SCHEMES` alongside the three that already
existed — `BrowserApp.js` needed zero further changes, since it never
checks a specific scheme by name, only `isInternalUrl()`.

- **`asset://`** is the new canonical scheme for the Shared Asset
  Library (`asset://` itself is the overview, `asset://object/42` a
  detail page) — `workshop://assets`/`workshop://asset/<category>/<id>`
  keep resolving as aliases. See "File Pages" above.
- **`resident://`** is the new canonical scheme for Residents —
  `workshop://residents` keeps resolving as an alias.
- **`project://`** is the new canonical scheme for the Workshop's own
  *internal* Projects — deliberately distinct from `host://projects`,
  the separate local-filesystem one (see `docs/HOST.md`'s own "Project
  Service" section). `workshop://projects` keeps resolving as an alias.

Each new scheme's own page is registered from the same file that already
owned the underlying content (`asset://` in `AssetPages.js`;
`resident://`/`project://` in `WorkshopPages.js`) — introducing a new
protocol never means a new file, only a new `pageRegistry.register()`
call alongside the existing one.

## Known simplifications (by design, for this phase)

- **Search indexes pages, not yet individual items** — see "Unified
  Search" above.
- **Only three asset categories get real detail pages** — Models, Images,
  and Music are listed with real counts but no per-item page yet; see
  "File Pages" above.
- **No cross-app "open this in the Builder" bridge** — asset detail pages
  point to where the real action happens rather than fabricating a
  working button; building a genuine app-switching bridge from a
  `srcdoc` page was judged out of proportion for this phase.
- **`workshop://mission-control` is a read-only snapshot**, not an
  editing surface — Mission Control's own real editing controls (sliders,
  checkboxes) live in `AIApp.js`, a computer app; a `srcdoc` page manages
  a live view cleanly, not the same richness of input.
- **Host preview data is illustrative, not real** — see "Host Pages"
  above for the full reconciliation between "honestly empty" and
  "sensible placeholder data."

## Future extension points

- **Per-item search indexing** — individual object definitions,
  residents, and projects, each searchable by their own real (often
  player-given) name, the moment each has its own detail page worth
  pointing a search result at.
- **Model/image/song detail pages**, matching the shape
  `AssetPages.js`'s own object/blueprint/animation pages already
  establish.
- **A real cross-app navigation bridge** — a `postMessage` type that
  actually switches the Computer to a different app/tab, letting a
  "host://plugins", "workshop://asset/object/42", or similar page offer a
  genuinely working "open this" action instead of a pointer.
- **Real additional providers** (see `docs/AI.md`'s own "Additional
  Providers" section) — a separate concern from the Browser's own
  `host://`/`plugin://` schemes, but the same "architecture now, real
  implementation later" spirit.
- **`host://documents`/`host://downloads` becoming genuinely real** —
  the moment a Workshop Host actually bridges to a local machine, their
  own `previewItems()` illustrative rows are replaced by real ones with
  zero change to `HostPages.js`'s own rendering.
