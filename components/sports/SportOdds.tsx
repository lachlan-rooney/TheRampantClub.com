'use client'

import { SPORT_ODDS } from '@/lib/sports-data'

// Compact bookies-style odds strip: a header line + a horizontal row of
// label/odds pairs. Two lines total, neutral palette.
export default function SportOdds({ sport }: { sport: string }) {
  const board = SPORT_ODDS[sport]
  if (!board) return null

  return (
    <>
      <style>{`
        .sodds {
          margin-top: 22px;
          padding: 10px 14px;
          background: rgba(5, 46, 32, 0.10);
          border: 1px solid rgba(5, 46, 32, 0.18);
          border-radius: 4px;
        }
        .sodds-head {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #5E6650;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-bottom: 6px;
          opacity: 0.75;
        }
        .sodds-head em {
          color: #052E20;
          font-style: normal;
          font-weight: 600;
          margin-left: 6px;
        }
        .sodds-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 14px;
          align-items: baseline;
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          color: #052E20;
        }
        .sodds-pair { display: inline-flex; gap: 6px; align-items: baseline; }
        .sodds-label { color: #5E6650; }
        .sodds-num {
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #052E20;
          background: rgba(229, 212, 194, 0.85);
          border: 1px solid rgba(5, 46, 32, 0.28);
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          min-width: 36px;
          text-align: center;
          display: inline-block;
          line-height: 1.4;
        }
        .sodds-sep {
          color: #B2AA98;
          opacity: 0.55;
        }
      `}</style>
      <div className="sodds" role="complementary" aria-label={`Odds for ${board.tournament}`}>
        <div className="sodds-head">
          ◆ Latest Odds <em>{board.tournament}</em>
        </div>
        <div className="sodds-row">
          {board.rows.map((r, i) => (
            <span key={r.label} className="sodds-pair">
              {i > 0 && <span className="sodds-sep">·</span>}
              <span className="sodds-label">{r.label}</span>
              <span className="sodds-num">{r.odds}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
