'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE CLUBHOUSE — five floors, and the building answers when you point.
// ───────────────────────────────────────────────────────────────────────────
// INTERIM. The owner is having the building redrawn as a stack of separate
// SVGs that can each be clicked and zoomed into; this is the bridge until then.
// It already behaves the way that will: hover (or tap) a floor and that floor
// lights on the drawing while the rest fall back.
//
// It was a faint list of small type beside the drawing — and on a phone the
// list was hidden outright, so a phone saw the picture and nothing else.
//
// BANDS are measured against /images/Club Map.svg (percent of its height).
// When the drawing changes, re-measure them — they describe that picture.

const FLOORS = [
  { num: 5, id: 'lab',          name: 'Source & Origin Lab', vn: 'Phòng Thí Nghiệm', band: [16, 29.5],
    desc: 'Our in-house culinary innovation lab, bringing cutting-edge beverage experiences exclusively to members.' },
  { num: 4, id: 'rampant-room', name: 'The Rampant Room',    vn: 'Phòng Rampant',    band: [29.5, 41.5],
    desc: 'A world-class bottle-share room of global whiskies, enjoyed at your leisure with guests and fellow members. Private lockers available.' },
  { num: 3, id: 'dining',       name: 'The Dining Room',     vn: 'Phòng Ăn Riêng',   band: [41.5, 55],
    desc: 'The ultimate discreet city-centre room for meetings, birthday soirées, private dinners, and intimate gatherings.' },
  { num: 2, id: 'studio',       name: 'The Studio',          vn: 'Phòng Nghệ Thuật', band: [55, 67.5],
    desc: 'A quarterly rotating, curated sensory art space — interact with, touch, hear, taste, and smell immersive installations.' },
  { num: 1, id: 'library-bar',  name: 'The Library Bar',     vn: 'Quầy Bar Thư Viện', band: [67.5, 80.5],
    desc: 'Your private cocktail bar. Seasonal cocktails, vintage spirits, curated books and games, with resident musicians and DJs.' },
]
// Everything that is not a floor — the roof above, the entrance below.
const ROOF: [number, number] = [0, 16]
const STREET: [number, number] = [80.5, 100]

export default function Clubhouse() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: .08 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // No hover on a touch screen, and a tap follows the link — so there the
  // floor in the middle of the screen is the one that lights, as you scroll.
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(hover: none)').matches || !list.current) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.floor || null) })
    }, { rootMargin: '-45% 0px -45% 0px' })
    list.current.querySelectorAll('[data-floor]').forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [])

  const veil = (band: [number, number], lit: boolean, key: string) => (
    <div key={key} className="ch-veil" style={{ top: `${band[0]}%`, height: `${band[1] - band[0]}%`, opacity: active && !lit ? 1 : 0 }} />
  )

  return (
    <section ref={ref} className={`ch ${visible ? 'is-in' : ''}`} onMouseLeave={() => setActive(null)}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ch { max-width: 1180px; margin: 0 auto; padding: 120px 24px 120px; color: var(--trc-green-deep); }
        .ch-rise { opacity: 0; transform: translateY(22px); }
        .ch.is-in .ch-rise { animation: ch-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes ch-rise { to { opacity: 1; transform: none } }
        .ch-eyebrow { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 10.5px; letter-spacing: .22em;
                      text-transform: uppercase; opacity: .6; }
        .ch-title { font-family: 'Rampant Sans', serif; font-weight: 400; font-size: clamp(44px, 7.4vw, 92px); line-height: .98; margin: 16px 0 0; }
        .ch-cta { display: inline-block; margin-top: 24px; color: var(--trc-green-deep); text-decoration: none;
                  font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
                  border-bottom: 1px solid var(--trc-green-deep); padding-bottom: 6px; }
        .ch-cta span, .ch-go { display: inline-block; transition: transform .35s ease; }
        .ch-cta:hover span { transform: translateX(7px); }

        .ch-grid { display: grid; grid-template-columns: minmax(0, 420px) 1fr; gap: 72px; margin-top: 56px; align-items: start; }
        .ch-building { position: sticky; top: 90px; }
        .ch-building img { display: block; width: 100%; height: auto; }
        /* the veil falls over every floor but the one you point at */
        .ch-veil { position: absolute; left: 0; right: 0; background: rgba(229,212,194,.66);
                   transition: opacity .45s ease; pointer-events: none; }

        .ch-floor { display: grid; grid-template-columns: 64px 1fr 64px; gap: 18px; align-items: start;
                    padding: 20px 0; border-top: 1px solid rgba(5,46,32,.14); text-decoration: none; color: inherit;
                    transition: opacity .4s ease; }
        .ch-floor:last-child { border-bottom: 1px solid rgba(5,46,32,.14); }
        .ch-list.has-active .ch-floor:not(.is-on) { opacity: .38; }
        .ch-no { font-family: 'Rampant Sans', serif; font-size: 44px; line-height: .9; }
        .ch-name { font-family: 'Rampant Sans', serif; font-size: 24px; line-height: 1.05; }
        .ch-vn { font-family: 'Google Sans Code', monospace; font-size: 11px; opacity: .6; margin-top: 5px; }
        .ch-desc { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; line-height: 1.85; opacity: .82; margin-top: 10px; max-width: 46ch; }
        .ch-more { font-family: 'Google Sans Code', monospace; font-size: 11px; margin-top: 10px; letter-spacing: .08em; }
        .ch-floor:hover .ch-go { transform: translateX(6px); }
        .ch-lion { width: 52px; height: auto; justify-self: end; transform: rotate(-4deg);
                   transition: transform .5s cubic-bezier(.16,.84,.44,1); }
        .ch-floor.is-on .ch-lion { transform: rotate(6deg) scale(1.12); }

        @media (max-width: 860px) {
          /* A phone keeps the building beside the floors, pinned while they
             scroll past — and lights whichever floor is mid-screen. */
          .ch { padding: 84px 20px 90px; }
          .ch-grid { grid-template-columns: 96px 1fr; gap: 16px; margin-top: 36px; }
          .ch-building { top: 84px; }
          .ch-floor { grid-template-columns: 1fr; gap: 0; padding: 16px 0; }
          .ch-no { font-size: 26px; margin-bottom: 6px; }
          .ch-name { font-size: 19px; }
          .ch-desc { font-size: 11.5px; line-height: 1.75; }
          .ch-lion { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ch-rise, .ch.is-in .ch-rise { opacity: 1; transform: none; animation: none; }
          .ch-veil, .ch-floor, .ch-lion { transition: none; }
        }
      ` }} />

      <div className="ch-eyebrow ch-rise" style={{ animationDelay: '.05s' }}>Năm Tầng</div>
      <h2 className="ch-title ch-rise" style={{ animationDelay: '.1s' }}>The Clubhouse</h2>
      <Link href="/spaces" className="ch-cta ch-rise" style={{ animationDelay: '.16s' }}>Explore the spaces <span>→</span></Link>

      <div className="ch-grid">
        <div className="ch-building ch-rise" style={{ animationDelay: '.2s' }}>
          <div style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Club%20Map.svg" alt="The Clubhouse — five floors" />
            {veil(ROOF, false, 'roof')}
            {FLOORS.map(f => veil(f.band as [number, number], active === f.id, f.id))}
            {veil(STREET, false, 'street')}
          </div>
        </div>

        <div ref={list} className={`ch-list ${active ? 'has-active' : ''}`}>
          {FLOORS.map((f, i) => (
            <Link key={f.id} href={`/spaces#${f.id}`}
                  className={`ch-floor ch-rise ${active === f.id ? 'is-on' : ''}`}
                  style={{ animationDelay: `${0.24 + i * 0.07}s` }}
                  data-floor={f.id}
                  onMouseEnter={() => setActive(f.id)} onFocus={() => setActive(f.id)}>
              <div className="ch-no">{String(f.num).padStart(2, '0')}</div>
              <div>
                <div className="ch-name">{f.name}</div>
                <div className="ch-vn">Floor {f.num} · {f.vn}</div>
                <p className="ch-desc">{f.desc}</p>
                <div className="ch-more">Step inside <span className="ch-go">→</span></div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ink/floor-${f.id}.webp`} alt="" aria-hidden="true" className="ch-lion" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
