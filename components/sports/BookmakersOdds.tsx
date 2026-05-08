'use client'

import { useState } from 'react'
import { ODDS } from '@/lib/sports-data'

export default function BookmakersOdds() {
  const [tab, setTab] = useState(0)
  const current = ODDS[tab]

  return (
    <>
      <style>{`
        .odds-section {
          background: #E5D4C2;
          padding: 64px 24px;
        }
        .odds-frame {
          max-width: 600px;
          margin: 0 auto;
          background: #052E20;
          border-radius: 12px;
          padding: 28px 24px;
          box-shadow: 0 24px 48px rgba(5,46,32,0.18);
          color: #E5D4C2;
        }
        .odds-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          color: #D4B85A;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .odds-title {
          font-family: 'Rampant Sans', serif;
          font-size: 22px;
          margin: 0 0 16px;
        }
        .odds-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }
        .odds-tab {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          padding: 6px 12px;
          border: 1px solid rgba(229,212,194,0.2);
          border-radius: 18px;
          background: transparent;
          color: #B2AA98;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .odds-tab.is-active {
          background: rgba(212,184,90,0.18);
          color: #D4B85A;
          border-color: rgba(212,184,90,0.5);
        }
        .odds-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: baseline;
          padding: 14px 0;
          border-top: 1px solid rgba(229,212,194,0.08);
        }
        .odds-row:first-of-type { border-top: 1px solid rgba(212,184,90,0.4); }
        .odds-label {
          font-family: 'Rampant Sans', serif;
          font-size: 16px;
        }
        .odds-commentary {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #B2AA98;
          opacity: 0.65;
          margin-top: 3px;
          line-height: 1.5;
          font-style: italic;
        }
        .odds-num {
          font-family: 'Google Sans Code', monospace;
          font-size: 20px;
          font-weight: 600;
          color: #D4B85A;
          letter-spacing: 0.04em;
          /* split-flap-ish look */
          background: rgba(0,0,0,0.25);
          padding: 4px 12px;
          border-radius: 4px;
          border: 1px solid rgba(212,184,90,0.25);
          min-width: 72px;
          text-align: center;
        }
        .odds-disclaimer {
          margin-top: 18px;
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          color: #B2AA98;
          opacity: 0.5;
          letter-spacing: 0.06em;
          text-align: center;
          line-height: 1.6;
        }
      `}</style>

      <div className="odds-section">
        <div className="odds-frame">
          <div className="odds-eyebrow">The Bookmaker</div>
          <h3 className="odds-title">Current Odds</h3>

          <div className="odds-tabs" role="tablist">
            {ODDS.map((o, i) => (
              <button
                key={o.tournament}
                onClick={() => setTab(i)}
                className={'odds-tab' + (i === tab ? ' is-active' : '')}
              >
                {o.tournament}
              </button>
            ))}
          </div>

          <div>
            {current.rows.map(r => (
              <div key={r.label} className="odds-row">
                <div>
                  <div className="odds-label">{r.label}</div>
                  {r.commentary && <div className="odds-commentary">{r.commentary}</div>}
                </div>
                <div className="odds-num">{r.odds}</div>
              </div>
            ))}
          </div>

          <div className="odds-disclaimer">
            Wagering is strictly nominal. Settlements are paid in dignity.
          </div>
        </div>
      </div>
    </>
  )
}
