'use client'

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// SCROLL THAT READS AS SOMETHING.
// ───────────────────────────────────────────────────────────────────────────
// The page had the kit's Rise on three headings: opacity 0→1 and 22px of
// travel over .9s, everything in a section arriving at the same instant. That
// is technically an animation and visually nothing — by the time your eye
// reaches the words they have already finished moving, and a whole section
// landing as one block is indistinguishable from it being there all along.
//
// Three things fix it, and none of them is "more movement":
//
//   1. STAGGER. Eyebrow, then rule, then title, then lede — 90ms apart. The
//      eye follows an order instead of catching a finished state. This is what
//      actually makes a page feel composed rather than animated.
//   2. DISTANCE AND TIME. 22px over .9s is below the threshold you notice.
//      40px over 1.1s on a slow-out curve is not.
//   3. A WIPE FOR THE PICTURES. A photograph fading up looks like a slow
//      image load — which is exactly the wrong association. It is uncovered
//      instead: clip-path from the bottom edge while the image itself sits at
//      1.06 and settles to 1, so the frame reveals and the picture relaxes
//      into it.
//
// ONE OBSERVER PER ELEMENT, DISCONNECTED ON ARRIVAL. Nothing re-animates on
// the way back up: a page that replays itself every scroll is a page people
// stop scrolling. And every one of these is a no-op under
// prefers-reduced-motion — the content is simply there.
// ═══════════════════════════════════════════════════════════════════════════

function useSeen<T extends HTMLElement>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, rootMargin])
  return { ref, seen }
}

/** One thing arriving. `step` is its place in the stagger, not milliseconds —
 *  the interval lives in the CSS so it can be tuned in one spot. */
export function Reveal({ children, step = 0, variant = 'rise', className = '', style }: {
  children: ReactNode
  step?: number
  variant?: 'rise' | 'wipe' | 'slide'
  className?: string
  style?: CSSProperties
}) {
  const { ref, seen } = useSeen<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`tr tr-${variant} ${seen ? 'is-in' : ''} ${className}`}
      style={{ ['--i' as string]: step, ...style }}
    >
      {children}
    </div>
  )
}

/** A hairline that fills as the page is read. It is the only thing on the page
 *  that moves continuously, which is why it is one pixel of gold and nothing
 *  else — a progress bar you notice is a progress bar in the way. */
export function ScrollRail() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const read = () => {
      raf = 0
      const h = document.documentElement.scrollHeight - window.innerHeight
      setPct(h > 0 ? Math.min(1, window.scrollY / h) : 0)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div className="tr-rail" aria-hidden><span style={{ transform: `scaleX(${pct})` }} /></div>
}

export const TET_SCROLL_CSS = `
:root { --tr-step: 90ms; --tr-ease: cubic-bezier(.16,.84,.44,1); }

.tr { will-change: transform, opacity; }
.tr-rise, .tr-slide {
  opacity: 0;
  transition: opacity .8s var(--tr-ease), transform 1.1s var(--tr-ease);
  transition-delay: calc(var(--i, 0) * var(--tr-step));
}
.tr-rise  { transform: translateY(40px); }
.tr-slide { transform: translateX(-28px); }
.tr-rise.is-in, .tr-slide.is-in { opacity: 1; transform: none; }

/* The pictures are UNCOVERED, not faded. clip-path animates on the compositor
   and, unlike a height or a mask-image, needs no wrapper to clip against. */
.tr-wipe { clip-path: inset(0 0 100% 0); transition: clip-path 1.15s var(--tr-ease);
           transition-delay: calc(var(--i, 0) * var(--tr-step)); }
.tr-wipe.is-in { clip-path: inset(0 0 0 0); }
.tr-wipe > img { transform: scale(1.06); transition: transform 1.6s var(--tr-ease);
                 transition-delay: calc(var(--i, 0) * var(--tr-step)); }
.tr-wipe.is-in > img { transform: none; }

.tr-rail { position: fixed; top: 0; left: 0; right: 0; height: 1px; z-index: 9000;
           background: rgba(229,212,194,.1); pointer-events: none; }
.tr-rail span { display: block; height: 100%; background: #D4B85A;
                transform-origin: 0 50%; transform: scaleX(0); }

@media (prefers-reduced-motion: reduce) {
  .tr, .tr-wipe > img { opacity: 1 !important; transform: none !important;
                      clip-path: none !important; transition: none !important; }
  .tr-rail { display: none; }
}
`
