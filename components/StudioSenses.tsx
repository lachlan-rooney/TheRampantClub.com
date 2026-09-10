'use client'

import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// HOW THE STUDIO ANSWERS AN EXHIBITION.
// ───────────────────────────────────────────────────────────────────────────
// ANSWERED is the verb, deliberately. The club does not decorate a show with
// sound and food — it responds to it. "Combines", "brings together" and
// "immerses" describe something else, and the difference is the whole point of
// the room. Don't let it drift in future edits.
//
// THE ROOM'S METHOD, not one exhibition's. It lives on the hub because it is
// how The Studio works every time. Any single show's specifics already live in
// that exhibition's own food and drinks prose; repeating them here would be a
// worse version of what is already written.
//
// EVERY ENGLISH LINE BELOW IS THE CLUB'S OWN. Four are quoted from "The Studio
// x Octave Launch F&B Brief", checked against the source rather than
// paraphrased; the fifth is Lachlan's own wording, because the brief has no
// real description of the scent. Provenance is noted per line. If you add or
// change one, quote the brief or ask him — don't compose it.
const INK = '#052E20'
const SAGE = '#B0C18E'   // the hub's ground; the phone bubble inverts against it
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Sense {
  en: string
  vn: string          // the fixed Sino-Vietnamese term, not a rendering choice
  line: string | null // null renders NOTHING at all — kept so a future sense can
                      // be added mute rather than guessed at, which is how Scent
                      // shipped while it was waiting for real words
  path: string        // one stroke, drawn once
}

// THE MARKS ARE OBJECTS, the way the floor lions on /spaces hold an object
// rather than depict a floor: a book, a flask, a tumbler. So these hold what the
// room hands you — a candle, a canapé, a dram, a bell, a sprig. Never a sense
// organ: an eye, a nose or a tongue off an icon set is exactly the generic
// pictogram this page exists to avoid, and it would sit badly beside drawn lions.
// Each mark is ONE path (subpaths inside a single `d`) so the stroke-dash reveal
// runs through it in one continuous draw.
const SENSES: Sense[] = [
  // "Lighting, directed, soft and warm, designed to complement both the
  //  artworks and the whisky's amber tones." — brief, Practical Requirements
  { en: 'Sight', vn: 'Thị giác', line: 'Lighting, directed, soft and warm.',
    // a candle — "directed, soft and warm" is candlelight, not a lamp icon
    path: 'M32 12 C 27 18, 28 24, 32 27 C 36 24, 37 18, 32 12 Z M24 31 Q32 28 40 31 L40 52 L24 52 Z' },

  // "All canapés must be one-bite, no cutlery required." — brief, F&B Programme
  { en: 'Touch', vn: 'Xúc giác', line: 'One bite. No cutlery.',
    // a canapé on its base — the one bite you pick up, no cutlery
    path: 'M18 51 L46 51 M25 51 C 25 34, 39 34, 39 51 M32 34 L32 26 M32 29 L37 25' },

  // "Colour palette in stone, blush, and dusk tones, reminiscent of the piece
  //  of art itself." — brief, Canapé — Twilight / Threshold
  { en: 'Taste', vn: 'Vị giác', line: 'Reminiscent of the piece of art itself.',
    // the dram — a rocks glass and the line of whisky in it. A tulip
    // bowl came out reading as a martini, which is the wrong drink entirely.
    path: 'M23 17 L26 51 L38 51 L41 17 M24.7 33 L39.3 33' },

  // "Soft ambient music." — Programme Flow. "Soundscape controlled." — Environment
  { en: 'Sound', vn: 'Thính giác', line: 'Soft ambient. Soundscape controlled.',
    // a bell — something that SOUNDS, not a speaker that reproduces
    path: 'M21 46 C 21 29, 25 20, 32 20 C 39 20, 43 29, 43 46 M18 46 L46 46 M32 46 L32 51 M32 20 L32 15' },

  // SCENT IS THE ODD ONE OUT, AND IT IS THE STRONGEST OF THE FIVE.
  // This line is NOT from the brief — the brief says only "Aroma controlled",
  // which reads as a plant setting and badly understates what actually happens.
  // These are Lachlan's own words, given 2026-09-10: the aroma is composed per
  // exhibition, tailored to the artist or to a particular piece, decided WITH
  // the artist. Held deliberately blank until he supplied them rather than
  // filled with a plausible guess; do not "improve" it now without asking him,
  // for the same reason it was blank before.
  { en: 'Scent', vn: 'Khứu giác',
    line: 'Composed with the artist. A place, a memory, an environment.',
    // a sprig, giving off — stem, two leaves, one rising wisp
    path: 'M32 52 L32 26 M32 38 C 39 38, 43 33, 42 27 C 36 27, 32 32, 32 38 Z M32 46 C 25 46, 21 41, 22 35 C 28 35, 32 40, 32 46 Z M29 21 C 31 17, 35 19, 33 14' },
]

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
    <div ref={ref} style={{ maxWidth: 1180, margin: '104px auto 0', padding: '0 24px' }}>
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
        .sn-line { font-family: ${MONO}; font-size: 11.5px; line-height: 1.7;
                   opacity: .68; margin-top: 8px; }
        @media (max-width: 879px) {
          .sn-line { font-size: 11px; line-height: 1.62; margin-top: 6px; }
        }

        .sn-row { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .sn-item { display: grid; grid-template-columns: 46px minmax(0,1fr);
                   gap: 15px; align-items: start; position: relative; }
        @media (min-width: 880px) {
          .sn-row { grid-template-columns: repeat(5, 1fr); gap: 22px; }
          /* align-content:start matters: the row is as tall as the wordiest sense,
             every item stretches to match, and auto rows would otherwise absorb
             that slack — which set each label at its own height and made Scent
             look broken rather than quiet. Pack to the top instead. */
          .sn-item { grid-template-columns: 1fr; gap: 12px; align-content: start; }

          /* The connector is drawn BETWEEN marks, not behind them — a single rule
             across the row cut straight through the open diamonds. Starting at the
             mark's right edge (46px wide + 16px gap) and running into the next
             column (-22px, the grid gap) needs no percentage arithmetic and stays
             exact at any width. The last mark ends the line. */
          .sn-item::after { content: ''; position: absolute; top: 23px; left: 62px;
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
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3.4vw, 34px)', lineHeight: 1.2,
                   margin: '30px 0 10px', maxWidth: 640 }}>
        Every exhibition is answered in five senses
      </h2>
      <p style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.9, opacity: .72,
                  maxWidth: 560, margin: '0 0 48px' }}>
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
            <svg className={`sn-mark sn-i${i}`} viewBox="0 0 64 64" width="46" height="46"
                 aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
              <path d={s.path} pathLength={100} />
            </svg>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.25 }}>{s.en}</div>
              {/* Matches .floor-vn on /spaces: mono, 11px, .06em, no uppercase —
                  which also spares the diacritics being set in caps. */}
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em',
                            opacity: .55, marginTop: 4 }}>{s.vn}</div>
              {/* Still absent rather than empty when a sense has no words. */}
              {s.line && <div className="sn-line">{s.line}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
