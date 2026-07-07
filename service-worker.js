/**
 * service-worker.js
 * -------------------
 * What this does and doesn't do, honestly:
 *
 *   - After you've opened the workshop once with a network connection, it
 *     works offline (and loads instantly) on every visit after that —
 *     standard "stale-while-revalidate" caching: cached content is served
 *     immediately, while a background fetch quietly refreshes the cache
 *     for next time.
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
 * All URLs here are relative to this file's own location, which is what
 * makes this work unmodified whether the workshop is served from a
 * domain's root or from a GitHub Pages project subpath
 * (`username.github.io/repo-name/`).
 */

const CACHE_NAME = "workshop-cache-v1";

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
  "./css/touch.css",
  "./src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // never cache saves, exports, or any other non-GET traffic

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
      return networkFetch.then((response) => response ?? new Response("Offline, and this hasn't been cached yet.", { status: 503, statusText: "Offline" }));
    })
  );
});
