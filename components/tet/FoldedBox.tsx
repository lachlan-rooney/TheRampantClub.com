'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import type { BoxFolds } from '@/lib/tet/boxes'

// ═══════════════════════════════════════════════════════════════════════════
// A FLAT COVER, FOLDED — one box viewer, any artwork.
// ───────────────────────────────────────────────────────────────────────────
// This was SleeveBox, which folded exactly one sleeve because there was
// exactly one. The design company then sent twelve covers (owner, 2026-09-25),
// so the geometry moved into the caller and the folding stayed here. SleeveBox
// is now this component with the sleeve's own numbers; nothing about how the
// sleeve looks or behaves changed, and its fifteen checks in
// tests/tet/sleeve-ui.test.mjs are what says so.
//
// EVERY FACE IS A SLICE OF THE SAME ARTWORK, positioned by background-size and
// background-position, so a face is never a separate file and can never drift
// from the print. Opposite faces are drawn at their pair's average width: on a
// real box they are equal, and where a measurement is a pixel or two out it is
// the measurement that is wrong, not the box.
//
// All four faces share one vertical frame (art.top → art.bottom), which is why
// a gabled top works: the short faces keep their transparent upper corner and
// the slopes meet the tall face exactly. The shape comes out of the artwork,
// not out of this file.
//
// Drag to turn it, or use the buttons.
// ═══════════════════════════════════════════════════════════════════════════

export interface Turn { label: string; to: number; gold?: boolean }

export default function FoldedBox({ url, folds, turns = [], onBack, label, hint, settleAt = 0 }: {
  url: string
  folds: BoxFolds
  turns?: Turn[]
  /** Laid over the back face — the sleeve's logo. */
  onBack?: ReactNode
  label: string
  hint: string
  /** Where it turns to once it has arrived. */
  settleAt?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(240)            // the box's width on screen
  const [turn, setTurn] = useState(settleAt - 228)
  const [drag, setDrag] = useState(false)
  const from = useRef<{ x: number; turn: number } | null>(null)

  const { art, faces } = folds
  const WIDE = (faces.front.w + faces.back.w) / 2
  const DEEP = (faces.endL.w + faces.endR.w) / 2
  const TALL = art.bottom - art.top

  // Sized to its container, so a phone gets a smaller box, not a clipped one.
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const fit = () => setPx(Math.max(150, Math.min(260, el.clientWidth * 0.34)))
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // It arrives turning, so the first thing it does is show it is a solid.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTurn(settleAt); return }
    const id = setTimeout(() => setTurn(settleAt), 350)
    return () => clearTimeout(id)
  }, [settleAt])

  const k = px / WIDE
  const W = WIDE * k, D = DEEP * k, H = TALL * k

  // One face: its slice of the artwork, stretched to the box's width for it.
  const face = (f: { x: number; w: number }, width: number, transform: string, shade: number, extra?: ReactNode) => {
    const sx = width / f.w
    const size = `${art.w * sx}px ${art.h * k}px`, pos = `${-f.x * sx}px ${-art.top * k}px`
    return (
      <div className="sb-face" style={{
        width, height: H, marginLeft: -width / 2, marginTop: -H / 2, transform,
        backgroundImage: `url(${url})`,
        backgroundSize: size, backgroundPosition: pos,
      }}>
        {shade > 0 && <span className="sb-shade" style={{
          opacity: shade,
          WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`,
          WebkitMaskSize: size, maskSize: size, WebkitMaskPosition: pos, maskPosition: pos,
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        }} />}
        {extra}
      </div>
    )
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    from.current = { x: e.clientX, turn }; setDrag(true)
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const f = from.current; if (!f) return
    setTurn(f.turn + (e.clientX - f.x) * 0.5)
  }
  const up = () => { from.current = null; setDrag(false) }
  // Buttons go the short way round from wherever it is now.
  const go = (to: number) => setTurn(cur => cur + ((((to - cur) % 360) + 540) % 360) - 180)

  return (
    <div className="sb" ref={wrap}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`sb-stage${drag ? ' is-drag' : ''}`} onPointerDown={down} onPointerMove={move}
           onPointerUp={up} onPointerCancel={up}
           role="img" aria-label={label}
           style={{ height: H + 110 }}>
        <div className="sb-floor" style={{ width: W * 1.5, height: D * 0.9, marginLeft: -W * 0.75, top: `calc(50% + ${H / 2 - D * 0.45 + 10}px)` }} />
        <div className="sb-box" style={{ transform: `rotateX(-14deg) rotateY(${turn}deg)` }}>
          {face(faces.front, W, `translateZ(${D / 2}px)`, 0)}
          {face(faces.endR, D, `rotateY(90deg) translateZ(${W / 2}px)`, 0.22)}
          {face(faces.back, W, `rotateY(180deg) translateZ(${D / 2}px)`, 0.08, onBack)}
          {face(faces.endL, D, `rotateY(-90deg) translateZ(${W / 2}px)`, 0.3)}
        </div>
      </div>
      <div className="sb-turns">
        {turns.map(b => (
          <button key={b.label} onClick={() => go(b.to)} className={b.gold ? 'is-gold' : undefined}>{b.label}</button>
        ))}
        <span>{hint}</span>
      </div>
    </div>
  )
}

const CSS = `
.sb-stage { position: relative; perspective: 1400px; cursor: grab; touch-action: pan-y; user-select: none;
            background: radial-gradient(ellipse at 50% 60%, rgba(229,212,194,.07), rgba(229,212,194,0) 62%); }
.sb-stage.is-drag { cursor: grabbing; }
.sb-box { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform-style: preserve-3d;
          transition: transform 1.3s cubic-bezier(.2,.8,.2,1); }
.sb-stage.is-drag .sb-box { transition: none; }
.sb-face { position: absolute; left: 0; top: 0; background-repeat: no-repeat; backface-visibility: hidden;
           -webkit-backface-visibility: hidden; }
/* Light from the front-left: the ends sit in a little shade, so the box reads
   as a solid and not as four pictures standing in a square. The shade is
   masked by the face's own artwork (set inline), so the sloping tops stay
   transparent instead of turning into black corners. */
.sb-shade { position: absolute; inset: 0; background: #000; pointer-events: none; }
.sb-logo { position: absolute; object-fit: contain; pointer-events: none; }
.sb-floor { position: absolute; left: 50%; border-radius: 50%; pointer-events: none;
            background: radial-gradient(ellipse, rgba(0,0,0,.55), rgba(0,0,0,0) 70%); }
.sb-turns { display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: baseline; margin-top: 8px; }
.sb-turns button { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: ${MONO};
                   font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: rgba(229,212,194,.6);
                   border-bottom: 1px solid transparent; }
.sb-turns button:hover { color: #E5D4C2; border-bottom-color: rgba(229,212,194,.4); }
.sb-turns button.is-gold { color: ${GOLD}; }
.sb-turns span { font-family: ${MONO}; font-size: 11px; color: rgba(229,212,194,.4); }
@media (prefers-reduced-motion: reduce) { .sb-box { transition: none; } }
`
