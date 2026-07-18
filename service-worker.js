/**
 * service-worker.js
 * -------------------
 * What this does and doesn't do, honestly:
 *
 *   - After you've opened the workshop once with a network connection, it
 *     works offline on every visit after that.
 *   - It does NOT make the very first visit work offline. Three.js is
 *     loaded from a CDN via the import map in index.html (see that file's
 *     comment) rather than vendored into this repo, specifically to keep
 *     the project buildless and trivially GitHub-Pages-able. That's the
 *     one real trade-off of this approach: true zero-network first-load
 *     would mean committing Three.js's source into the repo instead.
 *   - It does not enumerate every source file by hand. Rather than
 *     maintaining a brittle, always-slightly-stale list of every .js file
 *     in src/ (which would need updating every time a file is added), only
 *     the true "shell" is precached on install; everything else — every
 *     module, every CDN asset — is cached the first time it's actually
 *     requested, and kept fresh from then on.
 *
 * **Two different strategies for two different kinds of request** (v3.0.3c
 * — "loading a new version needs a load, then a refresh, then another load
 * to actually see it"). The Workshop's own files (this repo's own
 * same-origin source: index.html, everything under css/ and src/,
 * manifest.json) are **network-first**: always try the network, and only
 * fall back to the cache if that fails. Cross-origin requests (the Three.js
 * CDN, via the import map) stay **stale-while-revalidate**: cached content
 * served immediately, refreshed in the background for next time — the
 * right tradeoff for a pinned, versioned vendor URL that essentially never
 * changes once fetched, since instant repeat loads matter more there than
 * always re-checking a URL that was never going to be different anyway.
 *
 * That split is the actual root cause fix, not just a version bump. The
 * *original* single stale-while-revalidate strategy applied to this repo's
 * own files too — meaning even right after a fresh deploy, the very next
 * load would serve the *old* cached shell immediately (correct
 * stale-while-revalidate behaviour!) and only finish refreshing the cache
 * in the background, so it took a *second* reload to actually see the
 * update. Bumping `CACHE_NAME` alone doesn't fully fix this either: the
 * browser's own service-worker update check happens on navigation, so the
 * very first load of a new deploy can still be answered by whichever
 * worker was already active when that navigation started — but once a new
 * worker *is* controlling the page (immediately, thanks to `skipWaiting()`/
 * `clients.claim()` below), network-first means every reload after that
 * gets the actual current file over the network, not whatever a
 * background refresh happened to have cached by then.
 *
 * One layer deeper than the Cache API sits the browser's own default HTTP
 * cache, governed by whatever headers the server sends — Python's
 * `http.server` (this project's own dev server, see `.claude/launch.json`)
 * sends `Last-Modified` but no `Cache-Control` at all, which browsers
 * treat as licence to apply *heuristic* freshness (serving straight from
 * their own HTTP cache, no request even reaching this file, for some
 * fraction of the time since a file last changed — RFC 7234 §4.2.2). A
 * plain `fetch()` respects that regardless of which cache-management logic
 * called it, service worker or not — so "network-first" above isn't
 * actually network-first unless the fetch itself is told to skip that
 * layer too. Every same-origin fetch this file makes (both here and in
 * the install-time precache below) passes `{ cache: "no-store" }`
 * (`"reload"` for the precache — see that comment) for exactly this
 * reason, confirmed necessary by testing: without it, a single reload
 * after a real file change still served the old content, silently, from
 * a cache layer this file's own logic never even sees.
 *
 * All URLs here are relative to this file's own location, which is what
 * makes this work unmodified whether the workshop is served from a
 * domain's root or from a GitHub Pages project subpath
 * (`username.github.io/repo-name/`).
 */

const CACHE_NAME = "workshop-cache-v3";

const SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/tokens.css",
  "./css/main.css",
  "./css/overlays.css",
  "./css/computer.css",
  "./css/builder.css",
  "./css/workbench.css",
  "./css/buildmode.css",
  "./css/music.css",
  "./css/phone.css",
  "./css/tools.css",
  "./css/touch.css",
  "./src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // `{ cache: "reload" }` — see this file's own top comment on why a
      // plain fetch alone isn't enough to guarantee this precache step
      // actually reads the current files rather than the browser's own
      // (unrelated to this file's Cache API usage) HTTP cache.
      .then((cache) => cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const OFFLINE_RESPONSE = () => new Response("Offline, and this hasn't been cached yet.", { status: 503, statusText: "Offline" });

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // never cache saves, exports, or any other non-GET traffic

  const isOwnFile = new URL(request.url).origin === self.location.origin;

  if (isOwnFile) {
    // Network-first — see this file's own top comment for why. Always try
    // the network; only reach for the cache if that fails outright
    // (genuinely offline, or a real network error), never just because a
    // cached copy happens to exist already. `{ cache: "no-store" }`
    // (constructing a fresh Request rather than mutating the original,
    // read-only one) is what actually makes this "the network" rather
    // than "whichever cache the browser's own HTTP layer feels like" —
    // see this file's own top comment.
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" }))
        .then((networkResponse) => {
          if (networkResponse?.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? OFFLINE_RESPONSE()))
    );
    return;
  }

  // Cross-origin (the Three.js CDN) — unchanged stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          const isCacheable = networkResponse && (networkResponse.ok || networkResponse.type === "opaque");
          if (isCacheable) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        // Serve the cached copy immediately; the network fetch above still
        // runs in the background to refresh the cache for next time.
        return cachedResponse;
      }
      return networkFetch.then((response) => response ?? OFFLINE_RESPONSE());
    })
  );
});
