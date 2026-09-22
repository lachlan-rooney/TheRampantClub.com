'use client'

import { useEffect, useRef } from 'react'

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
//   THE BUTTON HAS NO GLASS (owner, 2026-09-22: "remove the glass thing from
//   surrounding the little dropdown diamond button"). It had a frosted disc,
//   refracting live in Chromium; the diamond stands on its own again.
//
//   HAZIER (same day, "make it hazier on the menu"): the panel's copy of the
//   page is blurred far more after it is bent, so it reads as frosted glass
//   rather than a rippled window. The ripple is kept, just under the haze.
//
// Written here rather than installed: liquid-glass-js does the copy trick
// but is at 0.1.0 with one release, and keeps element ids in its copy — which
// would put duplicate ids on every page that has a menu. This strips them.
// ═══════════════════════════════════════════════════════════════════════════

/** The panel's filter, rendered once. */
export function GlassFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id="trc-glass" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="11" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="46" xChannelSelector="R" yChannelSelector="G" result="bent" />
          {/* The haze. 1.4 was a rippled window, 7 frosted glass; the owner
              asked for "even frostier" — 14. */}
          <feGaussianBlur in="bent" stdDeviation="14" />
        </filter>
      </defs>
    </svg>
  )
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
   scrim and the menu's contents.

   IT SLIDES WITH THE PANEL (2026-09-22, "the motion of it going back in when
   clicking close is not quite smooth"). It used to be UNCOVERED by an animated
   clip-path, on the argument that the page behind glass should stay put while
   the glass moves. Measured in a browser: closing the menu that way dropped 39
   of 110 frames, worst 84ms — a clip-path animation over a filtered layer makes
   the browser re-run the whole blur every frame, and Safari runs SVG filters on
   the CPU. Sliding with transform moves a layer the blur was already painted
   into, once. At this much haze nobody can see the page travel with the glass;
   everybody could see the stutter. Same curve and duration as .nav-menu, so the
   two move as one piece. will-change keeps each on its own layer. */
.nav-glass { position: fixed; top: 0; left: 0; bottom: 0; width: min(400px, 88vw);
             z-index: 8999; overflow: hidden; pointer-events: none;
             transform: translateX(-102%); will-change: transform;
             transition: transform .55s cubic-bezier(.16,.84,.44,1); }
.nav-glass.is-open { transform: none; }
.nav-glass-lens { position: absolute; inset: 0; overflow: hidden; filter: url(#trc-glass); will-change: transform; }
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


/* Somebody who has asked for less transparency gets the solid menu back. */
@media (prefers-reduced-transparency: reduce) {
  .nav-glass { display: none; }
  .nav-menu.has-glass { background: #EADCCB; }
  .nav-dark .nav-menu.has-glass { background: #04251A; }
}
@media (prefers-reduced-motion: reduce) { .nav-glass { transition: none; } }
`
