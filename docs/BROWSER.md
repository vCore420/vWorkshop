# The Browser

The Workshop's connection to the wider digital world — not a second attempt
at Chrome, "a browser that feels like it belongs inside the Workshop." This
document covers how it's built; `docs/ARCHITECTURE.md` covers how it fits
into the rest of the Workshop.

## Design philosophy, briefly

"The Browser should feel like another room inside the Workshop rather than
another program running inside it." Three concrete decisions carry that:

1. **The Browser displays pages; it doesn't know what they are.** Every
   `workshop://` page comes from `PageRegistry` — a Workshop system
   registers a page, the Browser resolves and renders it, and the Browser
   itself never once mentions "docs" or "projects" by name anywhere in its
   own source. See "Architecture" below.
2. **Persistent sessions, genuinely** — every tab, its full navigation
   history, which one's active, and (where practical) scroll position
   survive closing and reopening the Workshop. See "Persistence".
3. **An honest browser, not a browser-shaped feature list.** No bookmarks
   manager, no extensions, no download manager, no dev tools — "avoid
   trying to build a feature-complete web browser." What's here (address
   bar, back/forward/refresh/home, tabs) is deliberately the complete set
   asked for, not a foundation quietly building toward more.

## Architecture: `PageRegistry`, the same shape as every other registry

`src/browser/PageRegistry.js` is the entire mechanism behind "the Browser
should not contain hardcoded knowledge about Workshop systems. Instead,
Workshop systems should simply expose pages that the Browser can display" —
a path (the part of a `workshop://` URL after the scheme) maps to an
`async () => ({ title, html })` provider function. `BrowserApp.js` calls
`pageRegistry.resolve(path)` for any `workshop://` URL and renders whatever
comes back. That's the entire contract; the same "one small, generic
registration mechanism, called by whoever needs it" shape
`behaviours/registry.js` (Build Mode) and `apps/registry.js` (the computer
itself) already established, applied to pages instead of behaviours or
apps.

**Registration is centralised in `src/browser/WorkshopPages.js`**, called
once from `main.js` after every store it needs already exists — a
pragmatic choice, not a compromise on the separation above. The Browser
still only ever talks to `PageRegistry`, never to `ProjectsStore` or a docs
file directly; where the *registration* code physically lives doesn't
change that. A future system (a plugin, a Workshop Host capability) is
just as free to call `pageRegistry.register()` from its own file instead,
whenever that's the more natural fit — nothing about `PageRegistry` assumes
registration only ever happens from one place.

**Providers can be genuinely dynamic.** `workshop://projects` reads live
from `ProjectsStore.all()` every time it's resolved, not a snapshot frozen
at registration time, since a provider is just a function, called fresh on
every navigation. Visiting it after adding a new project in the Notebook
shows the new project, with no wiring beyond the one `register()` call.

**Real documentation, not stub pages.** `workshop://docs`,
`workshop://builder`, and `workshop://animation` `fetch()` this project's
own actual `README.md`/`docs/WORLDBUILDER.md`/`docs/PLAYER.md` — the exact
files this repository already ships as static files (GitHub Pages serves
the whole repository, `docs/*.md` included) — and render them with
`src/utils/SimpleMarkdown.js`, a small, line-based renderer covering
exactly what these files actually use (headers, paragraphs, bold/italic,
inline code, fenced code blocks, nested bullet lists, links, horizontal
rules) rather than a general-purpose CommonMark implementation. Reading
`workshop://docs` always shows the genuine, currently-accurate
documentation, not a copy that drifts out of date the next time these
files change. Fetch paths are relative (`./README.md`, not `/README.md`) —
GitHub Pages project sites are commonly deployed to a subpath rather than a
domain root, and a root-relative path would silently break on exactly that
common case; `index.html`'s own stylesheet links already use this same
relative convention for the identical reason.

## Persistence

"Closing and reopening the Workshop should feel like waking up a computer
rather than launching a brand-new browser." `BrowserStore.js` persists
ordinary JSON through the normal `PersistenceSystem` path — every tab is
`{ id, history: string[], historyIndex, scrollY, title }`, and
`history`/`historyIndex` together are the entire back/forward mechanism
(`historyIndex` points at the current entry; navigating to a new page
truncates anything ahead of it first, the ordinary "visiting somewhere new
clears forward history" every real browser already has).

There is always at least one tab — closing the last one opens a fresh Home
tab rather than leaving the Browser with nothing to show, the same
"never an empty, purposeless state" instinct behind
`AnimationLibraryStore` always keeping its own defaults available.

**"Scroll positions where practical"** — practical specifically means
same-origin `workshop://` pages. A cross-origin `http(s)://` iframe's
scroll position is genuinely unreadable from the parent page; the
browser's own same-origin policy blocks that, full stop, for every
embedded browser view that has ever existed, not a Workshop limitation to
engineer around. `BrowserApp.js` only ever tracks/restores scroll for
`workshop://` tabs, where `iframe.contentWindow` is genuinely accessible.

## Browser architecture: one persistent iframe *identity* per tab

`BrowserApp.js` keeps one `<iframe>` alive per open *tab* — hidden via CSS
(`display: none` on the inactive ones) rather than destroyed when its tab
isn't the active one, so switching tabs never loses a page's live state.
Every render reconciles this against `BrowserStore`'s own tab list: new
tabs get a frame; closed tabs lose theirs; switching to a tab that's
already showing the right thing never touches its frame at all.

**Navigating to a new URL *within* a tab creates a fresh iframe element**,
replacing rather than mutating the existing one's `src`/`srcdoc` — a
deliberate fix, not the original design. The first version reused the
same element and just changed its content, which turned out to be the
actual root cause of a real reported bug ("the Browser often does not
visually update until the player switches to another tab and back") — an
iframe's own rendered layer isn't always reliably invalidated by the
browser when its content changes while the element itself never moves,
resizes, or toggles visibility, and switching tabs only ever "fixed" it
as a side effect of forcing a genuine relayout. See `docs/HOST.md`'s own
"Browser Refinement" section for the full account. Nothing about
state-preservation *between* tabs was lost by this — a URL change already
resets scroll position regardless, so there was never anything worth
keeping across it in the first place.

**Two kinds of page, one display mechanism.** An ordinary `http(s)://` URL
becomes `iframe.src`; a `workshop://` URL resolves through `PageRegistry`
and becomes `iframe.srcdoc` (wrapped in a complete HTML document by
`PageShell.js`, which every `workshop://` page shares — none of them need
to remember to look like the Workshop themselves).

**`workshop://` links inside a page** aren't a protocol real browsers
understand, so a plain `<a href="workshop://docs">` would otherwise just do
nothing when clicked from inside the iframe. `PageShell.js`'s own shared
script intercepts these clicks and `postMessage`s the target URL to the
parent, which is what actually navigates the tab — one shared handler
every `workshop://` page gets automatically, not something each page needs
to implement itself. Ordinary `http(s)://` links (external documentation
references, say) are left alone entirely; `SimpleMarkdown.js` already gives
them `target="_blank"`, so they open as real, separate browser tabs outside
the Workshop, exactly as an external reference should.

### Address input and URL normalisation

A bare domain, `localhost`, an IP, or `localhost:3000` gets an inferred
`http://`/`https://` scheme rather than being treated as a search query —
"please treat these simply as browser pages," and the brief's own examples
(`github.com`, `localhost`, `127.0.0.1`, `localhost:3000`,
`localhost:11434`) are all addresses, not queries. No search-engine
integration was asked for, so none was added — typing something that isn't
a recognisable address or `workshop://` path simply becomes an
(admittedly probably unhelpful) `https://` guess, matching "avoid
unnecessary complexity" over inventing a search feature nobody asked for.

## A real, honest limitation: `X-Frame-Options`

Most modern sites — GitHub very much included — send `X-Frame-Options` or
a Content-Security-Policy `frame-ancestors` header that blocks being
embedded inside anyone else's page, by design, as a security measure for
their own users. No amount of code in this Browser changes that: it's
enforced by the *visitor's own browser*, reading headers the *remote
server* sends, a decision made entirely outside this file's reach. There
is also no reliable, cross-origin way to even detect that this happened —
a blocked frame simply shows nothing, and `iframe.onload` still fires
either way, blocked or not, so a JavaScript-visible "this failed" signal
doesn't exist to check for.

Rather than pretend otherwise, every tab has a small, permanent
"Open in a new browser tab ↗" toolbar button — a real escape hatch for
exactly this situation, visible the entire time a `http(s)://` page is
open, not an error message that only sometimes appears. Local development
servers (`localhost`, `127.0.0.1`, a Vite/webpack dev server, Ollama's own
`localhost:11434`) typically don't send these headers at all, and embed
correctly — this limitation is really only about the wider, security-
conscious internet, not local development, which is exactly the case the
brief's own examples emphasise.

## Preparing for Workshop Host

"The Workshop Host is NOT being implemented during this phase... simply
prepare the architecture so it can slot in naturally later." Concretely,
that preparation is: `PageRegistry` already doesn't care who calls
`register()` or when. `workshop://host` is registered today — a real,
working page, just one that's honest about what it will become
(`hostPlaceholderPage()` in `WorkshopPages.js`) rather than a stub
pretending to be a feature. The moment a genuine Workshop Host exists,
replacing that one `register("host", ...)` call — and adding
`register("programs", ...)`, `register("models", ...)`,
`register("plugins", ...)`, `register("services", ...)` beside it — is the
entire integration. Nothing about `BrowserApp.js` or `PageRegistry.js`
itself needs to change at all; a Host-provided page is exactly as valid a
provider as `workshop://projects`' own function already is.

"The Browser should become the Workshop's window into digital spaces. The
future Workshop Host will become the bridge between the Workshop and the
local machine." That separation is already real, not aspirational: this
Browser has no filesystem access, no way to launch a program, no
connection to Ollama or any other local service — it displays pages, full
stop. Everything in "Future Host Responsibilities" (launching
applications, opening local projects/folders/files, connecting to Ollama,
plugin management, local Workshop services, automation, future hardware
integrations) is Host territory, arriving later as pages this same
registry displays, not capabilities this Browser needs to grow into.

## Known simplifications (by design, for this phase)

- **No search engine integration** — see "Address input" above. A bare,
  unrecognisable query becomes a best-effort `https://` guess, not a
  search results page.
- **No bookmarks/favourites yet** — Workshop Home's own "Suggestions
  include... Favourite pages" stayed a suggestion; "Recently visited"
  (drawn live from every open tab's own history) covers the more
  immediately useful half of that idea without adding a second, separate
  favourites store this pass didn't have a clear design for yet.
- **Tab titles for `http(s)://` pages fall back to the hostname.** Reading
  a cross-origin page's real `<title>` is blocked by the same same-origin
  policy that blocks scroll-position access — an ordinary web-platform
  constraint, not something specific to the Workshop.
- **`workshop://settings` is intentionally small** — clearing browsing
  data is the one real action it offers; there's no per-tab or per-site
  preference yet, since none of the current pages have settings worth
  exposing.

## Future extension points

- **Workshop Host pages** — see "Preparing for Workshop Host" above; this
  is the big one, and the architecture is already shaped for it.
- **A favourites store**, alongside `BrowserStore`'s own history — the
  same shape as `AnimationLibraryStore`'s "defaults vs. user-created"
  split would fit naturally: a small, separate list of saved URLs,
  referenced by `workshop://` pages the same way `workshop://projects`
  already reads `ProjectsStore` live.
- **A directory/search page over `PageRegistry.list()`** — every
  registered `workshop://` path is already enumerable; nothing about the
  registry needs to change to support browsing "everything available"
  as its own page.
- **AI Configuration, Workshop Resident, Plugin System, Local
  Applications, and future internal Workshop pages** all slot in as more
  `pageRegistry.register()` calls, from wherever those systems eventually
  live — this Browser was built to not need to know the difference.
