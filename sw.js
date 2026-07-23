/* recipedb board — service worker.
 *
 * Exists only to make the page installable and survive a cold start offline. It caches
 * the SHELL and nothing else.
 *
 * Hard rule: never touch api.github.com. Those responses carry the contents of the
 * PRIVATE recipedb repo, and caching them would write private recipe data to disk outside
 * the page's control — the exact thing the public-shell/private-data split exists to
 * prevent. Anything not a same-origin shell asset goes straight to the network, uncached.
 */
const VERSION = "rdb-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Never cache, never intercept: API traffic and anything cross-origin (fonts, API).
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;
  // Network-first for the shell, revalidating against the server so a deploy is not
  // hidden behind GitHub Pages' 10-minute cache header.
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
