/**
 * SearchIndex
 * -------------
 * "Please introduce the foundations for unified searching... Workshop
 * pages, assets, residents, plugins, documentation, Host pages, projects,
 * future services. For this phase, please establish the architecture
 * and integrate wherever practical."
 *
 * A small, flat list of `{ url, title, category, keywords }` entries,
 * contributed by whichever system already knows about something worth
 * finding — `WorkshopPages.js` adds one entry per registered page,
 * `HostPages.js` does the same for `host://` pages, and either could just
 * as easily add one entry *per item* (one per object definition, one per
 * project) rather than only per page, which is exactly what makes this
 * "foundations," not a finished feature: today it indexes pages, and
 * nothing about its own shape stops a future phase from indexing
 * individual assets or residents by the same mechanism, the moment
 * there's a real per-item URL (`workshop://asset/object/42`, say) worth
 * pointing a search result at.
 *
 * Deliberately **not** wired through `PageRegistry.js` itself — a page
 * provider is a function that might do real work (a `fetch()`, say) to
 * produce its title, and calling every single one just to build a search
 * index would be wasteful and slow. Keeping this a separate, explicitly
 * maintained list means indexing stays cheap (a plain array scan) at the
 * cost of registration code needing one extra line alongside each
 * `pageRegistry.register()` call — a fair trade for something searched
 * far more often than it's registered.
 *
 * `search(query)` is a deliberately simple, synchronous substring match
 * — "this does not require advanced AI, simple continuity is sufficient"
 * (`docs/PERSISTENCE.md`'s own standard elsewhere) applies just as well
 * to a Workshop-scale search box as it does to a resident's own memory.
 * Title matches rank above keyword/category matches; ties keep
 * registration order.
 */
export class SearchIndex {
  constructor() {
    /** @type {Array<{url:string, title:string, category:string, keywords:string[]}>} */
    this._entries = [];
  }

  /** `entry` is `{ url, title, category, keywords = [] }`. Re-adding the
   *  same `url` replaces the previous entry rather than duplicating it —
   *  safe to call again if a title changes, without needing a separate
   *  update method. */
  addEntry(entry) {
    if (!entry?.url || !entry?.title) return;
    this._entries = this._entries.filter((e) => e.url !== entry.url);
    this._entries.push({ url: entry.url, title: entry.title, category: entry.category ?? "Workshop", keywords: entry.keywords ?? [] });
  }

  addEntries(entries) {
    for (const entry of entries ?? []) this.addEntry(entry);
  }

  removeEntry(url) {
    this._entries = this._entries.filter((e) => e.url !== url);
  }

  all() {
    return [...this._entries];
  }

  /** Case-insensitive substring match against title, category, and
   *  keywords — title matches ranked first, since finding something by
   *  its own name is the most common case by far. Empty/whitespace-only
   *  queries return everything (useful for a browsable directory view,
   *  not just a filtered search result). */
  search(query) {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return this.all();
    const titleMatches = [];
    const otherMatches = [];
    for (const entry of this._entries) {
      if (entry.title.toLowerCase().includes(q)) {
        titleMatches.push(entry);
      } else if (entry.category.toLowerCase().includes(q) || entry.keywords.some((k) => k.toLowerCase().includes(q))) {
        otherMatches.push(entry);
      }
    }
    return [...titleMatches, ...otherMatches];
  }
}
