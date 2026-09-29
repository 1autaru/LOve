// Cache exclusiv pentru resurse locale explicite, niciodată pentru Supabase.
const PREFIX = `noi-static-${self.registration.scope}-`;
const CACHE = `${PREFIX}v2`;
const FILES = [
  'offline.html', 'manifest.json', 'css/style.css', 'css/responsive.css',
  'js/pwa.js', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
];
const allowed = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
const offlineURL = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.open(CACHE)).match(offlineURL);
      }
    })());
    return;
  }
  if (!allowed.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(request)) || fetch(request);
  })());
});
