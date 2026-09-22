'use client'

import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// GLASS — the menu and its button, refracting what is behind them.
// ───────────────────────────────────────────────────────────────────────────
// The effect is the owner's reference: feTurbulence makes a noise field and
// feDisplacementMap pushes pixels around by it, which is what makes a panel
// read as a sheet of glass rather than a tinted rectangle.
//
// ── WHY THERE ARE TWO MECHANISMS ──────────────────────────────────────────
// The usual way is `backdrop-filter: url(#glass)`, which bends the LIVE page
// behind an element. Only Chromium implements an SVG filter inside
// backdrop-filter. Safari and Firefox accept the declaration and draw nothing
// — and every browser on an iPhone is Safari's engine underneath, which is
// most of the membership. liquid-glass-react, the popular library, says so in
// its own README: "displacement will not be visible".
//
// What Safari CAN do is run the same SVG filter on an element ITSELF
// (`filter: url(#glass)`). So:
//
//   THE MENU PANEL refracts a COPY of the page, taken the moment it opens.
//   That works in every browser, and it is only honest because the page does
//   not move while the menu is open — the scrim takes the pointer, so the copy
//   stays true for as long as anyone can see it. It is thrown away on close.
//
//   THE BUTTON floats over the page while it scrolls, so a copy would be
//   stale after one frame, and re-copying the whole page every frame is not
//   a cost worth paying for a 40px diamond. Chromium gets the real thing
//   through backdrop-filter; everything else gets a frosted blur, which is
//   what the glass looks like with the refraction taken out.
//
// Written here rather than installed: liquid-glass-js does the copy trick
// but is at 0.1.0 with one release, and keeps element ids in its copy — which
// would put duplicate ids on every page that has a menu. This strips them.
// ═══════════════════════════════════════════════════════════════════════════

/** The filter definitions, rendered once. Two strengths: the panel is large
 *  and can take a broad, slow ripple; the button is small and needs a finer
 *  one or the diamond simply smears. */
export function GlassFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id="trc-glass" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="11" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="46" xChannelSelector="R" yChannelSelector="G" result="bent" />
          <feGaussianBlur in="bent" stdDeviation="1.4" />
        </filter>
        <filter id="trc-glass-sm" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}

/** True only where an SVG filter inside backdrop-filter actually renders.
 *  `CSS.supports` cannot answer this — Safari says yes and draws nothing — so
 *  it is asked of the engine: navigator.userAgentData exists in Chromium only,
 *  including on Android, and NOT in Chrome for iOS, which is WebKit. */
export function useRefractsBackdrop(): boolean {
  const [yes, setYes] = useState(false)
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }
    setYes(!!nav.userAgentData?.brands?.some(b => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)))
  }, [])
  return yes
}

/** Keeps a refracted copy of the page inside the returned ref while `open`.
 *  The menu marks its own root with data-nav-root and is left out of the copy,
 *  so the glass never shows the menu looking at itself. */
export function useGlassSnapshot(open: boolean) {
  const lens = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = lens.current
    if (!host) return
    if (!open) {
      // After the close transition, so the glass does not empty mid-slide.
      const t = setTimeout(() => host.replaceChildren(), 600)
      return () => clearTimeout(t)
    }
    if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return

    // Every child of <body>, not just the first: in the App Router body holds
    // the page AND Next's route announcer AND injected scripts, in an order
    // nothing guarantees.
    const html = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)
    const ground = body.backgroundColor !== 'rgba(0, 0, 0, 0)' ? body.backgroundColor : html.backgroundColor
    const frame = document.createElement('div')
    frame.className = 'glass-page'
    frame.style.cssText =
      `position:absolute;left:0;top:0;width:${document.documentElement.clientWidth}px;` +
      `background:${ground};color:${body.color};font:${body.font};` +
      `transform:translate3d(${-window.scrollX}px,${-window.scrollY}px,0);pointer-events:none;`

    for (const child of Array.from(document.body.children)) {
      if (/^(SCRIPT|STYLE|LINK|NEXT-ROUTE-ANNOUNCER|TEMPLATE)$/.test(child.tagName)) continue
      frame.appendChild(child.cloneNode(true))
    }

    // The copy is a picture, not a page. Nothing in it may be reachable, run,
    // play, collide with a real id, or contain the menu.
    frame.querySelectorAll('[data-nav-root], script, iframe, video, audio, canvas, noscript, next-route-announcer')
      .forEach(n => n.remove())
    frame.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'))
    frame.querySelectorAll('[autofocus]').forEach(n => n.removeAttribute('autofocus'))
    frame.querySelectorAll('img[loading="lazy"]').forEach(n => n.setAttribute('loading', 'eager'))
    frame.setAttribute('inert', '')
    frame.setAttribute('aria-hidden', 'true')
    host.replaceChildren(frame)

    // THE TINT FOLLOWS WHAT IS BEHIND IT. A fixed 64% cream was right over the
    // cream homepage and wrong over /spaces, which is bottle green: the dark
    // page came through the pale tint as a murky grey-green and the menu's
    // green type sank into it. When the ground and the menu are opposites the
    // glass thickens so the type keeps its contrast; when they match, the
    // page can show through more. Glass that costs the menu its legibility is
    // decoration that broke the navigation.
    const m = ground.match(/(\d+),\s*(\d+),\s*(\d+)/)
    const lum = m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : 1
    const darkMenu = !!host.closest('.nav-dark')
    const opposed = darkMenu ? lum > 0.5 : lum < 0.35
    host.parentElement?.style.setProperty('--glass-a', opposed ? '.84' : '.62')
  }, [open])

  return lens
}

export const GLASS_CSS = `
/* THE PANEL'S GLASS. A fixed layer the width of the menu, painted between the
   scrim and the menu's contents. It is uncovered by clip-path rather than slid:
   the menu moves, but what is behind it does not, so the refracted page must
   stay put while the visible region grows — sliding the copy with the panel
   would show the page travelling with the glass, which glass does not do. */
.nav-glass { position: fixed; top: 0; left: 0; bottom: 0; width: min(400px, 88vw);
             z-index: 8999; overflow: hidden; pointer-events: none;
             clip-path: inset(0 100% 0 0);
             transition: clip-path .55s cubic-bezier(.16,.84,.44,1); }
.nav-glass.is-open { clip-path: inset(0 0 0 0); }
.nav-glass-lens { position: absolute; inset: 0; overflow: hidden; filter: url(#trc-glass); }
/* The tint is what keeps the menu READABLE. Glass with no tint over a busy
   photograph is a menu nobody can read, and that is not a trade to make for
   a look. Enough of the ground to hold type; little enough to see through. */
.nav-glass-tint { position: absolute; inset: 0; background: rgba(234, 220, 203, var(--glass-a, .64)); }
.nav-dark .nav-glass-tint { background: rgba(4, 37, 26, var(--glass-a, .62)); }
/* The edge a real pane of glass has: a highlight down its length, and depth. */
.nav-glass::after { content: ''; position: absolute; inset: 0; pointer-events: none;
                    box-shadow: inset -1px 0 0 rgba(255,255,255,.35), inset -18px 0 40px rgba(255,255,255,.07); }

/* With the glass underneath, the panel stops painting its own ground. */
.nav-menu.has-glass, .nav-dark .nav-menu.has-glass { background: transparent; }

/* THE BUTTON. A small disc of glass behind the diamond. */
.nav-trigger::before { content: ''; position: absolute; inset: -6px; border-radius: 50%;
                       background: rgba(234, 220, 203, .22);
                       -webkit-backdrop-filter: blur(8px) saturate(1.4); backdrop-filter: blur(8px) saturate(1.4);
                       box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.06),
                                   0 4px 14px rgba(0,0,0,.12);
                       z-index: -1; }
.nav-dark .nav-trigger::before { background: rgba(4, 37, 26, .28); }
html.glass-refract .nav-trigger::before { backdrop-filter: url(#trc-glass-sm) blur(2px) saturate(1.3); }

/* Somebody who has asked for less transparency gets the solid menu back. */
@media (prefers-reduced-transparency: reduce) {
  .nav-glass { display: none; }
  .nav-menu.has-glass { background: #EADCCB; }
  .nav-dark .nav-menu.has-glass { background: #04251A; }
  .nav-trigger::before { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(234,220,203,.9); }
}
@media (prefers-reduced-motion: reduce) { .nav-glass { transition: none; } }
`
