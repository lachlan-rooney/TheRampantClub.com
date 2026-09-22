'use client'

import type { ReactNode } from 'react'
import { Reveal } from '@/components/tet/TetScroll'

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
// of. Motion that costs you the subject is not worth having.
//
// The plate is UNCOVERED on arrival instead: components/tet/TetScroll wipes the
// frame open from the bottom while the picture settles from 1.06 to 1. A
// photograph that fades up looks like a slow image load, which is the one
// association a photograph must not have.
// ═══════════════════════════════════════════════════════════════════════════

export default function TetPlate({
  src, sm, width, height, smWidth = 900, alt = '', caption, eager = false,
  maxWidth = 1120, align = 'start', step = 0, overlay,
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
  /** Place in the stagger, so a pair of plates does not arrive as one slab. */
  step?: number
  /** Laid over the photograph, bottom-left, on a soft shade so it reads. */
  overlay?: ReactNode
}) {
  return (
    <figure className="tp" style={{ maxWidth, marginInline: align === 'center' ? 'auto' : undefined }}>
      <Reveal variant="wipe" step={step} className="tp-frame"
              style={{ aspectRatio: `${width} / ${height}` }}>
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
        {overlay && <div className="tp-over">{overlay}</div>}
      </Reveal>
      {caption && (
        <Reveal step={step + 1}>
          <figcaption className="tp-cap">{caption}</figcaption>
        </Reveal>
      )}
    </figure>
  )
}

export const TET_PLATE_CSS = `
.tp { margin: 0; }

/* A hairline, not a box — the picture has edges of its own. */
.tp-frame { position: relative; width: 100%; overflow: hidden; border-radius: 2px;
            background: rgba(229,212,194,.05); }
/* The PHOTOGRAPH only — "> img". An overlay can carry an image of its own
   (the Duncan Taylor crest), and ".tp-frame img" stretched it to fill. */
.tp-frame > img { display: block; width: 100%; height: 100%; object-fit: cover; }
.tp-over { position: absolute; inset: 0; display: flex; align-items: flex-end;
           padding: clamp(18px, 3.2vw, 44px); pointer-events: none;
           background: linear-gradient(to top, rgba(4,20,14,.72), rgba(4,20,14,0) 58%); }

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

`
