// Minimal service worker for PWA install support
// Caches the app shell for offline fallback. Menu data is cached by the app itself, per day.

const CACHE = 'gmu-dining-v2';
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, res) {
  if (res.ok) {
    const clone = res.clone();
    caches.open(CACHE).then((c) => c.put(request, clone));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Built assets have hashed names and never change, so serve them from cache first.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => putInCache(e.request, res)))
    );
    return;
  }

  // Everything else: try the network, but fall back to the cached copy if it is slow or down.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => putInCache(e.request, res));
      if (!cached) return network;
      const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
      return Promise.race([network.catch(() => cached), timeout]);
    })
  );
});
