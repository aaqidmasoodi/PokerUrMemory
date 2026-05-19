// Minimal service worker — enables PWA install prompt and basic offline resilience.
// For a multiplayer game, we use network-first: always try the network,
// fall back to cache only if the network is unavailable.

const CACHE = 'pokermemory-v9';
const PREV_CACHES = ['pokermemory-v1', 'pokermemory-v2', 'pokermemory-v3', 'pokermemory-v4', 'pokermemory-v5', 'pokermemory-v6', 'pokermemory-v7', 'pokermemory-v8'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(
  Promise.all([
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => PREV_CACHES.includes(k)).map(k => caches.delete(k)))
    ),
    clients.claim(),
  ])
));

self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin assets
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Don't intercept socket.io traffic
  if (url.pathname.startsWith('/socket.io')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache complete successful responses (status 200)
        // Cache API doesn't support 206 Partial Content
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
