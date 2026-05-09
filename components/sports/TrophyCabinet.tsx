'use client'

import { useState } from 'react'
import { TROPHIES, WINNERS, type Trophy } from '@/lib/sports-data'

const METAL_GRADIENTS: Record<Trophy['metal'], string> = {
  gold:   'linear-gradient(180deg, #F4D77A 0%, #C8A03A 50%, #9C7C28 100%)',
  silver: 'linear-gradient(180deg, #E8E8E8 0%, #B8B8B8 50%, #888888 100%)',
  bronze: 'linear-gradient(180deg, #DDA77A 0%, #B07840 50%, #7A4F22 100%)',
  pewter: 'linear-gradient(180deg, #B8B0A8 0%, #8A8278 50%, #5C544A 100%)',
}

export default function TrophyCabinet() {
  const [active, setActive] = useState<Trophy | null>(null)

  return (
    <>
      <style>{`
        .trophy-section {
          padding: 60px 20px 80px;
        }
        .trophy-cabinet-title {
          font-family: 'Rampant Sans', serif;
          font-size: 28px;
          color: #E5D4C2;
          text-align: center;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }
        .trophy-cabinet-vn {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: #B2AA98;
          text-align: center;
          letter-spacing: 0.06em;
          margin-bottom: 50px;
          opacity: 0.7;
        }
        .trophy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 32px;
          max-width: 880px;
          margin: 0 auto;
        }
        .trophy-card {
          position: relative;
          padding: 30px 24px 22px;
          background: rgba(229,212,194,0.04);
          border: 1px solid rgba(229,212,194,0.10);
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.4s cubic-bezier(0.22,1,0.36,1),
                      background 0.3s, border-color 0.3s, box-shadow 0.4s;
          color: #E5D4C2;
        }
        .trophy-card:hover {
          transform: translateY(-6px);
          background: rgba(229,212,194,0.07);
          border-color: rgba(212,184,90,0.45);
          box-shadow: 0 24px 48px rgba(0,0,0,0.35);
        }
        .trophy-card:hover .trophy-cup { transform: rotateY(15deg) rotateX(-3deg); }

        /* The cup illustration is a stack of CSS shapes — bowl, stem, base */
        .trophy-cup {
          width: 64px; height: 88px;
          margin: 0 auto 18px;
          position: relative;
          transition: transform 0.6s cubic-bezier(0.22,1,0.36,1);
          transform-style: preserve-3d;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.35));
        }
        .trophy-bowl {
          position: absolute;
          top: 0; left: 4px;
          width: 56px; height: 56px;
          border-radius: 50% 50% 18px 18px / 50% 50% 18px 18px;
        }
        .trophy-bowl::before, .trophy-bowl::after {
          content: '';
          position: absolute; top: 8px;
          width: 16px; height: 22px;
          border: 4px solid currentColor;
          border-color: inherit;
          border-radius: 0 14px 14px 0;
        }
        .trophy-bowl::before { left: -16px; transform: rotateY(180deg); }
        .trophy-bowl::after  { right: -16px; }
        .trophy-stem {
          position: absolute;
          top: 50px; left: 28px;
          width: 8px; height: 22px;
        }
        .trophy-base {
          position: absolute;
          top: 70px; left: 14px;
          width: 36px; height: 12px;
          border-radius: 3px;
        }
        .trophy-name {
          font-family: 'Rampant Sans', serif;
          font-size: 16px;
          font-weight: 600;
          color: #E5D4C2;
          margin-bottom: 4px;
          letter-spacing: 0.02em;
        }
        .trophy-sport {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #D4B85A;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .trophy-desc {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: #B2AA98;
          opacity: 0.85;
          line-height: 1.6;
          margin-bottom: 18px;
        }
        .trophy-est {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #B2AA98;
          opacity: 0.5;
          letter-spacing: 0.08em;
          padding-top: 12px;
          border-top: 1px solid rgba(229,212,194,0.08);
        }

        /* Hall of Champions modal */
        .hall-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          z-index: 9990;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: hall-fade 0.3s ease;
        }
        @keyframes hall-fade { from { opacity: 0 } to { opacity: 1 } }
        .hall-card {
          background: #052E20;
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.3);
          border-radius: 14px;
          padding: 36px;
          max-width: 540px;
          width: 100%;
          box-shadow: 0 30px 80px rgba(0,0,0,0.55);
          animation: hall-rise 0.35s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes hall-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hall-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #D4B85A;
          margin-bottom: 6px;
        }
        .hall-title {
          font-family: 'Rampant Sans', serif;
          font-size: 28px;
          margin: 0 0 24px;
        }
        .hall-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 0;
          border-top: 1px solid rgba(229,212,194,0.1);
          gap: 12px;
        }
        .hall-row:first-of-type { border-top: 1px solid rgba(212,184,90,0.4); }
        .hall-year {
          font-family: 'Rampant Sans', serif;
          font-size: 24px;
          font-weight: 600;
          color: #D4B85A;
          min-width: 60px;
        }
        .hall-winner {
          flex: 1;
          font-family: 'Rampant Sans', serif;
          font-size: 14px;
        }
        .hall-result {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: #B2AA98;
          letter-spacing: 0.06em;
        }
        .hall-notes {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #B2AA98;
          opacity: 0.6;
          font-style: italic;
          margin-top: 4px;
        }
        .hall-close {
          margin-top: 20px;
          background: transparent;
          color: #B2AA98;
          border: 1px solid rgba(229,212,194,0.2);
          border-radius: 6px;
          padding: 8px 18px;
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        }
        .hall-close:hover { background: rgba(229,212,194,0.06); color: #E5D4C2; }
      `}</style>

      <div className="trophy-section">
        <h2 className="trophy-cabinet-title">The Trophy Cabinet</h2>
        <p className="trophy-cabinet-vn">Tủ Cúp · click any cup to see past champions</p>

        <div className="trophy-grid">
          {TROPHIES.map(t => (
            <div key={t.id} className="trophy-card" onClick={() => setActive(t)}>
              <div className="trophy-cup" style={{ color: 'transparent' }}>
                <div className="trophy-bowl" style={{ background: METAL_GRADIENTS[t.metal], borderColor: METAL_GRADIENTS[t.metal] }} />
                <div className="trophy-stem" style={{ background: METAL_GRADIENTS[t.metal] }} />
                <div className="trophy-base" style={{ background: METAL_GRADIENTS[t.metal] }} />
              </div>
              <div className="trophy-name">{t.name}</div>
              <div className="trophy-sport">{t.sport}</div>
              <div className="trophy-desc">{t.description}</div>
              <div className="trophy-est">Est. {t.established}</div>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <div className="hall-backdrop" onClick={() => setActive(null)}>
          <div className="hall-card" onClick={e => e.stopPropagation()}>
            <div className="hall-eyebrow">Hall of Champions</div>
            <h3 className="hall-title">{active.name}</h3>
            {WINNERS.filter(w => w.trophy === active.id).length === 0 && (
              <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98', opacity: 0.7 }}>
                No champions on record yet. The first will be enshrined this year.
              </p>
            )}
            {WINNERS.filter(w => w.trophy === active.id).map(w => (
              <div key={w.year}>
                <div className="hall-row">
                  <div className="hall-year">{w.year}</div>
                  <div className="hall-winner">{w.winner}</div>
                  <div className="hall-result">{w.result}</div>
                </div>
                {w.notes && <div className="hall-notes" style={{ paddingLeft: 72, marginTop: -8, marginBottom: 8 }}>{w.notes}</div>}
              </div>
            ))}
            <button className="hall-close" onClick={() => setActive(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
