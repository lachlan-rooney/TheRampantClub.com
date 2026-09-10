'use client'

import { useEffect, useRef, useState } from 'react'
import { SENSES } from '@/lib/studio/senses'

// ═══════════════════════════════════════════════════════════════════════════
// HOW THE STUDIO ANSWERS AN EXHIBITION — the render only.
// The five senses, their words and their marks live in lib/studio/senses.ts so
// that commissioned artwork can arrive without this file being opened at all,
// the way `mark` works for the floor lions on /spaces. Everything about WHAT is
// said, and where it came from, is documented there.
const INK = '#052E20'
const SAGE = '#B0C18E'   // the hub's ground
// This block is an INTRODUCTION to the room, not a feature of the page — the
// per-exhibition detail belongs to each artist further down. So it is sized to
// be read on the way past: small marks, small type, one tight band.
const MARK = 30                      // px; the grid column and the connector derive from it
const GAP  = 14                      // px between mark and words on a phone
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function StudioSenses() {
  const ref = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState(false)


  // NOTHING MOVES UNTIL IT IS LOOKED AT, and nothing moves again afterwards.
  // If a member never scrolls this far, nothing here has animated at all.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setDrawn(true); io.disconnect() }
    }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ maxWidth: 1180, margin: '76px auto 0', padding: '0 24px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* pathLength normalises every mark to 100 units, so one dash rule reveals
           all five at the same rate however long the actual geometry is. */
        .sn-mark path { stroke: ${INK}; fill: none; stroke-width: 1.25;
          stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 100; stroke-dashoffset: 100; }

        /* Drawn once, 1.2s each, a second apart. Then it stops. Nothing loops,
           nothing pulses, nothing radiates — the brief's own first principle is
           "restraint over abundance", and a diagram that keeps moving while
           saying so contradicts itself however well made. */
        .sn-on .sn-mark path { animation: sn-draw 1.2s cubic-bezier(.4,0,.2,1) forwards; }
        @keyframes sn-draw { to { stroke-dashoffset: 0 } }
        .sn-on .sn-i0 path { animation-delay: 0s }
        .sn-on .sn-i1 path { animation-delay: .9s }
        .sn-on .sn-i2 path { animation-delay: 1.8s }
        .sn-on .sn-i3 path { animation-delay: 2.7s }
        .sn-on .sn-i4 path { animation-delay: 3.6s }

        /* A STACK ON A PHONE, not a squeezed row: five marks across 390px would
           be five smudges. */
        /* Always visible, both viewports. The tap-to-open version tested badly:
           a dot after a word does not say "press me", so the lines simply looked
           missing. Legibility beat the ~170px it saved; the phone gets the height
           back by tightening instead. */
        /* Commissioned marks size to the same MARK box the stand-ins use, so a
           set can be swapped in without the row reflowing. */
        .sn-art { display: block; width: ${MARK}px; height: ${MARK}px; object-fit: contain; }

        .sn-line { font-family: ${MONO}; font-size: 11px; line-height: 1.65;
                   opacity: .68; margin-top: 7px; }
        @media (max-width: 879px) {
          .sn-line { font-size: 10.5px; line-height: 1.6; margin-top: 5px; }
        }

        .sn-row { display: grid; grid-template-columns: 1fr; gap: 15px; }
        .sn-item { display: grid; grid-template-columns: ${MARK}px minmax(0,1fr);
                   gap: ${GAP}px; align-items: start; position: relative; }
        @media (min-width: 880px) {
          .sn-row { grid-template-columns: repeat(5, 1fr); gap: 22px; }
          /* align-content:start matters: the row is as tall as the wordiest sense,
             every item stretches to match, and auto rows would otherwise absorb
             that slack — which set each label at its own height and made Scent
             look broken rather than quiet. Pack to the top instead. */
          .sn-item { grid-template-columns: 1fr; gap: 10px; align-content: start; }

          /* The connector is drawn BETWEEN marks, not behind them — a single rule
             across the row cut straight through the open diamonds. Starting at the
             mark's right edge (MARK wide + GAP) and running into the next
             column (-22px, the grid gap) needs no percentage arithmetic and stays
             exact at any width. The last mark ends the line. */
          .sn-item::after { content: ''; position: absolute; top: ${MARK / 2}px; left: ${MARK + GAP + 2}px;
                            right: -22px; height: 1px; background: ${INK}; opacity: .16; }
          .sn-item:last-child::after { content: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          /* Present and still. The marks are simply there. */
          .sn-mark path { stroke-dashoffset: 0 !important; animation: none !important; }
        }
      ` }} />

      <div style={{ height: 1, background: INK, opacity: .15 }} />

      {/* No Vietnamese heading yet. The rest of the site sets EN and VN together
          (see /spaces), and this wants the same — but it is Miss Châu's to write,
          not a machine's. Absent until she does. */}
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(17px, 2.1vw, 23px)', lineHeight: 1.25,
                   margin: '22px 0 8px', maxWidth: 560 }}>
        Every exhibition is answered in five senses
      </h2>
      <p style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.8, opacity: .7,
                  maxWidth: 640, margin: '0 0 34px' }}>
        {/* Four clauses under a heading that says five made a reader count along
            and come up one behind — "what you are handed" was quietly doing both
            touch and taste. Collapsing them on purpose beats listing five. */}
        The work is hung, and then the room is built to answer it — the light it
        is seen in, what reaches your hand and your glass, what you hear, and the
        air itself.
      </p>

      <div className={`sn-row${drawn ? ' sn-on' : ''}`}>
        {SENSES.map((s, i) => (
          <div key={s.en} className="sn-item">
            {/* Commissioned art wins and simply appears; a stand-in draws itself.
                See lib/studio/senses.ts for why they are never mixed for long. */}
            {s.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sn-art" src={s.art} alt="" width={MARK} height={MARK} loading="lazy" />
            ) : (
              <svg className={`sn-mark sn-i${i}`} viewBox="0 0 64 64" width={MARK} height={MARK}
                   aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
                <path d={s.path} pathLength={100} />
              </svg>
            )}
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 14, lineHeight: 1.25 }}>{s.en}</div>
              {/* Matches .floor-vn on /spaces: mono, 11px, .06em, no uppercase —
                  which also spares the diacritics being set in caps. */}
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em',
                            opacity: .55, marginTop: 3 }}>{s.vn}</div>
              {/* Still absent rather than empty when a sense has no words. */}
              {s.line && <div className="sn-line">{s.line}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
