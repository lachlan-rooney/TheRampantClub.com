'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE CLUBHOUSE — the building, floor by floor, and every floor opens.
// ───────────────────────────────────────────────────────────────────────────
// Six hand-drawn cross-sections (the owner's "RAMPANT CLUB FILE" — the lab,
// the Rampant Room, the dining room, the studio, the library bar and the
// entrance), rendered from their SVGs and cropped to one shared frame so the
// walls line up when they stack. The cream is baked into the images (white ×
// #E5D4C2), so they sit on the page like ink on paper — a CSS blend was tried
// and broke wherever a floor lifted or zoomed (those isolate the blend).
//
// The floors settle onto one another from the street up as the section
// arrives. Point at one and the rest fall back; click and it zooms up out of
// the building into a full view — the whole drawing, its lion, what happens
// there, and the way in. ↑/↓ walk the stairs, Esc steps back out. On a phone
// the zoomed drawing is wider than the screen, so you swipe along the room.
//
// The entrance is the ground the building stands on, not a room with its own
// page, so it is drawn but does not open.

const FLOORS = [
  { num: 5, id: 'lab',          name: 'Source & Origin Lab', vn: 'Phòng Thí Nghiệm',
    desc: 'Our in-house culinary innovation lab, bringing cutting-edge beverage experiences exclusively to members.' },
  { num: 4, id: 'rampant-room', name: 'The Rampant Room',    vn: 'Phòng Rampant',
    desc: 'A world-class bottle-share room of global whiskies, enjoyed at your leisure with guests and fellow members. Private lockers available.' },
  { num: 3, id: 'dining',       name: 'The Dining Room',     vn: 'Phòng Ăn Riêng',
    desc: 'The ultimate discreet city-centre room for meetings, birthday soirées, private dinners, and intimate gatherings.' },
  { num: 2, id: 'studio',       name: 'The Studio',          vn: 'Phòng Nghệ Thuật',
    desc: 'A quarterly rotating, curated sensory art space — interact with, touch, hear, taste, and smell immersive installations.' },
  { num: 1, id: 'library-bar',  name: 'The Library Bar',     vn: 'Quầy Bar Thư Viện',
    desc: 'Your private cocktail bar. Seasonal cocktails, vintage spirits, curated books and games, with resident musicians and DJs.' },
]
const small = (id: string) => `/images/clubhouse/${id}-1300.webp`
const large = (id: string) => `/images/clubhouse/${id}-2530.webp`
// Fetch the big drawing the moment a floor is pointed at, so the zoom lands
// on full detail rather than a blur that sharpens.
const warmed = new Set<string>()
const warm = (id: string) => {
  if (typeof window === 'undefined' || warmed.has(id)) return
  warmed.add(id); const im = new Image(); im.src = large(id)
}

export default function Clubhouse() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)          // index into FLOORS
  const [origin, setOrigin] = useState<DOMRect | null>(null)     // where the zoom starts
  const strips = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: .06 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const openFloor = (i: number) => {
    setOrigin(strips.current[i]?.getBoundingClientRect() ?? null)
    setOpen(i)
  }
  const close = useCallback(() => setOpen(null), [])
  const step = useCallback((d: number) => {
    setOrigin(null)
    setOpen(i => i === null ? null : Math.min(FLOORS.length - 1, Math.max(0, i + d)))
  }, [])

  return (
    <section ref={ref} className={`ch ${visible ? 'is-in' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ch { max-width: 1180px; margin: 0 auto; padding: 120px 24px 120px; color: var(--trc-green-deep); }
        .ch-rise { opacity: 0; transform: translateY(22px); }
        .ch.is-in .ch-rise { animation: ch-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes ch-rise { to { opacity: 1; transform: none } }
        .ch-title { font-family: 'Rampant Sans', serif; font-weight: 400; font-size: clamp(44px, 7.4vw, 92px); line-height: .98; margin: 0; }
        .ch-cta { display: inline-block; margin-top: 24px; color: var(--trc-green-deep); text-decoration: none;
                  font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
                  border-bottom: 1px solid var(--trc-green-deep); padding-bottom: 6px; }
        .ch-cta span { display: inline-block; transition: transform .35s ease; }
        .ch-cta:hover span { transform: translateX(7px); }
        .ch-hint { display: none; font-family: 'Google Sans Code', monospace; font-size: 11.5px; opacity: .6; margin: 18px 0 0; }

        /* ── the building ── */
        .ch-building { margin-top: 56px; }
        .ch-row { display: grid; grid-template-columns: minmax(0, 500px) 1fr; gap: 56px; align-items: center; }
        .ch-strip { all: unset; box-sizing: border-box; display: block; position: relative; width: 100%;
                    aspect-ratio: 2530 / 846; cursor: zoom-in;
                    opacity: 0; transform: translateY(-46px);
                    transition: opacity .45s ease, filter .45s ease, transform .5s cubic-bezier(.16,.84,.44,1), box-shadow .5s ease; }
        .ch-strip img { display: block; width: 100%; height: 100%; pointer-events: none; }
        .ch.is-in .ch-strip { opacity: 1; transform: none; }
        .ch-strip:focus-visible { outline: 2px solid #8A6A1F; outline-offset: 4px; }
        .ch-building.has-hover .ch-strip:not(.is-on) { opacity: .42; filter: saturate(.6); }
        .ch-strip.is-on { transform: scale(1.012); box-shadow: 0 18px 40px rgba(5,46,32,.16); z-index: 2; }
        .ch-strip.is-ground { cursor: default; }

        .ch-label { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 92px 1fr; gap: 18px; align-items: baseline;
                    cursor: pointer; opacity: 0; transform: translateX(-10px);
                    transition: opacity .5s ease, transform .6s cubic-bezier(.16,.84,.44,1); }
        .ch.is-in .ch-label { opacity: 1; transform: none; }
        .ch-building.has-hover .ch-label:not(.is-on) { opacity: .35; }
        .ch-no { font-family: 'Rampant Sans', serif; font-size: 62px; line-height: .9; }
        .ch-name { font-family: 'Rampant Sans', serif; font-size: 36px; line-height: 1.02; }
        .ch-vn { font-family: 'Google Sans Code', monospace; font-size: 12.5px; opacity: .62; margin-top: 7px; }
        .ch-look { font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .08em; margin-top: 12px;
                   opacity: 0; transition: opacity .3s ease; }
        .ch-label.is-on .ch-look { opacity: 1; }
        .ch-street { font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; opacity: .55; }

        @media (max-width: 1100px) {
          .ch-row { grid-template-columns: minmax(0, 440px) 1fr; gap: 40px; }
          .ch-no { font-size: 52px; } .ch-name { font-size: 30px; }
        }
        @media (max-width: 860px) {
          .ch { padding: 84px 20px 90px; }
          .ch-building { margin-top: 30px; }
          .ch-row { grid-template-columns: 1fr; gap: 0; }
          .ch-label, .ch-street { display: none; }
          .ch-hint { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ch-rise, .ch.is-in .ch-rise { opacity: 1; transform: none; animation: none; }
          .ch-strip, .ch-label { transition: none; opacity: 1; transform: none; }
        }
      ` }} />

      <h2 className="ch-title ch-rise" style={{ animationDelay: '.1s' }}>Hai Bà Trưng Clubhouse</h2>
      <Link href="/spaces" className="ch-cta ch-rise" style={{ animationDelay: '.16s' }}>Explore the spaces <span>→</span></Link>
      <p className="ch-hint ch-rise" style={{ animationDelay: '.2s' }}>Tap a floor to look inside.</p>

      <div className={`ch-building ${hover ? 'has-hover' : ''}`} onMouseLeave={() => setHover(null)}>
        {FLOORS.map((f, i) => {
          const on = hover === f.id
          // settle from the street up: the lowest floor lands first
          const delay = `${0.15 + (FLOORS.length - i) * 0.12}s`
          return (
            <div key={f.id} className="ch-row">
              <button ref={el => { strips.current[i] = el }} type="button"
                      className={`ch-strip ${on ? 'is-on' : ''}`} style={{ transitionDelay: visible && !hover ? delay : '0s' }}
                      aria-label={`${f.name} — look inside`}
                      onMouseEnter={() => { setHover(f.id); warm(f.id) }} onFocus={() => { setHover(f.id); warm(f.id) }} onBlur={() => setHover(null)}
                      onTouchStart={() => warm(f.id)}
                      onClick={() => openFloor(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={small(f.id)} alt="" loading="lazy" />
              </button>
              <button type="button" className={`ch-label ${on ? 'is-on' : ''}`} tabIndex={-1} aria-hidden="true"
                      style={{ transitionDelay: visible && !hover ? delay : '0s' }}
                      onMouseEnter={() => { setHover(f.id); warm(f.id) }} onClick={() => openFloor(i)}>
                <div className="ch-no">{String(f.num).padStart(2, '0')}</div>
                <div>
                  <div className="ch-name">{f.name}</div>
                  <div className="ch-vn">{f.vn}</div>
                  <div className="ch-look">Step inside →</div>
                </div>
              </button>
            </div>
          )
        })}
        {/* the ground floor: drawn, not a room with its own page */}
        <div className="ch-row">
          <div className="ch-strip is-ground" style={{ transitionDelay: visible ? '.12s' : '0s' }} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={small('entrance')} alt="" loading="lazy" />
          </div>
          <div className="ch-street">74A/2 Hai Bà Trưng</div>
        </div>
      </div>

      {open !== null && <FloorViewer index={open} origin={origin} onClose={close} onStep={step} />}
    </section>
  )
}

// ── The zoomed floor ──────────────────────────────────────────────────────
function FloorViewer({ index, origin, onClose, onStep }: {
  index: number; origin: DOMRect | null; onClose: () => void; onStep: (d: number) => void
}) {
  const f = FLOORS[index]
  const pic = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const close = useCallback(() => { setLeaving(true); setTimeout(onClose, 380) }, [onClose])

  // Zoom from where the floor sat in the building to where it sits now (FLIP).
  useEffect(() => {
    const el = pic.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (el && origin && !reduce) {
      const to = el.getBoundingClientRect()
      const sx = origin.width / to.width
      el.style.transition = 'none'
      el.style.transformOrigin = '0 0'
      el.style.transform = `translate(${origin.left - to.left}px, ${origin.top - to.top}px) scale(${sx})`
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = 'transform .7s cubic-bezier(.16,.84,.44,1)'
        el.style.transform = 'none'
      }))
    }
    const t = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(t)
  }, [origin, index])

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    closeBtn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowUp') { e.preventDefault(); onStep(-1) }
      if (e.key === 'ArrowDown') { e.preventDefault(); onStep(1) }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [close, onStep])

  const above = index > 0 ? FLOORS[index - 1] : null
  const below = index < FLOORS.length - 1 ? FLOORS[index + 1] : null

  return (
    <div className={`fv ${shown && !leaving ? 'is-in' : ''}`} role="dialog" aria-modal="true" aria-label={f.name} onClick={close}>
      <style dangerouslySetInnerHTML={{ __html: `
        .fv { position: fixed; inset: 0; z-index: 99990; overflow-y: auto; overscroll-behavior: contain;
              background: rgba(229,212,194,0); transition: background .45s ease; color: #052E20; }
        .fv.is-in { background: rgba(229,212,194,.97); }
        .fv-inner { max-width: 1400px; margin: 0 auto; padding: 84px 24px 64px; }
        .fv-top { display: flex; justify-content: space-between; align-items: center; gap: 16px;
                  font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
                  opacity: 0; transition: opacity .4s ease .15s; }
        .fv.is-in .fv-top, .fv.is-in .fv-words { opacity: 1; }
        .fv-btn { all: unset; cursor: pointer; padding: 6px 0; }
        .fv-btn:focus-visible { outline: 2px solid #8A6A1F; outline-offset: 4px; }
        .fv-btn[disabled] { opacity: .3; cursor: default; }
        .fv-steps { display: flex; gap: 22px; flex-wrap: wrap; }
        .fv-pic { margin-top: 22px; aspect-ratio: 2530 / 846; will-change: transform; }
        .fv-pic img { display: block; width: 100%; height: 100%; }
        .fv-swipe { display: none; font-family: 'Google Sans Code', monospace; font-size: 11px; opacity: .55; margin: 10px 20px 0; }
        .fv-words { display: grid; grid-template-columns: auto 1fr auto; gap: 28px; align-items: start; margin-top: 34px;
                    opacity: 0; transition: opacity .5s ease .3s; }
        .fv-no { font-family: 'Rampant Sans', serif; font-size: clamp(56px, 7vw, 96px); line-height: .85; }
        .fv-name { font-family: 'Rampant Sans', serif; font-size: clamp(32px, 4.4vw, 56px); line-height: 1; }
        .fv-vn { font-family: 'Google Sans Code', monospace; font-size: 12px; opacity: .6; margin-top: 8px; }
        .fv-desc { font-family: 'Google Sans Code', monospace; font-size: 14px; line-height: 2; max-width: 56ch; margin: 18px 0 0; }
        .fv-cta { display: inline-block; margin-top: 22px; color: #052E20; text-decoration: none; border-bottom: 1px solid #052E20;
                  padding-bottom: 6px; font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
        .fv-cta span { display: inline-block; transition: transform .35s ease; }
        .fv-cta:hover span { transform: translateX(7px); }
        .fv-lion { width: clamp(64px, 7vw, 96px); height: auto; transform: rotate(-4deg); }
        @media (max-width: 860px) {
          .fv-inner { padding: 72px 0 48px; }
          .fv-top, .fv-words { padding: 0 20px; }
          /* wider than the screen: swipe along the room */
          .fv-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 20px; }
          .fv-scroll::-webkit-scrollbar { display: none; }
          .fv-pic { width: 220vw; max-width: none; }
          .fv-swipe { display: block; }
          .fv-words { grid-template-columns: 1fr auto; }
          .fv-no { grid-column: 1 / -1; }
        }
        @media (prefers-reduced-motion: reduce) { .fv, .fv-top, .fv-words { transition: none; } }
      ` }} />
      <div className="fv-inner" onClick={e => e.stopPropagation()}>
        <div className="fv-top">
          <div className="fv-steps">
            <button type="button" className="fv-btn" disabled={!above} onClick={() => onStep(-1)}>
              ↑ {above ? above.name : 'Top floor'}
            </button>
            <button type="button" className="fv-btn" disabled={!below} onClick={() => onStep(1)}>
              ↓ {below ? below.name : 'Ground floor'}
            </button>
          </div>
          <button ref={closeBtn} type="button" className="fv-btn" onClick={close}>Close ×</button>
        </div>

        <div className="fv-scroll">
          <div ref={pic} className="fv-pic" key={f.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={large(f.id)} alt={`${f.name}, drawn in section`} />
          </div>
        </div>
        <p className="fv-swipe">Swipe along the room →</p>

        <div className="fv-words" key={`${f.id}-w`}>
          <div className="fv-no">{String(f.num).padStart(2, '0')}</div>
          <div>
            <div className="fv-name">{f.name}</div>
            <div className="fv-vn">{f.vn}</div>
            <p className="fv-desc">{f.desc}</p>
            <Link href={`/spaces#${f.id}`} className="fv-cta">Step inside <span>→</span></Link>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/images/ink/floor-${f.id}.webp`} alt="" aria-hidden="true" className="fv-lion" />
        </div>
      </div>
    </div>
  )
}
