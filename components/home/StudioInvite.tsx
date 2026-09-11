'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE STUDIO — an invitation, not a section.
// ───────────────────────────────────────────────────────────────────────────
// Full-bleed sage, the one band on the homepage in the Studio's own colour, so
// it reads as a door to somewhere separate. Toni's painted lion drifts in it
// exactly as it does on /studio — the room's mark, carried out to the street.
//
// It was a centred flex row that wrapped on a phone into a centred bottle over
// left-aligned text. Now: words left, lion right; on a phone the lion takes a
// band of its own under the words, running off the right edge — the same rule
// /studio uses, clear of every word rather than behind them.

const SAGE = '#B0C18E'
const INK  = '#052E20'
const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function StudioInvite() {
  const ref = useRef<HTMLAnchorElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: .15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Link ref={ref} href="/studio" className={`si ${visible ? 'is-in' : ''}`} aria-label="The Studio — step inside">
      <style dangerouslySetInnerHTML={{ __html: `
        .si { display: block; text-decoration: none; background: ${SAGE}; color: ${INK}; overflow: hidden; position: relative; }
        .si-inner { position: relative; max-width: 1180px; margin: 0 auto; padding: 96px 24px 100px; min-height: 420px; }
        .si-rise { opacity: 0; transform: translateY(22px); }
        .si.is-in .si-rise { animation: si-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes si-rise { to { opacity: 1; transform: none } }
        .si-copy { position: relative; z-index: 1; max-width: 560px; }
        .si-eyebrow { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; opacity: .65; }
        .si-mark { display: block; width: min(460px, 78vw); height: auto; margin: 14px 0 0; }
        .si-lede { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 26px 0 0; max-width: 480px; }
        .si-cta { display: inline-block; margin-top: 28px; font-family: ${MONO}; font-size: 12px; letter-spacing: .12em;
                  text-transform: uppercase; border-bottom: 1px solid ${INK}; padding-bottom: 6px; }
        .si-cta span { display: inline-block; transition: transform .35s ease; }
        .si:hover .si-cta span { transform: translateX(7px); }
        @keyframes si-drift { from { transform: rotate(6deg) translateY(0) } to { transform: rotate(3deg) translateY(-16px) } }
        .si-lion { position: absolute; right: 4%; top: 50%; transform: translateY(-50%); width: clamp(200px, 20vw, 280px); height: auto;
                   pointer-events: none; opacity: 0; transition: opacity 1.2s ease .2s; }
        .si.is-in .si-lion { opacity: .95; }
        .si-lion img { display: block; width: 100%; height: auto; animation: si-drift 7s ease-in-out infinite alternate;
                       transition: transform .8s cubic-bezier(.16,.84,.44,1); }
        @media (max-width: 860px) {
          .si-inner { padding: 72px 20px 0; min-height: 0; }
          .si-lion { position: static; transform: none; display: block; margin: 16px -10vw 0 auto; width: 56vw; max-width: 260px; }
          .si-lion img { animation: none; transform: rotate(5deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .si-rise, .si.is-in .si-rise { opacity: 1; transform: none; animation: none; }
          .si-lion img { animation: none; }
        }
      ` }} />
      <div className="si-inner">
        <div className="si-copy">
          <div className="si-eyebrow si-rise">Floor 2 · Phòng Studio</div>
          {/* The Studio's own wordmark rather than the words set in the club's
              face — it is a mark, and the room has one. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/studio/studio-wordmark.png" alt="The Studio" className="si-mark si-rise" style={{ animationDelay: '.06s' }} />
          <p className="si-lede si-rise" style={{ animationDelay: '.14s' }}>
            A quarterly rotating art space. Each exhibition is made with the artist,
            and each one leaves a whisky behind.
          </p>
          <span className="si-cta si-rise" style={{ animationDelay: '.22s' }}>Step inside <span>→</span></span>
        </div>
        <div className="si-lion" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/studio/rizal/00-lion.png" alt="" loading="lazy" />
        </div>
      </div>
    </Link>
  )
}
