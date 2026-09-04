// Service worker for MSP Tycoon's install/offline support. This is the
// one file that genuinely can't be inlined into index.html -- browsers
// require a service worker to be fetched from a real URL, unlike the
// manifest, which is a data: URI in index.html's <head>.
//
// Bump CACHE when publishing a build worth forcing offline players onto
// sooner. Low-stakes either way: the fetch handler below is network-first,
// so anyone online always gets the current file regardless of this name.
const CACHE = "msp-tycoon-v4";
const CORE = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always prefer a live copy so a returning player gets
// whatever was last deployed, and only fall back to the cached copy --
// keeping it fresh on every successful fetch -- when there's no network
// at all.
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./")))
  );
});
