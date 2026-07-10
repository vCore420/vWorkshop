/**
 * PageRegistry
 * --------------
 * "Please architect the Browser around the idea that it displays pages...
 * The Browser should not contain hardcoded knowledge about Workshop
 * systems. Instead, Workshop systems should simply expose pages that the
 * Browser can display." This is the entire mechanism: a path (the part of
 * a `workshop://` URL after the scheme, e.g. `"docs"` for
 * `workshop://docs`) maps to a provider function. `BrowserApp.js` calls
 * `resolve(path)` for any `workshop://` URL and renders whatever comes
 * back — it has never seen the word "docs" or "projects" anywhere in its
 * own source, the same way `behaviours/registry.js` never hardcodes what
 * "reflective" or "seat" mean.
 *
 * A provider is `async () => ({ title, html })` — `html` is trusted,
 * Workshop-authored markup (rendered via `srcdoc`, not sanitised the way
 * anything from the actual internet would need to be), and `title` is
 * what the tab bar shows. Providers can be genuinely dynamic — the
 * `workshop://projects` provider reads live from `ProjectsStore` every
 * time it's called, not a snapshot frozen at registration time — since
 * it's just a function, called fresh on every navigation.
 *
 * Registration happens once, centrally, in `WorkshopPages.js` (called
 * from main.js after every store it needs already exists) — not
 * scattered across every individual system's own file. That's a
 * pragmatic choice, not a compromise on "systems expose pages, the
 * Browser doesn't know about them": the Browser still only ever talks to
 * this registry, never to `ProjectsStore` or any other system directly.
 * Where the *registration* code physically lives doesn't change that
 * separation; a future system (a plugin, a Workshop Host capability) is
 * just as free to call `pageRegistry.register()` from its own file
 * instead, whenever that's the more natural fit.
 */
export class PageRegistry {
  constructor() {
    /** @type {Map<string, () => Promise<{title:string, html:string}>>} */
    this._providers = new Map();
  }

  /** `path` is normalised the same way `resolve()` normalises whatever it's
   *  asked for — leading/trailing slashes and case don't matter, so
   *  `register("docs")`, `register("/docs")`, and `register("Docs/")` all
   *  register the exact same page. */
  register(path, provider) {
    this._providers.set(normalizePath(path), provider);
  }

  unregister(path) {
    this._providers.delete(normalizePath(path));
  }

  has(path) {
    return this._providers.has(normalizePath(path));
  }

  /** Resolves a path to its page, or `null` if nothing's registered for
   *  it — `BrowserApp.js`'s own "not found" page is what a `null` here
   *  turns into, not this registry's concern. */
  async resolve(path) {
    const provider = this._providers.get(normalizePath(path));
    if (!provider) return null;
    return await provider();
  }

  /** Every currently-registered path — used by `workshop://` itself (the
   *  home page) to list what's available, and could equally back a future
   *  search/directory page without this registry changing at all. */
  list() {
    return [...this._providers.keys()];
  }
}

function normalizePath(path) {
  return (path ?? "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}
