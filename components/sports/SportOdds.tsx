'use client'

import { SPORT_ODDS } from '@/lib/sports-data'

// The bookies' board for one fixture: a mono eyebrow naming the tournament,
// then each price set in the display face beside its runner. No box — a
// hairline above, like every other particular on the page.
export default function SportOdds({ sport }: { sport: string }) {
  const board = SPORT_ODDS[sport]
  if (!board) return null

  return (
    <>
      <style>{`
        .sodds { margin-top: 30px; padding-top: 16px; border-top: 1px solid rgba(5,46,32,.14); color: #052E20; }
        .sodds-head {
          font-family: 'Google Sans Code', monospace; font-size: 10px;
          letter-spacing: .2em; text-transform: uppercase; opacity: .62;
        }
        .sodds-head em { font-style: normal; opacity: 1; }
        .sodds-row { display: flex; flex-wrap: wrap; gap: 14px 30px; margin-top: 14px; }
        .sodds-pair { display: flex; flex-direction: column; gap: 4px; }
        .sodds-num { font-family: 'Rampant Sans', serif; font-size: 26px; line-height: 1; }
        .sodds-label { font-family: 'Google Sans Code', monospace; font-size: 11px; opacity: .7; }
      `}</style>
      <div className="sodds" role="complementary" aria-label={`Odds for ${board.tournament}`}>
        <div className="sodds-head">Latest odds · <em>{board.tournament}</em></div>
        <div className="sodds-row">
          {board.rows.map(r => (
            <div key={r.label} className="sodds-pair">
              <span className="sodds-num">{r.odds}</span>
              <span className="sodds-label">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
