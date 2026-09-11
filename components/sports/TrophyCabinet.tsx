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
        /* Set like /studio's "Every exhibition": left-aligned, a mono eyebrow,
           the title large, and each cup in a lit case rather than a boxed card. */
        .trophy-section { max-width: 1180px; margin: 0 auto; padding: 120px 24px 40px; color: #E5D4C2; }
        .trophy-rule { height: 1px; background: #E5D4C2; opacity: .15; }
        .trophy-eyebrow {
          font-family: 'Google Sans Code', monospace; font-size: 10.5px;
          letter-spacing: .22em; text-transform: uppercase; color: #D4B85A; margin-top: 26px;
        }
        .trophy-cabinet-title {
          font-family: 'Rampant Sans', serif; font-weight: 400;
          font-size: clamp(34px, 7vw, 80px); line-height: .98;
          margin: 16px 0 0; color: #E5D4C2;
        }
        .trophy-cabinet-vn { font-family: 'Google Sans Code', monospace; font-size: 12px; opacity: .6; margin: 14px 0 0; }
        .trophy-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 28px; margin-top: 48px;
        }
        .trophy-card {
          all: unset; box-sizing: border-box; display: block; cursor: pointer;
          color: #E5D4C2; text-align: left;
          /* A button centres its content vertically; stretched to the tallest
             card in the row, the shorter ones would sit lower. Pin to the top. */
          align-self: start;
        }
        .trophy-card:focus-visible { outline: 1px solid #D4B85A; outline-offset: 6px; border-radius: 12px; }
        .trophy-case {
          aspect-ratio: 4 / 5; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 50% 36%, rgba(229,212,194,.13), rgba(0,0,0,.22) 72%);
          box-shadow: inset 0 0 0 1px rgba(229,212,194,.06), 0 16px 38px rgba(0,0,0,.28);
          transition: box-shadow .5s ease;
        }
        .trophy-card:hover .trophy-case { box-shadow: inset 0 0 0 1px rgba(212,184,90,.35), 0 22px 46px rgba(0,0,0,.34); }
        .trophy-scale { transform: scale(1.7); }
        .trophy-card:hover .trophy-cup { transform: rotateY(15deg) rotateX(-3deg); }
        .trophy-go { display: inline-block; transition: transform .35s ease; }
        .trophy-card:hover .trophy-go { transform: translateX(7px); }
        @media (max-width: 900px) {
          .trophy-section { padding: 84px 20px 24px; }
          .trophy-grid { grid-template-columns: repeat(2, 1fr); gap: 22px 16px; }
        }

        /* The cup illustration is a stack of CSS shapes — bowl, stem, base */
        .trophy-cup {
          width: 64px; height: 88px;
          margin: 0 auto;
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
        .trophy-name { font-family: 'Rampant Sans', serif; font-size: 21px; line-height: 1.15; margin-top: 16px; }
        .trophy-sport {
          font-family: 'Google Sans Code', monospace; font-size: 10px;
          color: #D4B85A; letter-spacing: .18em; text-transform: uppercase; margin-top: 6px;
        }
        .trophy-desc { font-family: 'Google Sans Code', monospace; font-size: 11px; line-height: 1.8; opacity: .72; margin-top: 10px; }
        .trophy-est { font-family: 'Google Sans Code', monospace; font-size: 11px; margin-top: 12px; display: flex; gap: 14px; }
        .trophy-est > span:first-child { opacity: .5; }

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
        <div className="trophy-rule" />
        <div className="trophy-eyebrow">Tủ Cúp · Hall of Champions</div>
        <h2 className="trophy-cabinet-title">The Trophy Cabinet</h2>
        <p className="trophy-cabinet-vn">Click any cup to see past champions.</p>

        <div className="trophy-grid">
          {TROPHIES.map(t => (
            <button key={t.id} type="button" className="trophy-card" onClick={() => setActive(t)}>
              <div className="trophy-case">
                <div className="trophy-scale">
                  <div className="trophy-cup" style={{ color: 'transparent' }}>
                    <div className="trophy-bowl" style={{ background: METAL_GRADIENTS[t.metal], borderColor: METAL_GRADIENTS[t.metal] }} />
                    <div className="trophy-stem" style={{ background: METAL_GRADIENTS[t.metal] }} />
                    <div className="trophy-base" style={{ background: METAL_GRADIENTS[t.metal] }} />
                  </div>
                </div>
              </div>
              <div className="trophy-name">{t.name}</div>
              <div className="trophy-sport">{t.sport}</div>
              <div className="trophy-desc">{t.description}</div>
              <div className="trophy-est"><span>Est. {t.established}</span><span>Champions <span className="trophy-go">→</span></span></div>
            </button>
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
