import type { Metadata, Viewport } from 'next'
import FooterGate from '@/components/FooterGate'
import PWARegistrar from '@/components/PWARegistrar'
import OverscrollColour from '@/components/OverscrollColour'
import { LangProvider } from '@/lib/lang'

export const metadata: Metadata = {
  title: 'The Rampant Club',
  description: 'A private members\' club in the heart of Sài Gòn',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Rampant',
  },
}

export const viewport: Viewport = {
  themeColor: '#052E20',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* A REFRESH STARTS AT THE TOP. Browsers restore the old scroll
            position on reload, so a page came back half-way down — which read
            as broken on pages that rise in from the top. This runs before
            first paint and only for a reload: back/forward still return you to
            where you were, and a link to an anchor (/spaces#dining) still
            lands on it. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var n=performance.getEntriesByType('navigation')[0];if(!n||n.type!=='reload'||location.hash)return;history.scrollRestoration='manual';window.scrollTo(0,0);addEventListener('load',function(){window.scrollTo(0,0);setTimeout(function(){history.scrollRestoration='auto'},0)})}catch(e){}})()` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="preload" href="/fonts/MNRampantSans-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/GoogleSansCode-VariableFont_wght.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/GoogleSansCode-Italic-VariableFont_wght.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Rampant Sans';
            src: url('/fonts/MNRampantSans-Regular.woff2') format('woff2'),
                 url('/fonts/MNRampantSans-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: block;
          }
          /* Pinyon Script — the log-in and reset buttons. Self-hosted (OFL,
             Latin set) rather than fetched from Google after the page loads:
             that round trip was most of the wait before the log-in button
             appeared. block = never flash the fallback face in its place. */
          @font-face {
            font-family: 'Pinyon Script';
            src: url('/fonts/PinyonScript-Regular.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Google Sans Code';
            src: url('/fonts/GoogleSansCode-VariableFont_wght.ttf') format('truetype');
            font-weight: 100 900;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Google Sans Code';
            src: url('/fonts/GoogleSansCode-Italic-VariableFont_wght.ttf') format('truetype');
            font-weight: 100 900;
            font-style: italic;
            font-display: block;
          }
        ` }} />
      </head>
      <body>
        {/* ONE language context for every surface — admin, the member portal,
            the signing flow and the portal guide. Three implementations had grown;
            see lib/lang.tsx. */}
        <LangProvider>
        <style dangerouslySetInnerHTML={{ __html: `
          /* ─── Typography scale ─────────────────────────────────────
             10 stops. Snap any new font-size to one of these tokens.
             Mono labels: --fs-eyebrow / --fs-body
             Body / cards: --fs-meta / --fs-card
             Headings: --fs-h3 / --fs-h2 / --fs-h1 / --fs-hero       */
          :root {
            --fs-micro:   10px;
            --fs-eyebrow: 11px;
            --fs-body:    12px;
            --fs-meta:    14px;
            --fs-card:    16px;
            --fs-h3:      20px;
            --fs-h2-sm:   24px;
            --fs-h2:      28px;
            --fs-h1:      32px;
            --fs-hero:    48px;
          }
          @media (max-width: 768px) {
            :root {
              --fs-h2:    22px;
              --fs-h1:    26px;
              --fs-hero:  36px;
            }
          }
          * { font-feature-settings: 'ss01' on; box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          /* Never white past the ends of a page, even before any script runs.
             <OverscrollColour /> then matches it to the page's actual edges. */
          html { background-color: #E5D4C2; }
          html { overflow-y: scroll; scrollbar-gutter: auto; }
          /* body clips rather than hides: with html also setting overflow, a
             hidden body becomes a scroll container of its own, and every
             position: sticky on the site silently stops sticking. clip stops
             the sideways scroll the same way without that; browsers without
             clip keep the hidden line above it. */
          html { overflow-x: hidden; }
          body { overflow-x: hidden; overflow-x: clip; }
          ::-webkit-scrollbar { width: 6px; background: transparent; }
          ::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; transition: background 0.3s; }
          html:hover::-webkit-scrollbar-thumb { background: rgba(94, 102, 80, 0.2); }
          html { scrollbar-width: thin; scrollbar-color: transparent transparent; }
          html:hover { scrollbar-color: rgba(94, 102, 80, 0.2) transparent; }

          /* ─── Checkboxes — site-wide TRC cream (one durable rule; new checkboxes
                inherit it). Full treatment: cream bg + defining green edge +
                deep-green tick so the box reads in both states, on dark OR light. */
          input[type="checkbox"] {
            appearance: none; -webkit-appearance: none;
            width: 16px; height: 16px; flex-shrink: 0; vertical-align: middle;
            background: #E5D4C2;
            border: 1.5px solid #5E6650;
            border-radius: 3px;
            cursor: pointer;
            position: relative;
            margin: 0;
          }
          input[type="checkbox"]:checked::after {
            content: ''; position: absolute; left: 4.5px; top: 1px;
            width: 4px; height: 8px;
            border: solid #052E20; border-width: 0 2px 2px 0;
            transform: rotate(45deg);
          }
          input[type="checkbox"]:disabled { opacity: 0.5; cursor: not-allowed; }
        ` }} />
        <PWARegistrar />
        <OverscrollColour />
        {children}
        <FooterGate />
        </LangProvider>
      </body>
    </html>
  )
}
