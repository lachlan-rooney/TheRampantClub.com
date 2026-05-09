'use client'

import { SPORTS } from '@/lib/sports-data'
import SportIcon from './SportIcons'

// Tile strip below the page title. Click a tile → smooth-scroll to that
// section's anchor on the page. Highlights its sport name and upcoming count.
export default function SportSelector() {
  const onClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <style>{`
        .sport-selector {
          display: grid;
          grid-template-columns: repeat(${SPORTS.length}, 1fr);
          gap: 10px;
          margin: 0 auto 56px;
          max-width: 640px;
        }
        .sport-tile {
          position: relative;
          padding: 18px 10px 14px;
          background: rgba(5,46,32,0.04);
          border: 1px solid rgba(5,46,32,0.10);
          border-radius: 10px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.22,1,0.36,1),
                      background 0.3s ease, border-color 0.3s ease,
                      box-shadow 0.3s ease;
          text-decoration: none;
          color: inherit;
        }
        .sport-tile:hover {
          transform: translateY(-3px);
          background: rgba(5,46,32,0.07);
          border-color: rgba(212,184,90,0.45);
          box-shadow: 0 12px 24px rgba(5,46,32,0.10);
        }
        .sport-tile-glyph {
          color: #5E6650;
          line-height: 0;
          margin: 0 auto 10px;
          opacity: 0.85;
          transition: color 0.3s, transform 0.3s, opacity 0.3s;
        }
        .sport-tile:hover .sport-tile-glyph {
          color: #052E20;
          opacity: 1;
          transform: translateY(-1px);
        }
        .sport-tile-label {
          font-family: 'Rampant Sans', serif;
          font-size: 12px;
          font-weight: 600;
          color: #052E20;
          letter-spacing: 0.04em;
        }
        .sport-tile-vn {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #5E6650;
          opacity: 0.7;
          margin-top: 2px;
          letter-spacing: 0.08em;
        }
        .sport-tile-count {
          margin: 10px auto 0;
          display: inline-block;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #052E20;
          letter-spacing: 0.06em;
          background: rgba(5, 46, 32, 0.08);
          padding: 3px 9px;
          border-radius: 10px;
        }
        @media (max-width: 600px) {
          .sport-selector {
            grid-template-columns: repeat(3, 1fr);
            row-gap: 10px;
          }
        }
      `}</style>

      <div className="sport-selector" role="navigation" aria-label="Sport selector">
        {SPORTS.map(s => (
          <a key={s.id} href={`#${s.id}`} onClick={onClick(s.id)} className="sport-tile">
            <div className="sport-tile-glyph" aria-hidden><SportIcon id={s.id} size={28} /></div>
            <div className="sport-tile-label">{s.label}</div>
            <div className="sport-tile-vn">{s.vn}</div>
            {s.upcoming > 0 && (
              <div className="sport-tile-count">{s.upcoming} upcoming</div>
            )}
          </a>
        ))}
      </div>
    </>
  )
}
