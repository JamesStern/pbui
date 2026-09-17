const VERSION = 'v2';
const CACHE = `pbui-${VERSION}`;
// On localhost go network-first so edits show up immediately; production is cache-first.
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/version.js',
  './js/units.js',
  './js/measure.js',
  './js/quiz.js',
  './js/store.js',
  './js/poster.js',
  './js/ui.js',
  './assets/fonts/SpaceMono-400.woff2',
  './assets/fonts/SpaceMono-700.woff2',
  './assets/fonts/Caveat-600.woff2',
  './assets/figures/torso.png',
  './assets/figures/rings.png',
  './assets/figures/whole.png',
  './assets/figures/span.png',
  './assets/figures/peek.png',
  './assets/figures/phalanx.png',
  './assets/figures/cubit.png',
  './assets/figures/kneeling.png',
  './assets/figures/foot.png',
  './assets/figures/reach.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (DEV) {
    event.respondWith(
      fetch(req)
        .then((resp) => { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return resp; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
