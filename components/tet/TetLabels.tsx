'use client'

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { MONO, GOLD } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE THREE BLENDS, BY THEIR OWN LABELS.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "use the images of the 5 star, 12 and 18 for the duncan
// taylor section". The old Blend 18 picture was a pack shot on a white ground
// and was dropped for exactly that; these are Duncan Taylor's PRINT artwork
// (DT_Blend_Labels_Complete/DT_*_Blend_Front.pdf), rendered from the PDF and
// cut exactly inside the cyan dieline, so they carry no white box and no
// printer's marks — just the label.
//
// THE SHEEN IS THE FOIL. The print spec on each sheet says "gold ink indicates
// matte gold foil-stamping", so the label tilts toward the pointer and a band
// of light crosses it the way it would cross foil in the hand. It is the one
// thing about these bottles a screen otherwise loses.
//
// ⚠ The labels print "750ml"; tet_blend_board says 700 ml. The words under
// each card come from the board, so the page does not contradict itself — but
// one of them is wrong, and Duncan Taylor should say which.
// ═══════════════════════════════════════════════════════════════════════════

export interface BlendLabel {
  sku: string
  name: string
  detail: string
}

const ART: Record<string, string> = {
  'DT-5STAR': 'label-5star',
  'DT-12YO': 'label-12',
  'DT-18YO': 'label-18',
}

export const hasLabel = (sku: string) => sku in ART

export default function TetLabels({ blends }: { blends: BlendLabel[] }) {
  const shown = blends.filter(b => hasLabel(b.sku))
  if (!shown.length) return null
  return (
    <div className="lb-row">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {shown.map((b, i) => <Card key={b.sku} b={b} i={i} />)}
    </div>
  )
}

function Card({ b, i }: { b: BlendLabel; i: number }) {
  const el = useRef<HTMLDivElement>(null)
  const tilt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const n = el.current; if (!n || e.pointerType !== 'mouse') return
    const r = n.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    n.style.setProperty('--rx', `${(0.5 - y) * 12}deg`)
    n.style.setProperty('--ry', `${(x - 0.5) * 14}deg`)
    n.style.setProperty('--gx', `${x * 100}%`)
    n.style.setProperty('--gy', `${y * 100}%`)
  }
  const rest = () => {
    const n = el.current; if (!n) return
    n.style.setProperty('--rx', '0deg'); n.style.setProperty('--ry', '0deg')
  }
  const art = ART[b.sku]
  return (
    <figure className="lb" style={{ ['--i' as string]: i }}>
      <div ref={el} className="lb-card" onPointerMove={tilt} onPointerLeave={rest}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/images/tet/${art}.webp`}
             srcSet={`/images/tet/${art}-sm.webp 380w, /images/tet/${art}.webp 760w`}
             sizes="(max-width: 780px) 30vw, 300px"
             width={760} height={1128} alt={b.name} loading="lazy" decoding="async" />
        <span className="lb-foil" aria-hidden />
      </div>
      <figcaption>
        <div className="lb-name">{b.name}</div>
        <div className="lb-detail">{b.detail}</div>
      </figcaption>
    </figure>
  )
}

const CSS = `
.lb-row { display: grid; grid-template-columns: repeat(3, minmax(0, 300px)); gap: clamp(14px, 3vw, 44px);
          margin-top: 48px; perspective: 1100px; }
.lb { margin: 0; opacity: 0; transform: translateY(34px);
      animation: lb-in 1s cubic-bezier(.16,.84,.44,1) forwards; animation-delay: calc(.15s + var(--i) * .14s);
      animation-play-state: paused; }
.tr.is-in .lb { animation-play-state: running; }
@keyframes lb-in { to { opacity: 1; transform: none; } }
.lb-card { position: relative; border-radius: 3px; overflow: hidden; transform-style: preserve-3d;
           transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
           transition: transform .5s cubic-bezier(.16,.84,.44,1), box-shadow .5s ease;
           box-shadow: 0 22px 44px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.3); }
.lb-card:hover { transition: transform .12s linear, box-shadow .5s ease;
                 box-shadow: 0 34px 60px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3); }
.lb-card img { display: block; width: 100%; height: auto; }
/* Light on foil: a narrow band that crosses the label with the pointer.
   Overlay blending lifts what is already light — the gold, the panel — and
   leaves the black ground black, which is what foil does and ink does not. */
.lb-foil { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: 0;
           background: linear-gradient(105deg, rgba(255,250,230,0) calc(var(--gx, 50%) - 16%),
                       rgba(255,250,230,.85) var(--gx, 50%), rgba(255,250,230,0) calc(var(--gx, 50%) + 16%));
           transition: opacity .4s ease; }
.lb-card:hover .lb-foil { opacity: 1; }
.lb figcaption { margin-top: 18px; }
.lb-name { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(15px, 1.8vw, 20px); line-height: 1.15; }
.lb-detail { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .06em; opacity: .55; margin-top: 6px; }
.lb-card:hover + figcaption .lb-name { color: ${GOLD}; }
@media (max-width: 560px) { .lb-detail { font-size: 9.5px; } }
@media (prefers-reduced-motion: reduce) {
  .lb { animation: none; opacity: 1; transform: none; }
  .lb-card { transition: none; transform: none; }
}
`
