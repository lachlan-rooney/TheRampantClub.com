'use client'

import { useEffect, useRef, useState } from 'react'

// A FULL-BLEED PHOTOGRAPH THAT MOVES WITH THE SCROLL.
//
// The owner's note on this page was that it looked "AI-generated" — no motion,
// no scroll behaviour, nothing that felt made. The honest diagnosis then was
// that it had no photographs at all. It has them now: real Duncan Taylor
// pictures, a cooper closing a cask in Huntly and Octave bottles in Scottish
// heather. This is what carries them.
//
// ── IT COSTS NOTHING WHEN IT IS NOT ON SCREEN ─────────────────────────────
// A scroll listener per band, all firing on every pixel of a long page, is how
// a page with seven photographs starts to feel worse than one with none. Each
// band watches itself with an IntersectionObserver and only subscribes to
// scroll while it is actually visible; off screen it is inert.
//
// One rAF per frame, transform only — never top or background-position, which
// are laid out and painted rather than composited.
//
// ── AND NOTHING FOR SOMEBODY WHO ASKED FOR STILLNESS ──────────────────────
// prefers-reduced-motion is checked once and the whole mechanism is skipped:
// no observer, no listener, no transform. A still photograph is a perfectly
// good photograph.
//
// ── IT DOES NOT MOVE THE PAGE ABOUT ───────────────────────────────────────
// The image is 118% tall inside a fixed-height frame with overflow hidden, and
// only ever slides within that. Width and height are declared so the band
// occupies its space before the bytes arrive — a parallax that reflows the
// page as it loads is worse than no parallax.

export default function TetBleed({
  src, sm, width, smWidth = 820, alt = '', height = 'clamp(280px, 46vw, 560px)',
  position = '50% 50%', eager = false, strength = 14,
}: {
  src: string
  /** The small variant, served to narrow screens. */
  sm?: string
  /** The REAL pixel width of each file. These were hard-coded to 1700w for
   *  every band, which is a lie the browser believes: it picked the large file
   *  on screens that wanted the small one, and picked badly on the bands that
   *  are 1400 or 1500 wide. A srcSet whose descriptors do not match the files
   *  is worse than no srcSet at all. */
  width: number
  smWidth?: number
  alt?: string
  height?: string
  position?: string
  /** The first band on the page loads immediately; everything below waits. */
  eager?: boolean
  /** How far the picture drifts, in percent of its own overflow. */
  strength?: number
}) {
  const frame = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const el = frame.current
    const pic = img.current
    if (!el || !pic) return

    let raf = 0
    let live = false

    const apply = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // -1 when the band is entering at the bottom, +1 when leaving at the top.
      const progress = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2)
      pic.style.transform = `translate3d(0, ${(-progress * strength).toFixed(2)}%, 0)`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply) }

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !live) {
        live = true
        window.addEventListener('scroll', onScroll, { passive: true })
        apply()
      } else if (!e.isIntersecting && live) {
        live = false
        window.removeEventListener('scroll', onScroll)
      }
    }, { rootMargin: '150px 0px' })

    io.observe(el)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])

  return (
    <div ref={frame} className="tb" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        srcSet={sm ? `${sm} ${smWidth}w, ${src} ${width}w` : undefined}
        sizes={sm ? '100vw' : undefined}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'low'}
        decoding="async"
        onLoad={() => setReady(true)}
        className={`tb-img ${ready ? 'is-ready' : ''}`}
        style={{ objectPosition: position }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .tb { position: relative; width: 100vw; margin-left: calc(50% - 50vw);
              overflow: hidden; background: #041F16; }
        .tb-img { position: absolute; inset: -9% 0; width: 100%; height: 118%;
                  object-fit: cover; display: block;
                  opacity: 0; transition: opacity .7s ease; will-change: transform; }
        .tb-img.is-ready { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .tb-img { inset: 0; height: 100%; transform: none !important; transition: none; opacity: 1; }
        }
      ` }} />
    </div>
  )
}
