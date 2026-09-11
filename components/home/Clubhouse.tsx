'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE CLUBHOUSE — the building, floor by floor, and every floor opens.
// ───────────────────────────────────────────────────────────────────────────
// Six hand-drawn cross-sections (the owner's "RAMPANT CLUB FILE" — the lab,
// the Rampant Room, the dining room, the studio, the library bar and the
// entrance), rendered from their SVGs and cropped to one shared frame so the
// walls line up when they stack. The cream is baked into the images (white ×
// #E5D4C2), so they sit on the page like ink on paper — a CSS blend was tried
// and broke wherever a floor lifted (lifting isolates the blend).
//
// The floors settle onto one another from the street up as the section
// arrives. Point at one and the rest fall back. Click and that floor draws
// OUT of the building, in place — wider, pushing the floors below down — and
// its card fills in with what happens there and the way in. Click it again,
// press Esc, or choose another floor to close it.
//
// (It used to zoom into a full-screen view. The owner found that distorted,
// so it now extends a little out of the building instead.)
//
// The bottom floor is Floor B — the entrance at 74A/2 Hai Bà Trưng. It is
// drawn and numbered, but has no page of its own, so it does not open.

const FLOORS = [
  { num: '05', id: 'lab',          name: 'Source & Origin Lab', vn: 'Phòng Thí Nghiệm',
    desc: 'Our in-house culinary innovation lab, bringing cutting-edge beverage experiences exclusively to members.' },
  { num: '04', id: 'rampant-room', name: 'The Rampant Room',    vn: 'Phòng Rampant',
    desc: 'A world-class bottle-share room of global whiskies, enjoyed at your leisure with guests and fellow members. Private lockers available.' },
  { num: '03', id: 'dining',       name: 'The Dining Room',     vn: 'Phòng Ăn Riêng',
    desc: 'The ultimate discreet city-centre room for meetings, birthday soirées, private dinners, and intimate gatherings.' },
  { num: '02', id: 'studio',       name: 'The Studio',          vn: 'Phòng Nghệ Thuật',
    desc: 'A quarterly rotating, curated sensory art space — interact with, touch, hear, taste, and smell immersive installations.' },
  { num: '01', id: 'library-bar',  name: 'The Library Bar',     vn: 'Quầy Bar Thư Viện',
    desc: 'Your private cocktail bar. Seasonal cocktails, vintage spirits, curated books and games, with resident musicians and DJs.' },
]
const small = (id: string) => `/images/clubhouse/${id}-1300.webp`
const large = (id: string) => `/images/clubhouse/${id}-2530.webp`

export default function Clubhouse() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const rows = useRef<Record<string, HTMLDivElement | null>>({})
  // The opened floor is shown bigger, so it swaps to the sharp drawing — but
  // only once that has loaded, so the swap never flickers.
  const [sharp, setSharp] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!open || sharp[open]) return
    const im = new Image()
    im.onload = () => setSharp(s => ({ ...s, [open]: true }))
    im.src = large(open)
  }, [open, sharp])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: .06 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('keydown', onKey)
    // keep the opened floor in view as it grows
    const row = rows.current[open]
    const t = setTimeout(() => {
      const r = row?.getBoundingClientRect()
      if (r && (r.top < 70 || r.bottom > innerHeight)) row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 420)
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [open])

  const toggle = (id: string) => setOpen(o => (o === id ? null : id))
  const focus = open ?? hover

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
        .ch-cta span, .ch-go { display: inline-block; transition: transform .35s ease; }
        .ch-cta:hover span { transform: translateX(7px); }
        .ch-hint { display: none; font-family: 'Google Sans Code', monospace; font-size: 11.5px; opacity: .6; margin: 18px 0 0; }

        /* ── the building ── */
        .ch-building { margin-top: 56px; }
        .ch-row { display: grid; grid-template-columns: minmax(0, 500px) 1fr; gap: 56px; align-items: center;
                  transition: grid-template-columns .6s cubic-bezier(.16,.84,.44,1), margin .6s cubic-bezier(.16,.84,.44,1); }
        /* the opened floor draws out of the building */
        .ch-row.is-open { grid-template-columns: minmax(0, 700px) 1fr; gap: 44px; margin: 18px 0; }
        .ch-card.is-open .ch-head { grid-template-columns: 74px 1fr; }
        .ch-card.is-open .ch-no { font-size: 52px; }
        .ch-card.is-open .ch-name { font-size: 30px; }
        .ch-card.is-open .ch-more { margin-left: 92px; }
        .ch-strip { all: unset; box-sizing: border-box; display: block; position: relative; width: 100%;
                    aspect-ratio: 2530 / 846; cursor: pointer;
                    opacity: 0; transform: translateY(-46px);
                    transition: opacity .45s ease, filter .45s ease, transform .5s cubic-bezier(.16,.84,.44,1), box-shadow .5s ease; }
        .ch-strip img { display: block; width: 100%; height: 100%; pointer-events: none; }
        .ch.is-in .ch-strip { opacity: 1; transform: none; }
        .ch-strip:focus-visible { outline: 2px solid #8A6A1F; outline-offset: 4px; }
        .ch-building.has-focus .ch-strip:not(.is-on) { opacity: .42; filter: saturate(.6); }
        .ch-strip.is-on { transform: scale(1.012); box-shadow: 0 18px 40px rgba(5,46,32,.16); z-index: 2; }
        .ch-row.is-open .ch-strip { transform: none; box-shadow: 0 26px 60px rgba(5,46,32,.22); }
        .ch-strip.is-ground { cursor: default; }

        .ch-card { opacity: 0; transform: translateX(-10px); transition: opacity .5s ease, transform .6s cubic-bezier(.16,.84,.44,1); }
        .ch.is-in .ch-card { opacity: 1; transform: none; }
        .ch-building.has-focus .ch-card:not(.is-on) { opacity: .35; }
        .ch-head { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 92px 1fr; gap: 18px; align-items: baseline; cursor: pointer; }
        .ch-no { font-family: 'Rampant Sans', serif; font-size: 62px; line-height: .9; }
        .ch-name { font-family: 'Rampant Sans', serif; font-size: 36px; line-height: 1.02; }
        .ch-vn { font-family: 'Google Sans Code', monospace; font-size: 12.5px; opacity: .62; margin-top: 7px; }
        .ch-look { font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .08em; margin-top: 12px;
                   opacity: 0; transition: opacity .3s ease; }
        .ch-card.is-on:not(.is-open) .ch-look { opacity: 1; }
        .ch-card.is-open .ch-look { display: none; }
        /* what the opened floor says */
        .ch-more { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .6s cubic-bezier(.16,.84,.44,1); margin-left: 110px; }
        .ch-card.is-open .ch-more { grid-template-rows: 1fr; }
        .ch-more > div { overflow: hidden; }
        .ch-desc { font-family: 'Google Sans Code', monospace; font-size: 13px; line-height: 1.85; max-width: 44ch; margin: 14px 0 0; }
        .ch-foot { display: flex; align-items: center; gap: 18px; margin-top: 18px; padding-bottom: 4px; }
        .ch-step { color: var(--trc-green-deep); text-decoration: none; border-bottom: 1px solid var(--trc-green-deep); padding-bottom: 5px;
                   font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
        .ch-step:hover .ch-go { transform: translateX(7px); }
        .ch-lion { width: 44px; height: auto; transform: rotate(-4deg); }

        @media (max-width: 1100px) {
          .ch-row { grid-template-columns: minmax(0, 440px) 1fr; gap: 40px; }
          .ch-row.is-open { grid-template-columns: minmax(0, 600px) 1fr; }
          .ch-no { font-size: 52px; } .ch-name { font-size: 30px; }
          .ch-head { grid-template-columns: 76px 1fr; } .ch-more { margin-left: 94px; }
        }
        @media (max-width: 860px) {
          .ch { padding: 84px 20px 90px; }
          .ch-building { margin-top: 30px; }
          .ch-row, .ch-row.is-open { grid-template-columns: 1fr; gap: 0; }
          /* on a phone the opened floor runs to the screen's edges, its card beneath */
          .ch-row.is-open { margin: 14px -20px 18px; }
          .ch-card { display: none; }
          .ch-card.is-open { display: block; padding: 16px 20px 6px; }
          .ch-head { grid-template-columns: 58px 1fr; gap: 12px; }
          .ch-no { font-size: 40px; } .ch-name { font-size: 24px; }
          .ch-more, .ch-card.is-open .ch-more { margin-left: 0; }
          .ch-card.is-open .ch-head { grid-template-columns: 58px 1fr; }
          .ch-card.is-open .ch-no { font-size: 40px; }
          .ch-card.is-open .ch-name { font-size: 24px; }
          .ch-hint { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ch-rise, .ch.is-in .ch-rise { opacity: 1; transform: none; animation: none; }
          .ch-row, .ch-strip, .ch-card, .ch-more { transition: none; }
          .ch-strip, .ch-card { opacity: 1; transform: none; }
        }
      ` }} />

      <h2 className="ch-title ch-rise" style={{ animationDelay: '.1s' }}>Hai Bà Trưng Clubhouse</h2>
      <Link href="/spaces" className="ch-cta ch-rise" style={{ animationDelay: '.16s' }}>Explore the spaces <span>→</span></Link>
      <p className="ch-hint ch-rise" style={{ animationDelay: '.2s' }}>Tap a floor to look inside.</p>

      <div className={`ch-building ${focus ? 'has-focus' : ''}`} onMouseLeave={() => setHover(null)}>
        {FLOORS.map((f, i) => {
          const on = focus === f.id
          const isOpen = open === f.id
          // settle from the street up: the lowest floor lands first
          const delay = visible && !focus ? `${0.15 + (FLOORS.length - i) * 0.12}s` : '0s'
          return (
            <div key={f.id} ref={el => { rows.current[f.id] = el }} className={`ch-row ${isOpen ? 'is-open' : ''}`}>
              <button type="button" className={`ch-strip ${on ? 'is-on' : ''}`} style={{ transitionDelay: delay }}
                      aria-expanded={isOpen} aria-controls={`ch-more-${f.id}`} aria-label={`${f.name} — look inside`}
                      onMouseEnter={() => setHover(f.id)} onFocus={() => setHover(f.id)} onBlur={() => setHover(null)}
                      onClick={() => toggle(f.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sharp[f.id] ? large(f.id) : small(f.id)} alt="" loading="lazy" />
              </button>
              <div className={`ch-card ${on ? 'is-on' : ''} ${isOpen ? 'is-open' : ''}`} style={{ transitionDelay: delay }}
                   onMouseEnter={() => setHover(f.id)}>
                <button type="button" className="ch-head" tabIndex={-1} aria-hidden="true" onClick={() => toggle(f.id)}>
                  <div className="ch-no">{f.num}</div>
                  <div>
                    <div className="ch-name">{f.name}</div>
                    <div className="ch-vn">{f.vn}</div>
                    <div className="ch-look">Step inside →</div>
                  </div>
                </button>
                <div className="ch-more" id={`ch-more-${f.id}`} aria-hidden={!isOpen}>
                  <div>
                    <p className="ch-desc">{f.desc}</p>
                    <div className="ch-foot">
                      <Link href={`/spaces#${f.id}`} className="ch-step" tabIndex={isOpen ? 0 : -1}>Step inside <span className="ch-go">→</span></Link>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/images/ink/floor-${f.id}.webp`} alt="" aria-hidden="true" className="ch-lion" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {/* Floor B: the entrance. Drawn and numbered, but no page of its own. */}
        <div className="ch-row">
          <div className="ch-strip is-ground" style={{ transitionDelay: visible && !focus ? '.12s' : '0s' }} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={small('entrance')} alt="" loading="lazy" />
          </div>
          <div className="ch-card" style={{ transitionDelay: visible && !focus ? '.12s' : '0s' }}>
            <div className="ch-head" style={{ cursor: 'default' }}>
              <div className="ch-no">B</div>
              <div><div className="ch-name">74A/2 Hai Bà Trưng</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
