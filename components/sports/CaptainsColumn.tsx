'use client'

import { useState } from 'react'
import { CAPTAINS_COLUMN } from '@/lib/sports-data'

// Picks an aphorism deterministically per visit so it doesn't flicker on
// hydration; "Another" rotates to the next one.
function pickIndex() {
  const day = Math.floor(Date.now() / 86400000)
  return day % CAPTAINS_COLUMN.length
}

// A full-width band in the club's green, the quote set large — a pause in the
// page between the Cup and the rest of the calendar.
export default function CaptainsColumn() {
  const [idx, setIdx] = useState<number>(() => pickIndex())
  const next = () => setIdx(i => (i + 1) % CAPTAINS_COLUMN.length)

  return (
    <>
      <style>{`
        .capt-band { background: #052E20; color: #E5D4C2; }
        .capt-inner { max-width: 1180px; margin: 0 auto; padding: 96px 24px 88px; }
        .capt-eyebrow {
          font-family: 'Google Sans Code', monospace; font-size: 10.5px;
          letter-spacing: .22em; text-transform: uppercase; color: #D4B85A;
        }
        .capt-quote {
          font-family: 'Rampant Sans', serif;
          font-size: clamp(30px, 5.4vw, 68px); line-height: 1.02;
          margin: 22px 0 0; max-width: 16ch;
        }
        .capt-foot { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 34px; flex-wrap: wrap; }
        .capt-byline { font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; opacity: .6; }
        .capt-next {
          background: none; border: none; cursor: pointer; color: #E5D4C2;
          font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
          border-bottom: 1px solid rgba(229,212,194,.6); padding: 0 0 6px;
        }
        .capt-next span { display: inline-block; transition: transform .35s ease; }
        .capt-next:hover span { transform: translateX(7px); }
        @keyframes capt-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .capt-quote { animation: capt-in .6s cubic-bezier(.16,.84,.44,1) both; }
        @media (prefers-reduced-motion: reduce) { .capt-quote { animation: none; } .capt-next span { transition: none; } }
      `}</style>

      <div className="capt-band">
        <div className="capt-inner">
          <div className="capt-eyebrow">From the Captain’s Column</div>
          {/* keyed so each new quote rises in */}
          <blockquote key={idx} className="capt-quote">“{CAPTAINS_COLUMN[idx]}”</blockquote>
          <div className="capt-foot">
            <div className="capt-byline">— The Captain</div>
            <button className="capt-next" onClick={next} aria-label="Next quote">Another <span>→</span></button>
          </div>
        </div>
      </div>
    </>
  )
}
