'use client'

import { useState } from 'react'
import { CAPTAINS_COLUMN } from '@/lib/sports-data'

// Picks an aphorism deterministically per visit so it doesn't flicker on
// hydration; clicking the chevron rotates to the next one.
function pickIndex() {
  const day = Math.floor(Date.now() / 86400000)
  return day % CAPTAINS_COLUMN.length
}

export default function CaptainsColumn() {
  const [idx, setIdx] = useState<number>(() => pickIndex())
  const next = () => setIdx(i => (i + 1) % CAPTAINS_COLUMN.length)

  return (
    <>
      <style>{`
        .capt-column {
          margin: 56px auto;
          max-width: 540px;
          padding: 28px 32px 24px;
          background: rgba(5,46,32,0.04);
          border-left: 3px solid #D4B85A;
          border-radius: 4px;
          position: relative;
        }
        .capt-column-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          color: #5E6650;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          opacity: 0.7;
          margin-bottom: 12px;
        }
        .capt-column-quote {
          font-family: 'Rampant Sans', serif;
          font-size: 19px;
          font-style: italic;
          color: #052E20;
          line-height: 1.5;
          margin-bottom: 14px;
        }
        .capt-column-byline {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #5E6650;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .capt-column-chev {
          position: absolute;
          top: 14px; right: 14px;
          background: transparent;
          border: 1px solid rgba(5,46,32,0.15);
          border-radius: 50%;
          width: 28px; height: 28px;
          font-size: 14px; line-height: 1;
          color: #5E6650;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .capt-column-chev:hover {
          background: #D4B85A;
          color: #052E20;
          border-color: #D4B85A;
        }
      `}</style>

      <div className="capt-column">
        <button className="capt-column-chev" onClick={next} aria-label="Next quote">›</button>
        <div className="capt-column-eyebrow">From the Captain’s Column</div>
        <div className="capt-column-quote">“{CAPTAINS_COLUMN[idx]}”</div>
        <div className="capt-column-byline">— The Captain</div>
      </div>
    </>
  )
}
