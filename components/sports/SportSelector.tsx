'use client'

import { useEffect, useState } from 'react'
import { SPORTS } from '@/lib/sports-data'

// The sports, set as /studio sets its artists: names in the display face, an
// underline that draws in, and the live upcoming count in mono beside each.
// Click → smooth-scroll to that section. The tab for the section on screen is
// marked as the reader scrolls, so the strip doubles as a "you are here".
export default function SportSelector({ counts }: { counts?: Record<string, number> }) {
  const [current, setCurrent] = useState<string | null>(null)

  useEffect(() => {
    const els = SPORTS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    // A section counts as "on screen" while it crosses the upper third.
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setCurrent(e.target.id) })
    }, { rootMargin: '-30% 0px -60% 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const onClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <style>{`
        .sport-tabs {
          display: flex; gap: clamp(22px, 3.4vw, 40px);
          overflow-x: auto; scrollbar-width: none;
          border-bottom: 1px solid rgba(5,46,32,.12);
        }
        .sport-tabs::-webkit-scrollbar { display: none; }
        .sport-tab {
          position: relative; flex-shrink: 0;
          padding: 0 0 14px; text-decoration: none; color: #052E20;
          font-family: 'Rampant Sans', serif;
          font-size: clamp(19px, 3.2vw, 27px); line-height: 1;
          opacity: .4; transition: opacity .35s ease;
        }
        .sport-tab::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
          background: #052E20; transform: scaleX(0); transform-origin: left;
          transition: transform .45s cubic-bezier(.16,.84,.44,1);
        }
        .sport-tab:hover { opacity: .85; }
        .sport-tab:hover::after { transform: scaleX(1); opacity: .4; }
        .sport-tab.is-on { opacity: 1; }
        .sport-tab.is-on::after { transform: scaleX(1); opacity: 1; }
        .sport-tab-count {
          font-family: 'Google Sans Code', monospace; font-size: 10px;
          letter-spacing: .04em; opacity: .75; margin-left: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          .sport-tab, .sport-tab::after { transition: none; }
        }
      `}</style>

      <nav className="sport-tabs" aria-label="Sports">
        {SPORTS.map(s => {
          const upcoming = counts?.[s.id] ?? s.upcoming   // live count when provided, else the static fallback
          return (
            <a key={s.id} href={`#${s.id}`} onClick={onClick(s.id)}
               className={`sport-tab ${current === s.id ? 'is-on' : ''}`}
               aria-current={current === s.id ? 'true' : undefined}>
              {s.label}
              {upcoming > 0 && <span className="sport-tab-count">· {upcoming} upcoming</span>}
            </a>
          )
        })}
      </nav>
    </>
  )
}
