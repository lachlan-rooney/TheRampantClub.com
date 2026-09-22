'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { MONO, GOLD } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE SLEEVE, FOLDED — the same artwork, made into the box it becomes.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "add a second clickable version of the customisable" —
// the flat dieline answers "where does my logo go"; this answers "what will
// they be holding".
//
// THE FOLDS WERE MEASURED FROM THE ARTWORK'S OUTLINE, column by column (the
// top edge of the opaque pixels in sleeve-3200.webp, scaled to the 6431 px
// master). It is a box with a sloping top:
//
//   x   32 – 490   a flap at the short height — it tucks inside, not shown
//   x  490 – 1780  END (warnings, barcode): top slopes UP from 613 to 16
//   x 1780 – 3453  FRONT (Chợ Bến Thành): full height, 16 – 2377
//   x 3453 – 4770  END (Duncan Taylor): top slopes DOWN from 16 to 611
//   x 4770 – 6415  THE BLANK FACE: 611 – 2343 — where the logo goes
//
// The two ends are the same depth (1290 and 1317) and the front and the blank
// face the same width (1673 and 1645), which is what says this reading of the
// folds is right: opposite faces of a box must match. Each face is drawn at
// the pair's average, so none is stretched by more than 2%.
//
// Every face shares one vertical frame (y 16 to 2377), so the short faces keep
// their transparent upper part and the sloping ends meet them exactly — the
// shape of the box comes out of the artwork, not out of this file.
//
// Drag to turn it, or use the buttons. It is a picture of the box, not the
// print proof: the flat view is where the logo is placed.
// ═══════════════════════════════════════════════════════════════════════════

const ART = { w: 6431, h: 2387, top: 16, bottom: 2377 }
const FACES = {
  endL:  { x: 490,  w: 1290 },
  front: { x: 1780, w: 1673 },
  endR:  { x: 3453, w: 1317 },
  back:  { x: 4770, w: 1645 },
}
const WIDE = (FACES.front.w + FACES.back.w) / 2
const DEEP = (FACES.endL.w + FACES.endR.w) / 2
const TALL = ART.bottom - ART.top

type Box = { x: number; y: number; w: number; h: number }

export default function SleeveBox({ logo, box, t }: {
  logo: string | null
  box: Box | null
  t: (en: string, vn: string) => string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(240)            // the box's width on screen
  const [turn, setTurn] = useState(-28)
  const [drag, setDrag] = useState(false)
  const from = useRef<{ x: number; turn: number } | null>(null)

  // Sized to its container, so a phone gets a smaller box, not a clipped one.
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const fit = () => setPx(Math.max(150, Math.min(260, el.clientWidth * 0.34)))
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // It arrives turning to the face with the logo — the point of the view.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTurn(200); return }
    const id = setTimeout(() => setTurn(200), 350)
    return () => clearTimeout(id)
  }, [])

  const k = px / WIDE
  const W = WIDE * k, D = DEEP * k, H = TALL * k
  const url = '/images/tet/sleeve-3200.webp'

  // One face: its slice of the artwork, stretched to the box's width for it.
  const face = (f: { x: number; w: number }, width: number, transform: string, shade: number, extra?: ReactNode) => {
    const sx = width / f.w
    const size = `${ART.w * sx}px ${ART.h * k}px`, pos = `${-f.x * sx}px ${-ART.top * k}px`
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

  const logoOnBack = logo && box ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="sb-logo" style={{
      left: `${((box.x - FACES.back.x) / FACES.back.w) * 100}%`,
      top: `${((box.y - ART.top) / TALL) * 100}%`,
      width: `${(box.w / FACES.back.w) * 100}%`,
      height: `${(box.h / TALL) * 100}%`,
    }} />
  ) : null

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
           role="img" aria-label={t('The sleeve folded into its box — drag to turn it', 'Hộp đã gấp — kéo để xoay')}
           style={{ height: H + 110 }}>
        <div className="sb-floor" style={{ width: W * 1.5, height: D * 0.9, marginLeft: -W * 0.75, top: `calc(50% + ${H / 2 - D * 0.45 + 10}px)` }} />
        <div className="sb-box" style={{ transform: `rotateX(-14deg) rotateY(${turn}deg)` }}>
          {face(FACES.front, W, `translateZ(${D / 2}px)`, 0)}
          {face(FACES.endR, D, `rotateY(90deg) translateZ(${W / 2}px)`, 0.22)}
          {face(FACES.back, W, `rotateY(180deg) translateZ(${D / 2}px)`, 0.08, logoOnBack)}
          {face(FACES.endL, D, `rotateY(-90deg) translateZ(${W / 2}px)`, 0.3)}
        </div>
      </div>
      <div className="sb-turns">
        <button onClick={() => go(0)}>{t('Chợ Bến Thành', 'Chợ Bến Thành')}</button>
        <button onClick={() => go(-90)}>{t('Duncan Taylor end', 'Mặt Duncan Taylor')}</button>
        <button onClick={() => go(180)} className="is-gold">{t('Your face', 'Mặt của quý vị')}</button>
        <button onClick={() => go(90)}>{t('Back end', 'Mặt sau')}</button>
        <span>{t('or drag to turn it', 'hoặc kéo để xoay')}</span>
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
