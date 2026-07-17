/**
 * PageRegistry
 * --------------
 * "Please architect the Browser around the idea that it displays pages...
 * The Browser should not contain hardcoded knowledge about Workshop
 * systems. Instead, Workshop systems should simply expose pages that the
 * Browser can display." This is the entire mechanism: a full URL (e.g.
 * `"workshop://docs"`, `"host://services"`, `"plugin://calculator"`) maps
 * to a provider function. `BrowserApp.js` calls `resolve(url)` for any
 * internal-scheme URL and renders whatever comes back — it has never seen
 * the word "docs" or "projects" anywhere in its own source, the same way
 * `behaviours/registry.js` never hardcodes what "reflective" or "seat"
 * mean.
 *
 * A provider is `async (url) => ({ title, html })` — `html` is trusted,
 * Workshop-authored markup (rendered via `srcdoc`, not sanitised the way
 * anything from the actual internet would need to be), and `title` is
 * what the tab bar shows. Providers can be genuinely dynamic — the
 * `workshop://projects` provider reads live from `ProjectsStore` every
 * time it's called, not a snapshot frozen at registration time — since
 * it's just a function, called fresh on every navigation. `url` (the
 * exact, full URL requested, including anything past the registered
 * path) is handed to every provider — most ignore it entirely, but a page
 * that cares about a query string (`workshop://search?q=...`) or a
 * sub-path (`workshop://asset/object/42`) reads it from there rather than
 * this registry inventing a second, bespoke way to pass parameters.
 *
 * **Browser Ecosystem phase**: this file grew from a single implicit
 * `workshop://` namespace into genuine multi-scheme support —
 * `INTERNAL_SCHEMES` names every scheme the Browser treats as "one of
 * ours" (`workshop`, `host`, `plugin`, and — new in the Workshop Platform
 * phase — `asset`, `resident`, `project`) rather than an ordinary
 * external `http(s)://` address. Exact-path registration (`register()`) is
 * unchanged in spirit; `registerDynamic()` is new, for the handful of
 * pages that can't be enumerated ahead of time (an individual asset's own
 * detail page, one per definition in `ObjectLibraryStore`, say) — a
 * matcher function decides whether a resolver applies to a given URL,
 * checked only when no exact match was found, in registration order.
 *
 * Registration happens once, centrally, in `WorkshopPages.js`/
 * `HostPages.js` (called from main.js after every store either needs
 * already exists) — not scattered across every individual system's own
 * file. That's a pragmatic choice, not a compromise on "systems expose
 * pages, the Browser doesn't know about them": the Browser still only
 * ever talks to this registry, never to `ProjectsStore` or any other
 * system directly. Where the *registration* code physically lives
 * doesn't change that separation; a plugin is just as free to call
 * `pageRegistry.register()` from its own file instead (see
 * `src/host/PluginRegistry.js`), whenever that's the more natural fit.
 */
export const INTERNAL_SCHEMES = ["workshop", "host", "plugin", "asset", "resident", "project"];

const SCHEME_PATTERN = new RegExp(`^(${INTERNAL_SCHEMES.join("|")}):\\/\\/`, "i");

// Version 2 Sign-Off phase — a sibling `schemeOf(url)` (returning which
// scheme matched, not just whether one did) lived here until this
// phase's own dead-code audit found it had never had a single caller
// anywhere, including internally. Removed rather than kept "just in
// case" — see docs/REFINEMENT.md's own "Version 2 Sign-Off" section.
export function isInternalUrl(url) {
  return SCHEME_PATTERN.test(url ?? "");
}

export class PageRegistry {
  constructor() {
    /** @type {Map<string, (url: string) => Promise<{title:string, html:string}>>} */
    this._providers = new Map();
    /** @type {Array<{matches: (url: string) => boolean, resolve: (url: string) => Promise<{title:string, html:string}>}>} */
    this._dynamic = [];
  }

  /** `url` is normalised the same way `resolve()` normalises whatever it's
   *  asked for — trailing slashes and case don't matter, so
   *  `register("workshop://docs")` and `register("Workshop://Docs/")`
   *  both register the exact same page. */
  register(url, provider) {
    this._providers.set(normalizeUrl(url), provider);
  }

  unregister(url) {
    this._providers.delete(normalizeUrl(url));
  }

  has(url) {
    return this._providers.has(normalizeUrl(url));
  }

  /** For pages an exact path can't enumerate ahead of time — an asset
   *  detail page registers one dynamic resolver covering every
   *  `workshop://asset/*` URL rather than one exact registration per
   *  definition that would need updating every time something new is
   *  created. Checked in registration order, only once no exact match
   *  was found; the first matching resolver wins. */
  registerDynamic(matches, resolve) {
    this._dynamic.push({ matches, resolve });
  }

  /** Resolves a URL to its page, or `null` if nothing's registered for
   *  it — `BrowserApp.js`'s own "not found" page is what a `null` here
   *  turns into, not this registry's concern. Exact matches are checked
   *  first (cheaper, and unambiguous), dynamic resolvers second. */
  async resolve(url) {
    const normalized = normalizeUrl(url);
    const provider = this._providers.get(normalized);
    if (provider) return await provider(normalized);
    for (const { matches, resolve: dynamicResolve } of this._dynamic) {
      if (matches(normalized)) return await dynamicResolve(normalized);
    }
    return null;
  }

  /** Every currently-registered exact path — used by `workshop://` itself
   *  (the home page) and `workshop://search` to know what's available.
   *  Dynamic resolvers deliberately aren't listed here (there's no fixed
   *  list of their URLs to enumerate); a system with dynamic pages worth
   *  searching contributes its own entries to `SearchIndex.js` instead. */
  list() {
    return [...this._providers.keys()];
  }

  listByScheme(scheme) {
    const prefix = `${scheme}://`;
    return this.list().filter((url) => url.startsWith(prefix));
  }
}

function normalizeUrl(url) {
  const trimmed = (url ?? "").trim().toLowerCase();
  // A bare scheme root ("workshop://", with nothing after it — the Home
  // page's own URL) must keep its double slash intact; only strip
  // trailing slashes that come *after* a real path, or "workshop://"
  // would collapse into "workshop:" and silently stop matching itself.
  if (/:\/\/$/.test(trimmed)) return trimmed;
  return trimmed.replace(/\/+$/g, "");
}
