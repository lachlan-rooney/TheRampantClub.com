// The Rampant Club — service worker
// Strategy: network-first for navigation (so members always see the latest),
// cache-first for static assets (so the app icon, fonts, images load instantly
// and survive flaky connections).
//
// Bump CACHE_VERSION whenever you change the precache list or cache strategy.

const CACHE_VERSION = 'rampant-v1';
const PRECACHE = [
  '/offline',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/images/logo-mark-cream.png',
  '/images/logo-mark-cream.svg',
  '/images/logo-mark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never touch auth, API, or Supabase requests — they must hit the network and
  // include credentials. Caching them would break login state.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co')
  ) return;

  // Navigation: network-first, fall back to a cached page or the offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache successful HTML responses so they're available offline.
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline'))
        )
    );
    return;
  }

  // Static assets: cache-first.
  if (/\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf|css|js)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return res;
        })
      )
    );
  }
});
