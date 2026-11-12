// The Rampant Club — service worker
// Strategy: network-first for navigation (so members always see the latest),
// cache-first for static assets (so the app icon, fonts, images load instantly
// and survive flaky connections).
//
// Bump CACHE_VERSION whenever you change the precache list or cache strategy.

// ═══════════════════════════════════════════════════════════════════════════
// THE ONE KIOSK PAGE THAT IS CACHED: /kiosk/popup/finder
// ───────────────────────────────────────────────────────────────────────────
// The three tablets inside the pop-up at Independence Palace run on a pocket
// router that will drop during the evening. The Flavour Finder has to keep
// answering when it does, including through a reload.
//
// ⚠ THE EXEMPTION IS ON THE PAGE'S MERITS, NOT FOR CONVENIENCE. It is allowed
// to be stored because of what it does NOT contain:
//   · no member data — no names, no numbers, no sessions, no PII of any kind;
//   · no guest data, and it collects none: nothing is typed into it, nothing
//     is stored, nothing is queued. The club's own finder logs no searches
//     either — there is no searches table anywhere in this codebase — and the
//     pop-up records nothing the club does not;
//   · what it DOES carry is a list of whiskies and their flavour spokes, which
//     is printed on the table the tablet is standing next to.
//
// ⚠ IT IS AN EXACT PATH MATCH, NOT A PREFIX. `startsWith('/kiosk/popup')`
// would have quietly caught the sign-up stand and the door list — and the door
// list carries every guest's name and email. A page added under this path
// later gets no exemption without an edit here.
//
// THE STANDING RULE IS UNCHANGED FOR EVERYTHING ELSE UNDER /kiosk.
const POPUP_FINDER = '/kiosk/popup/finder';
function isPopupFinder(url) {
  return url.pathname === POPUP_FINDER || url.pathname === POPUP_FINDER + '/';
}

const CACHE_VERSION = 'rampant-v2';
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
      Promise.all([
        // Drop superseded caches…
        ...keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        // …and evict any kiosk page an earlier version already stored, so a tablet
        // that ran the old worker does not keep serving what it cached.
        caches.open(CACHE_VERSION).then((cache) =>
          cache.keys().then((reqs) =>
            Promise.all(
              reqs
                // …except the pop-up finder, which is deliberately stored.
                .filter((r) => {
                  const u = new URL(r.url);
                  return u.pathname.startsWith('/kiosk') && !isPopupFinder(u);
                })
                .map((r) => cache.delete(r))
            )
          )
        ),
      ])
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
    url.hostname.includes('supabase.co') ||
    // THE KIOSK IS NEVER CACHED. The tablets are shared and bolted to a room, so
    // anything stored here outlives the member who put it there and is served to
    // whoever is next. Today's kiosk pages are client-rendered and their HTML
    // carries no member data — but that is a rendering choice, and a rendering
    // choice can be changed by someone who never reads this file. The exclusion
    // is mechanical so it holds regardless.
    //
    // ⚠ ONE EXCEPTION, AND IT IS THIS EXACT PATH — see POPUP_FINDER at the top.
    // Everything else under /kiosk still falls through to `return`.
    ((url.pathname === '/kiosk' || url.pathname.startsWith('/kiosk/')) &&
     !isPopupFinder(url))
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
