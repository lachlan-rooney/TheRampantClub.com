'use client'

import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// A PLATE — a photograph shown whole.
// ───────────────────────────────────────────────────────────────────────────
// This replaces the full-bleed bands, which threw the pictures away.
//
// A band is width:100vw with a height in vw, and the image inside it is
// object-fit:cover. Those two numbers almost never agree with the photograph's
// own shape, so the browser crops whatever does not fit — and on a picture of a
// BOTTLE, what does not fit is the bottle. A 1700×950 shot in a 1400×560 band
// loses a third of its height, top and bottom, which is exactly where the neck
// and the base are. The page ended up showing the middle of a label and a lot
// of heather.
//
// THE FIX IS ARITHMETIC, NOT TASTE. The frame is given the image's OWN aspect
// ratio, from its real pixel dimensions. When the frame and the image agree,
// cover and contain are the same thing and nothing is cropped at any width.
// That is the whole component.
//
// So there is no parallax here. Parallax needs the image to be bigger than its
// frame — that surplus is what slides — and surplus is the crop we just got rid
// of. Motion that costs you the subject is not worth having. The plate moves on
// arrival instead: it rises and fades in once, which reads on a long page and
// takes nothing away from the picture.
// ═══════════════════════════════════════════════════════════════════════════

export default function TetPlate({
  src, sm, width, height, smWidth = 900, alt = '', caption, eager = false,
  maxWidth = 1120, align = 'start',
}: {
  src: string
  /** The phone-sized file. Same picture, fewer pixels. */
  sm?: string
  /** The image's REAL pixel size. The frame is shaped from these — get them
   *  wrong and the crop this component exists to prevent comes straight back. */
  width: number
  height: number
  smWidth?: number
  alt?: string
  /** Mono, under a hairline. Say where it is, not how it feels. */
  caption?: string
  eager?: boolean
  maxWidth?: number
  align?: 'start' | 'center'
}) {
  const ref = useRef<HTMLElement>(null)
  const [seen, setSeen] = useState(eager)

  useEffect(() => {
    if (eager || seen) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [eager, seen])

  return (
    <figure
      ref={ref}
      className={`tp ${seen ? 'is-in' : ''}`}
      style={{ maxWidth, marginInline: align === 'center' ? 'auto' : undefined }}
    >
      <div className="tp-frame" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={sm ? `${sm} ${smWidth}w, ${src} ${width}w` : undefined}
          sizes={sm ? `(max-width: 780px) 100vw, ${maxWidth}px` : undefined}
          width={width} height={height} alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
        />
      </div>
      {caption && <figcaption className="tp-cap">{caption}</figcaption>}
    </figure>
  )
}

export const TET_PLATE_CSS = `
.tp { margin: 0; opacity: 0; transform: translateY(18px);
      transition: opacity .9s cubic-bezier(.16,.84,.44,1), transform .9s cubic-bezier(.16,.84,.44,1); }
.tp.is-in { opacity: 1; transform: none; }

/* A hairline, not a box — the picture has edges of its own. */
.tp-frame { position: relative; width: 100%; overflow: hidden; border-radius: 2px;
            background: rgba(229,212,194,.05); }
.tp-frame img { display: block; width: 100%; height: 100%; object-fit: cover; }

.tp-cap { margin-top: 14px; padding-top: 12px;
          border-top: 1px solid rgba(229,212,194,.16);
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
          color: rgba(229,212,194,.5); }

/* Two plates side by side, each still at its own shape. They stack on a phone
   rather than shrinking to stamps. */
.tp-pair { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 3vw, 40px);
           align-items: start; }
@media (max-width: 780px) { .tp-pair { grid-template-columns: 1fr; gap: 44px; } }

@media (prefers-reduced-motion: reduce) {
  .tp { opacity: 1; transform: none; transition: none; }
}
`
