'use client'

import { useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// THE HOMEPAGE HERO — set to the /studio benchmark, with the house's own ink.
// ───────────────────────────────────────────────────────────────────────────
// It was centred, small and grey: the last section still in the old style,
// and the first one anybody sees. Now the words sit left and large, the girl
// still perches on the title, and the empty half holds a still life of the
// club's own illustrations — the lion at rest, the butler's tray, a cigar,
// sunglasses, a room key — each drifting a little, like things left on a
// table at the end of a good evening.
//
// The membership card lands among them, across the seam into Member Benefits
// (it lives in that section, so it can overlap both).

const INK_OBJECTS: { src: string; w: string; top: string; left: string; rot: number; dur: number; delay: number; z?: number }[] = [
  { src: 'lion-lounging', w: '62%', top: '30%', left: '20%', rot: -4, dur: 9,   delay: .20, z: 2 },
  { src: 'butler-tray',   w: '30%', top: '0%',  left: '64%', rot: 8,  dur: 7.5, delay: .35 },
  { src: 'cigar',         w: '24%', top: '6%',  left: '14%', rot: -18, dur: 8,  delay: .45 },
  { src: 'sunglasses',    w: '26%', top: '74%', left: '6%',  rot: 12, dur: 6.5, delay: .55 },
  { src: 'key',           w: '15%', top: '70%', left: '80%', rot: -24, dur: 7, delay: .65 },
]

export default function HomeHero({ onEthos }: { onEthos: () => void }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t) }, [])

  return (
    <section className={`hh ${entered ? 'is-in' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .hh { max-width: 1180px; margin: 0 auto; padding: 150px 24px 150px; color: var(--trc-green-deep); }
        .hh-grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 40px; align-items: center; }
        .hh-rise { opacity: 0; transform: translateY(22px); }
        .hh.is-in .hh-rise { animation: hh-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes hh-rise { to { opacity: 1; transform: none } }
        .hh-eyebrow { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 10.5px; letter-spacing: .22em;
                      text-transform: uppercase; opacity: .6; }
        /* the girl sits on the top of the title, as she always has */
        .hh-girl { display: block; width: clamp(130px, 13vw, 190px); height: auto; margin: 26px 0 -0.16em 0.1em;
                   position: relative; z-index: 1; }
        .hh-title { font-family: 'Rampant Sans', serif; font-weight: 400; margin: 0;
                    font-size: clamp(52px, 7.4vw, 108px); line-height: .92; }
        .hh-sub { font-family: 'Rampant Sans', serif; font-size: clamp(20px, 3vw, 32px); opacity: .55; margin-top: 16px; }
        .hh-lede { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 14px; line-height: 2;
                   max-width: 520px; margin: 26px 0 0; }
        .hh-cta { display: inline-block; margin-top: 34px; background: none; border: none; padding: 0 0 6px; cursor: pointer;
                  color: var(--trc-green-deep); border-bottom: 1px solid var(--trc-green-deep);
                  font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
        .hh-cta span { display: inline-block; transition: transform .35s ease; }
        .hh-cta:hover span { transform: translateX(7px); }

        /* the still life */
        .hh-still { position: relative; aspect-ratio: 1 / 0.92; }
        .hh-obj { position: absolute; height: auto; opacity: 0; pointer-events: auto;
                  transition: opacity 1s ease; filter: drop-shadow(6px 10px 10px rgba(5,46,32,.14)); }
        .hh.is-in .hh-obj { opacity: 1; }
        .hh-obj img { display: block; width: 100%; height: auto;
                      animation: hh-drift var(--dur) ease-in-out infinite alternate;
                      transition: transform .5s cubic-bezier(.16,.84,.44,1); }
        .hh-obj:hover img { transform: rotate(calc(var(--rot) * -1)) scale(1.06); }
        @keyframes hh-drift {
          from { transform: rotate(var(--rot)) translateY(0); }
          to   { transform: rotate(calc(var(--rot) + 3deg)) translateY(-10px); }
        }

        @media (max-width: 900px) {
          .hh { padding: 110px 20px 150px; }
          .hh-grid { grid-template-columns: 1fr; gap: 26px; }
          .hh-still { width: 100%; max-width: 440px; margin: 0 auto; aspect-ratio: 1 / 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hh-rise, .hh.is-in .hh-rise { opacity: 1; transform: none; animation: none; }
          .hh-obj img { animation: none; transform: rotate(var(--rot)); }
        }
      ` }} />

      <div className="hh-grid">
        <div>
          <div className="hh-eyebrow hh-rise">The Rampant Club · Sài Gòn</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/whisky-girl-opt.png" alt="" aria-hidden="true" className="hh-girl hh-rise"
               style={{ animationDelay: '.05s' }} />
          <h1 className="hh-title hh-rise" style={{ animationDelay: '.08s' }}>A Members&rsquo;<br />Club</h1>
          <div className="hh-sub hh-rise" style={{ animationDelay: '.16s' }}>For kindred spirits</div>
          <p className="hh-lede hh-rise" style={{ animationDelay: '.24s' }}>
            Scottish heritage meets Vietnamese soul in a five-storey townhouse in the heart of Sài Gòn.
            Whisky, art, conversation, and community &mdash; sustained by its members, not for profit.
          </p>
          <button type="button" className="hh-cta hh-rise" style={{ animationDelay: '.32s' }} onClick={onEthos}>
            Club Ethos <span>→</span>
          </button>
        </div>

        <div className="hh-still" aria-hidden="true">
          {INK_OBJECTS.map(o => (
            <div key={o.src} className="hh-obj"
                 style={{ width: o.w, top: o.top, left: o.left, zIndex: o.z ?? 1, transitionDelay: `${o.delay}s`,
                          ['--rot' as string]: `${o.rot}deg`, ['--dur' as string]: `${o.dur}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ink/${o.src}.webp`} alt="" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
