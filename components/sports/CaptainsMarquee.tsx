'use client'

import { MARQUEE } from '@/lib/sports-data'

// A skinny continuously-scrolling ticker at the very top of the sports page.
// Pure CSS animation; pauses on hover.
export default function CaptainsMarquee() {
  // Repeat the headlines so the loop seamlessly tiles across the full track.
  const items = [...MARQUEE, ...MARQUEE]
  return (
    <>
      <style>{`
        @keyframes capt-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .capt-marquee {
          position: relative;
          background: #052E20;
          color: #E5D4C2;
          padding: 8px 0;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          overflow: hidden;
          border-bottom: 1px solid rgba(229,212,194,0.12);
        }
        .capt-marquee::before, .capt-marquee::after {
          content: '';
          position: absolute; top: 0; bottom: 0; width: 60px;
          z-index: 2; pointer-events: none;
        }
        .capt-marquee::before { left: 0; background: linear-gradient(90deg, #052E20, transparent); }
        .capt-marquee::after  { right: 0; background: linear-gradient(270deg, #052E20, transparent); }
        .capt-track {
          display: inline-flex;
          gap: 48px;
          animation: capt-scroll 90s linear infinite;
          white-space: nowrap;
          will-change: transform;
        }
        .capt-marquee:hover .capt-track { animation-play-state: paused; }
        .capt-item { display: inline-block; opacity: 0.85; }
        .capt-bullet {
          color: #D4B85A; margin: 0 24px; opacity: 0.6;
          display: inline-block;
        }
      `}</style>
      <div className="capt-marquee" role="marquee" aria-label="Captain's bulletin">
        <div className="capt-track">
          {items.map((line, i) => (
            <span key={i} className="capt-item">
              {line}
              <span className="capt-bullet">◆</span>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
