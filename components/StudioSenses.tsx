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
// EVERY ENGLISH LINE BELOW IS THE CLUB'S OWN, quoted from
// "The Studio x Octave Launch F&B Brief" — checked against the source, not
// paraphrased. Their provenance is noted per line. If you add a sense line,
// quote the brief; don't compose one.
const INK = '#052E20'
const SAGE = '#B0C18E'   // the hub's ground; the phone bubble inverts against it
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Sense {
  en: string
  vn: string          // the fixed Sino-Vietnamese term, not a rendering choice
  line: string | null // null renders NOTHING — see Scent
  path: string        // one stroke, drawn once
}

// Five variations on the diamond the Studio already uses as a section marker,
// at different apertures. NOT pictograms: a stock eye, nose and tongue would be
// the opposite of the drawn lions the rest of the site is built from.
const SENSES: Sense[] = [
  // "Lighting, directed, soft and warm, designed to complement both the
  //  artworks and the whisky's amber tones." — brief, Practical Requirements
  { en: 'Sight', vn: 'Thị giác', line: 'Lighting, directed, soft and warm.',
    path: 'M32 6 L58 32 L32 58 L6 32 Z M32 22 L42 32 L32 42 L22 32 Z' },

  // "All canapés must be one-bite, no cutlery required." — brief, F&B Programme
  { en: 'Touch', vn: 'Xúc giác', line: 'One bite. No cutlery.',
    path: 'M32 6 L58 32 L32 58 L6 32 Z M20 44 L44 20' },

  // "Colour palette in stone, blush, and dusk tones, reminiscent of the piece
  //  of art itself." — brief, Canapé — Twilight / Threshold
  { en: 'Taste', vn: 'Vị giác', line: 'Reminiscent of the piece of art itself.',
    path: 'M32 6 L58 32 L32 58 L6 32 Z M10 32 L54 32' },

  // "Soft ambient music." — Programme Flow. "Soundscape controlled." — Environment
  { en: 'Sound', vn: 'Thính giác', line: 'Soft ambient. Soundscape controlled.',
    path: 'M32 12 L52 32 L32 52 L12 32 Z M32 2 L62 32 L32 62 L2 32 Z' },

  // SCENT HAS NO LINE, AND THAT IS THE POINT.
  // The club really does pump a composed aroma into this room — but the only
  // words anyone has written for it are "Aroma controlled", which is a plant
  // instruction, not a description. The other four earn their place by being
  // specific. A placeholder here — petrichor, "the scent after rain", anything
  // borrowed from the artist's notes — would be precisely the invention the
  // rest of this avoids. The mark stands alone until Lachlan supplies the
  // words. A mark with no words is honest; a mark with invented words is not.
  { en: 'Scent', vn: 'Khứu giác', line: null,
    path: 'M32 6 L58 32 L32 58 L6 32 Z M32 58 C 24 44, 40 38, 32 22' },
]

export default function StudioSenses() {
  const ref = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState(false)

  // Phone only: the four lines are worth reading but not worth four permanent
  // paragraphs — five senses of always-on prose pushed everything below off the
  // screen. Collapsed to a tap, they cost no layout space at all, because the
  // bubble is absolutely positioned inside its own item rather than in flow.
  // Desktop ignores all of this and keeps the lines visible.
  const [open, setOpen] = useState<number | null>(null)

  // Anchored to .sn-item (position:relative), never position:fixed — a fixed
  // bubble would be captured by any transformed ancestor and open in the wrong
  // place, which is a trap this codebase has already been bitten by.
  useEffect(() => {
    if (open === null) return
    const away = (e: PointerEvent) => {
      if (!(e.target as Element)?.closest?.('.sn-item')) setOpen(null)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

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
        /* ── the phone's collapsed state ──────────────────────────────────
           The trigger is a real <button>, reset to look like the text it
           replaced. Senses with no line get no button, so Scent has nothing to
           tap and nothing that hints there is something to tap. */
        .sn-trigger { -webkit-appearance: none; appearance: none; background: none;
          border: 0; padding: 0; margin: 0; font: inherit; color: inherit;
          text-align: left; display: block; cursor: pointer; }
        .sn-trigger:focus-visible { outline: 1.5px solid ${INK}; outline-offset: 4px; border-radius: 3px; }
        /* the only affordance: a hairline dot after the name */
        .sn-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%;
          background: ${INK}; opacity: .38; vertical-align: middle; margin-left: 7px;
          transition: opacity .15s; }
        .sn-item.is-open .sn-dot { opacity: 1; }

        .sn-tip { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; opacity: .68; margin-top: 9px; }

        @media (max-width: 879px) {
          /* Opens IN FLOW, not as an overlay. An absolutely positioned bubble
             cleared its own row but then sat across the next sense's name while
             leaving its Vietnamese line showing underneath — which reads as a
             rendering fault, not a tooltip. Inline, it obscures nothing. The
             space complaint is answered by the collapsed default (five lines of
             permanent prose gone); one open bubble is ~50px, briefly, on the one
             sense being read. */
          .sn-tip {
            margin-top: 11px; padding: 11px 14px; border-radius: 10px;
            background: ${INK}; color: ${SAGE}; opacity: 1;
            box-shadow: 0 8px 22px rgba(5,46,32,.16);
          }
          .sn-item:not(.is-open) .sn-tip { display: none; }
          /* Centred against the mark while collapsed; top-aligned once the
             bubble makes the text column the taller of the two. */
          .sn-item.is-open { align-items: start; }
        }
        @media (min-width: 880px) {
          /* Desktop keeps every line in plain sight — nothing to tap, no dot. */
          .sn-dot { display: none; }
          .sn-trigger { cursor: default; }
        }

        .sn-row { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .sn-item { display: grid; grid-template-columns: 46px minmax(0,1fr);
                   gap: 16px; align-items: center; position: relative; }
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
        The work is hung, and then the room is built to answer it — the light it
        is seen in, what you are handed, what you hear, and the air itself.
      </p>

      <div className={`sn-row${drawn ? ' sn-on' : ''}`}>
        {SENSES.map((s, i) => {
          const isOpen = open === i
          const names = (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.25 }}>
                {s.en}
                {/* No line, no dot: Scent must not look like a tap that failed. */}
                {s.line && <span className="sn-dot" aria-hidden="true" />}
              </div>
              {/* Matches .floor-vn on /spaces: mono, 11px, .06em, no uppercase —
                  which also spares the diacritics being set in caps. */}
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em',
                            opacity: .55, marginTop: 4 }}>{s.vn}</div>
            </>
          )
          return (
            <div key={s.en} className={`sn-item${isOpen ? ' is-open' : ''}`}>
              <svg className={`sn-mark sn-i${i}`} viewBox="0 0 64 64" width="46" height="46"
                   aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
                <path d={s.path} pathLength={100} />
              </svg>
              <div>
                {s.line ? (
                  <button type="button" className="sn-trigger"
                          aria-expanded={isOpen} aria-controls={`sn-tip-${i}`}
                          onClick={() => setOpen(isOpen ? null : i)}>
                    {names}
                  </button>
                ) : names /* Scent: plain text, nothing to press. */}

                {/* ABSENT, not empty: for Scent there is no element at all — no
                    bubble, no trigger, no gap, no stray marker. */}
                {s.line && <div className="sn-tip" id={`sn-tip-${i}`} role="note">{s.line}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
