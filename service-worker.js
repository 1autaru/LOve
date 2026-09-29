// Cache exclusiv pentru resurse locale explicite, niciodată pentru Supabase.
const PREFIX = `noi-static-${self.registration.scope}-`;
const CACHE = `${PREFIX}v4`;
const FILES = [
  'offline.html', 'manifest.json', 'css/style.css', 'css/responsive.css',
  'js/pwa.js', 'js/appearance.js', 'css/settings.css', 'css/playful.css', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
];
const allowed = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
const offlineURL = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    await self.skipWaiting();
  })());
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
        return await fetch(request, { cache: 'no-store' });
      } catch {
        return (await caches.open(CACHE)).match(offlineURL);
      }
    })());
    return;
  }
  const relativePath = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  const codeAsset = /^(js\/[\w-]+\.js|css\/[\w-]+\.css)$/.test(relativePath);
  if (!allowed.has(url.href) && !codeAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (response.ok && allowed.has(url.href)) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
