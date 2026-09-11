'use client'

import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER BENEFITS — eight things, each with an object from the house's ink.
// ───────────────────────────────────────────────────────────────────────────
// It was two zig-zag columns of small grey type around a glass — hard to read
// on cream, and on a phone the alignment flipped left/right line by line. Now
// it is a grid in the /studio manner: the benefit's own illustration, the
// name set large, the description in ink — no numbers, no rules.
//
// DATES ARE DATA, NOT PROSE. The castle's line said "slated to open in 2027",
// a sentence that is wrong the day it opens and nobody is prompted to edit.
// `opens` holds the year; the page shows "Opening 2027" only while it is
// still ahead, then says nothing.

const BENEFITS: { title: string; desc: string; ink: string; opens?: number }[] = [
  { title: 'The Rampant Room', ink: 'butler-tray',
    desc: 'Hundreds of open bottles in a world-class bottle-share room. Pour for yourself, stay as long as you like.' },
  { title: 'Club Picks', ink: 'lion-bottle',
    desc: 'Taste, discuss, and select bespoke casks to be bottled exclusively under The Rampant Club label.' },
  { title: 'Blending Workshops', ink: 'glass-botanical',
    desc: 'Private blending sessions where members learn to blend whisky and make their own small bottlings.' },
  { title: 'Our Scottish Castle', ink: 'lion-lounging', opens: 2027,
    desc: 'Members enjoy exclusive discounts on accommodation, fishing, shooting, golf, and dining at our sister castle in the Scottish Highlands, which will also be home to an exclusive Rampant Club satellite outpost.' },
  { title: 'The Rampant Club Apartment', ink: 'key',
    desc: 'Complimentary stays in Huntly, Scotland, furnished with cask samples for members to enjoy. Perfect for those visiting Speyside.' },
  { title: 'Reciprocal Club Access', ink: 'newspaper',
    desc: 'Bespoke access to a vetted global network of premier private clubs in London, New York, Tokyo, and Singapore.' },
  { title: 'Luxury Transport', ink: 'sunglasses',
    desc: 'Complimentary GF VIP chauffeur service, plus airport fast-track and private car transfer for out-of-town members.' },
  { title: 'Events & Networking', ink: 'tee-glass',
    desc: 'Highland Games, golf tournaments, round table events, business brunches, and private dinners.' },
]

const thisYear = () => Number(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 4))

export default function MemberBenefits() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    setYear(thisYear())
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: .08 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className={`mb ${visible ? 'is-in' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mb { position: relative; max-width: 1180px; margin: 0 auto; padding: 40px 24px 120px; color: var(--trc-green-deep); }
        .mb-rise { opacity: 0; transform: translateY(22px); }
        .mb.is-in .mb-rise { animation: mb-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes mb-rise { to { opacity: 1; transform: none } }
        .mb-eyebrow { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 10.5px; letter-spacing: .22em;
                      text-transform: uppercase; opacity: .6; }
        .mb-title { font-family: 'Rampant Sans', serif; font-weight: 400; font-size: clamp(44px, 7.4vw, 92px);
                    line-height: .98; margin: 16px 0 0; }
        .mb-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 56px 36px; margin-top: 64px; }
        .mb-item { position: relative; }
        .mb-ink { height: 108px; display: flex; align-items: flex-end; margin: 0 0 18px; }
        .mb-ink img { max-height: 100%; max-width: 70%; width: auto; height: auto; display: block;
                      transform: rotate(-3deg); transform-origin: bottom center;
                      transition: transform .6s cubic-bezier(.16,.84,.44,1); }
        .mb-item:nth-child(even) .mb-ink img { transform: rotate(3deg); }
        .mb-item:hover .mb-ink img { transform: rotate(-9deg) translateY(-6px) scale(1.06); }
        .mb-item:nth-child(even):hover .mb-ink img { transform: rotate(9deg) translateY(-6px) scale(1.06); }
        .mb-name { font-family: 'Rampant Sans', serif; font-size: 23px; line-height: 1.08; }
        .mb-when { font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
                   color: #8A6A1F; margin-top: 8px; }
        .mb-desc { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; line-height: 1.85; opacity: .82; margin-top: 12px; }

        /* the membership card, dropped across the seam from the hero */
        @keyframes mb-card-land {
          from { opacity: 0; transform: translate(14px, -42px) scale(1.12) rotate(-5deg); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes mb-card-drift {
          from { transform: rotate(-15deg) translateY(0); }
          to   { transform: rotate(-12deg) translateY(-12px); }
        }
        .mb-card {
          position: absolute; z-index: 3; pointer-events: none;
          right: 6%; top: -170px; width: clamp(150px, 15vw, 210px); opacity: 0;
          filter: drop-shadow(18px 24px 20px rgba(5,46,32,.28)) drop-shadow(4px 6px 5px rgba(5,46,32,.18));
        }
        .mb.is-in .mb-card { animation: mb-card-land 1s cubic-bezier(.16,.84,.44,1) .15s both; }
        .mb-card img { display: block; width: 100%; height: auto; transform: rotate(-15deg);
                       animation: mb-card-drift 7s ease-in-out infinite alternate; }

        @media (max-width: 1000px) { .mb-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) {
          .mb { padding: 30px 20px 90px; }
          /* On a phone the drawing sits beside the words, not above them —
             eight stacked tall cards made the section a long scroll. */
          .mb-grid { grid-template-columns: 1fr; gap: 30px; margin-top: 40px; }
          .mb-item { display: grid; grid-template-columns: 64px 1fr; column-gap: 16px; }
          .mb-ink { grid-row: 1 / span 3; height: 64px; margin: 0; align-items: flex-start; justify-content: center; }
          .mb-ink img { max-width: 100%; }
          .mb-name { margin-top: 0; font-size: 20px; }
          .mb-desc { margin-top: 8px; }
          .mb-card { width: 104px; right: 10px; top: -128px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mb-rise, .mb.is-in .mb-rise { opacity: 1; transform: none; animation: none; }
          .mb.is-in .mb-card { animation: none; opacity: 1; }
          .mb-card img { animation: none; }
          .mb-ink img { transition: none; }
        }
      ` }} />

      <div className="mb-card" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/member-card-opt.webp" alt="" />
      </div>

      <div className="mb-eyebrow mb-rise" style={{ animationDelay: '.05s' }}>Quyền Lợi Thành Viên</div>
      <h2 className="mb-title mb-rise" style={{ animationDelay: '.1s' }}>Member Benefits</h2>

      <div className="mb-grid">
        {BENEFITS.map((b, i) => (
          <div key={b.title} className="mb-item mb-rise" style={{ animationDelay: `${0.18 + (i % 4) * 0.08 + Math.floor(i / 4) * 0.12}s` }}>
            <div className="mb-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ink/${b.ink}.webp`} alt="" loading="lazy" />
            </div>
            <div className="mb-name">{b.title}</div>
            {b.opens && year !== null && year < b.opens && <div className="mb-when">Opening {b.opens}</div>}
            <p className="mb-desc">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
