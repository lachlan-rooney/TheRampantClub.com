'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'rampant.welcome.v1'

interface Step {
  eyebrow: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    eyebrow: 'Welcome',
    title: "You're among Rampants now.",
    body: "A few quick orientations before we leave you to it. You can dismiss this any time.",
  },
  {
    eyebrow: '◆ Tonight',
    title: 'A live brief, every visit.',
    body: "The top-left panel surfaces the dram of the day, what's spinning on the turntable, and how many members are currently in the clubhouse. Curated by the Committee.",
  },
  {
    eyebrow: '✎ Notice Board',
    title: 'Read the room.',
    body: "House announcements pinned to the corkboard. New every week. Tap to read the rest.",
  },
  {
    eyebrow: '◇ Your hub',
    title: 'Everything else lives below.',
    body: "Events, fixtures, your membership card, the spaces, contact, and the house rules. The bucket grid is the index.",
  },
  {
    eyebrow: '✦',
    title: 'Pour for yourself. Stay as long as you like.',
    body: 'See you in the Library Bar.',
  },
]

export default function WelcomeTour({ name }: { name?: string }) {
  const [step, setStep] = useState<number>(-1) // -1 = closed

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // small delay so the page settles before the modal appears
      const t = setTimeout(() => setStep(0), 600)
      return () => clearTimeout(t)
    }
  }, [])

  const close = () => {
    setStep(-1)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, '1')
  }
  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else close()
  }
  const back = () => setStep(s => Math.max(0, s - 1))

  if (step < 0) return null
  const s = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  return (
    <>
      <style>{`
        .wt-backdrop {
          position: fixed; inset: 0;
          background: rgba(5,46,32,0.62);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 99990;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: wt-fade 0.4s ease;
        }
        @keyframes wt-fade { from { opacity: 0 } to { opacity: 1 } }
        .wt-card {
          background: #052E20;
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.4);
          border-radius: 16px;
          padding: 36px 32px 28px;
          width: 100%;
          max-width: 460px;
          position: relative;
          box-shadow: 0 32px 64px rgba(0,0,0,0.55);
          animation: wt-rise 0.45s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes wt-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wt-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: #D4B85A;
          margin-bottom: 8px;
        }
        .wt-title {
          font-family: 'Rampant Sans', serif;
          font-size: 24px;
          font-weight: 500;
          margin: 0 0 14px;
          letter-spacing: 0.02em;
          line-height: 1.25;
        }
        .wt-body {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          color: #B2AA98;
          line-height: 1.7;
          letter-spacing: 0.02em;
          margin: 0 0 24px;
        }
        .wt-progress {
          display: flex; gap: 6px; margin-bottom: 18px;
        }
        .wt-dot {
          flex: 1; height: 3px; border-radius: 2px;
          background: rgba(229,212,194,0.15);
          transition: background 0.3s ease;
        }
        .wt-dot.is-on { background: #D4B85A; }
        .wt-controls {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px;
        }
        .wt-skip {
          background: transparent; color: #B2AA98;
          border: none; cursor: pointer;
          font-family: 'Google Sans Code', monospace; font-size: 10px;
          letter-spacing: 0.12em; text-transform: uppercase;
          opacity: 0.6; transition: opacity 0.2s;
        }
        .wt-skip:hover { opacity: 1; }
        .wt-pair { display: flex; gap: 8px; }
        .wt-btn {
          background: rgba(212,184,90,0.18);
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.35);
          border-radius: 8px;
          padding: 10px 22px;
          cursor: pointer;
          font-family: 'Google Sans Code', monospace; font-size: 11px;
          letter-spacing: 0.10em; text-transform: uppercase;
          font-weight: 600;
          transition: background 0.2s, border-color 0.2s;
        }
        .wt-btn:hover { background: rgba(212,184,90,0.28); border-color: rgba(212,184,90,0.6); }
        .wt-btn.is-back {
          background: transparent; border-color: rgba(229,212,194,0.18); color: #B2AA98;
        }
        .wt-btn.is-back:hover { background: rgba(229,212,194,0.06); color: #E5D4C2; }
      `}</style>
      <div className="wt-backdrop" onClick={close} role="dialog" aria-modal="true" aria-label="Welcome tour">
        <div className="wt-card" onClick={e => e.stopPropagation()}>
          <div className="wt-progress" aria-hidden>
            {STEPS.map((_, i) => (
              <div key={i} className={`wt-dot${i <= step ? ' is-on' : ''}`} />
            ))}
          </div>
          <div className="wt-eyebrow">{s.eyebrow}</div>
          <h2 className="wt-title">{isFirst && name ? `Welcome, ${name}.` : s.title}</h2>
          <p className="wt-body">{s.body}</p>
          <div className="wt-controls">
            <button className="wt-skip" onClick={close}>{isLast ? 'Close' : 'Skip'}</button>
            <div className="wt-pair">
              {!isFirst && (
                <button className="wt-btn is-back" onClick={back}>Back</button>
              )}
              <button className="wt-btn" onClick={next}>
                {isLast ? 'Begin' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
