import type { Metadata, Viewport } from 'next'

// ── WHAT INSTALLS ON THE TABLET ────────────────────────────────────────────
// The site has ONE manifest (public/manifest.json, start_url "/"), so adding the
// site to a tablet's home screen installed the PUBLIC HOME PAGE. On a bolted-down
// in-room tablet that is the wrong app.
//
// It is fixed with a SECOND manifest rather than by editing the first, because
// the first is what a MEMBER installs on their phone — pointing that at /kiosk
// would break the member install to fix the tablet one. A nested layout's
// `manifest` overrides the root's for these routes only.
//
// start_url is /kiosk/board: an unpaired tablet is bounced to /kiosk/pair by
// middleware, so a fresh install opens the pairing screen and every install after
// pairing opens the board. scope keeps the standalone window inside /kiosk.
export const metadata: Metadata = {
  manifest: '/kiosk.webmanifest',
  appleWebApp: { capable: true, title: 'Rampant Kiosk', statusBarStyle: 'black-translucent' },
}

// ── THE KIOSK BOUNDARY ─────────────────────────────────────────────────────
// NOTE, because it is the obvious assumption and it is wrong: this layout CANNOT
// remove PWARegistrar. It is mounted in the ROOT app/layout.tsx, and a nested
// layout renders INSIDE the root, it does not replace it. Adding a kiosk layout
// that omits the registrar changes nothing.
//
// The no-caching guarantee is therefore enforced in two places that do work, and
// deliberately in two, because either alone can be undone by a reasonable-looking
// change and the failure is silent — member HTML sitting in the Cache Storage of a
// bolted-down shared tablet, with nothing reporting it:
//
//   1. public/sw.js       — never caches /kiosk, and evicts anything an earlier
//                           version already stored.
//   2. middleware.ts      — Cache-Control: no-store on every /kiosk response,
//                           covering the HTTP disk cache and the back-forward
//                           cache, neither of which the service worker touches.
//
// The standing rule this makes mechanical: NO SERVER-RENDERED MEMBER CONTENT ON
// THE KIOSK. Client-render anything member-specific, as Phase 2 does. The rule
// still matters — the two mechanisms mean breaking it is no longer silent, not
// that it is safe.
//
// The service worker is still REGISTERED on kiosk pages, deliberately: skipping
// registration would put the tablets' installability at risk, and the exclusion
// above already removes the exposure without touching install behaviour.

export const viewport: Viewport = {
  themeColor: '#052E20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return children
}
