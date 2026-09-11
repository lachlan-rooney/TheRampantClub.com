'use client'

import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// A WORLD BEYOND SÀI GÒN — the lobby wall of clocks.
// ───────────────────────────────────────────────────────────────────────────
// The reciprocal network, told the way a grand hotel tells it: a row of
// station clocks hung on a brass rail, west to east, with home in the middle.
// Each one is live. A face goes dark when it is night in that city, and the
// second hand sweeps like a Swiss railway clock — round in 58 seconds, a pause
// at twelve, then the minute hand steps.
//
// NOTHING HERE IS WRITTEN DOWN THAT CAN GO STALE. The old tiles said "GMT" and
// "EST" in September, when London is on BST and New York on EDT. Offsets and
// the "hours behind Sài Gòn" line are worked out from the zone every minute,
// so summer time takes care of itself.
//
// The partner clubs are deliberately NOT named: the full list is for members.

const HOME = { name: 'Sài Gòn', tz: 'Asia/Ho_Chi_Minh', iata: 'SGN' }
// West → east, so the wall reads like a map.
const CITIES = [
  { name: 'New York',  tz: 'America/New_York', iata: 'NYC' },
  { name: 'London',    tz: 'Europe/London',    iata: 'LON' },
  HOME,
  { name: 'Singapore', tz: 'Asia/Singapore',   iata: 'SIN' },
  { name: 'Tokyo',     tz: 'Asia/Tokyo',       iata: 'TYO' },
]

const CREAM = '#E5D4C2'
const GOLD  = '#D4B85A'
const INK   = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO  = "'Google Sans Code', 'DM Mono', monospace"

// Minutes east of UTC for a zone, right now — DST included.
function offsetMinutes(tz: string, at = new Date()): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(at).map(x => [x.type, x.value]))
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return Math.round((wall - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}
const utcLabel = (m: number) => {
  const s = m >= 0 ? '+' : '−', a = Math.abs(m)
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`
}
const relLabel = (m: number) => {
  if (m === 0) return 'Home'
  const h = Math.abs(m) / 60
  const n = Number.isInteger(h) ? String(h) : h.toFixed(1)
  return `${n}h ${m < 0 ? 'behind' : 'ahead'}`
}

interface Hands { h: SVGGElement | null; m: SVGGElement | null; s: SVGGElement | null }

// `target` is the animation loop's slot for this clock's three hands.
function Clock({ i, size, night, iata, target }: {
  i: number; size: number; night: boolean; iata: string; target: Hands
}) {
  const face = night ? '#0B3A2A' : '#F1E6D6'
  const mark = night ? 'rgba(229,212,194,.78)' : INK
  const hand = night ? CREAM : INK
  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} aria-hidden="true"
         style={{ display: 'block', overflow: 'visible', transition: 'filter .8s ease' }}>
      <defs>
        <linearGradient id={`rc-brass-${i}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DD8E" />
          <stop offset=".45" stopColor={GOLD} />
          <stop offset="1" stopColor="#8E7430" />
        </linearGradient>
        <radialGradient id={`rc-glass-${i}`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity={night ? .06 : .35} />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the shadow it casts on the wall */}
      <circle cx="6" cy="10" r="99" fill="rgba(0,0,0,.35)" style={{ filter: 'blur(6px)' }} />
      <circle r="99" fill={`url(#rc-brass-${i})`} />
      <circle r="90" fill={face} style={{ transition: 'fill 1.2s ease' }} />
      <circle r="90" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
      {Array.from({ length: 60 }, (_, k) => {
        const hour = k % 5 === 0
        return <line key={k} x1="0" y1="-84" x2="0" y2={hour ? -66 : -79}
                     stroke={mark} strokeWidth={hour ? 5 : 1.6} transform={`rotate(${k * 6})`} />
      })}
      <text y="36" textAnchor="middle" fontFamily={MONO} fontSize="11" letterSpacing="3"
            fill={mark} opacity=".7">{iata}</text>
      <g ref={el => { target.h = el }}>
        <polygon points="-5,16 5,16 3.6,-50 -3.6,-50" fill={hand} />
      </g>
      <g ref={el => { target.m = el }}>
        <polygon points="-3.8,18 3.8,18 2.4,-78 -2.4,-78" fill={hand} />
      </g>
      <g ref={el => { target.s = el }}>
        <line x1="0" y1="24" x2="0" y2="-58" stroke="#B4452F" strokeWidth="2" />
        <circle cy="-60" r="8" fill="#B4452F" />
      </g>
      <circle r="3.4" fill="#B4452F" />
      <circle r="90" fill={`url(#rc-glass-${i})`} />
    </svg>
  )
}

export default function ReciprocalClocks() {
  const root = useRef<HTMLElement>(null)
  const hands = useRef<Hands[]>(CITIES.map(() => ({ h: null, m: null, s: null })))
  const [visible, setVisible] = useState(false)
  // Server and first paint: no times, all faces day, hands at twelve — no drift.
  const [info, setInfo] = useState<{ off: number; hhmm: string; night: boolean }[] | null>(null)
  const [narrow, setNarrow] = useState(false)
  // The loop reads offsets from here, so a label refresh never restarts it
  // (and never replays the sweep-in).
  const offsRef = useRef<number[] | null>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: .2 })
    io.observe(el)
    const mq = window.matchMedia('(max-width: 760px)')
    const onMq = () => setNarrow(mq.matches)
    onMq(); mq.addEventListener('change', onMq)
    return () => { io.disconnect(); mq.removeEventListener('change', onMq) }
  }, [])

  // Labels: offsets, the digital time, day or night — once a minute is plenty.
  useEffect(() => {
    const read = () => {
      const now = new Date()
      offsRef.current = CITIES.map(c => offsetMinutes(c.tz, now))
      setInfo(CITIES.map(c => {
        const off = offsetMinutes(c.tz, now)
        const local = new Date(now.getTime() + off * 60000)
        const h = local.getUTCHours()
        return {
          off,
          hhmm: `${String(h).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`,
          night: h < 6 || h >= 18,
        }
      }))
    }
    read()
    const id = setInterval(read, 15_000)
    return () => clearInterval(id)
  }, [])

  // The hands: one animation loop, written straight to the SVG — no re-render
  // per frame. On arrival they sweep up from twelve to the real time.
  useEffect(() => {
    if (!visible) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    const ease = (p: number) => 1 - Math.pow(1 - p, 3)
    const tick = () => {
      const offs = offsRef.current
      if (!offs) { raf = requestAnimationFrame(tick); return }
      const now = Date.now()
      const intro = reduce ? 1 : Math.min(1, (performance.now() - start) / 1600)
      const k = ease(intro)
      offs.forEach((off, i) => {
        const ms = now + off * 60000
        const sec = (ms / 1000) % 60
        const min = (ms / 60000) % 60
        const hr = (ms / 3600000) % 12
        // Railway sweep: round in 58.5s, then wait at twelve for the minute to step.
        const sDeg = reduce ? Math.floor(sec) * 6 : Math.min(sec / 58.5, 1) * 360
        const mDeg = Math.floor(min) * 6
        const hDeg = hr * 30
        const h = hands.current[i]
        h.s?.setAttribute('transform', `rotate(${sDeg * k})`)
        h.m?.setAttribute('transform', `rotate(${mDeg * k})`)
        h.h?.setAttribute('transform', `rotate(${hDeg * k})`)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  // On a phone the row opens centred on Sài Gòn, not on New York.
  const wall = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const w = wall.current
    if (!narrow || !w) return
    const home = w.querySelector<HTMLElement>('.rc-home')
    if (home) w.scrollLeft = home.offsetLeft - (w.clientWidth - home.clientWidth) / 2
  }, [narrow])

  const homeOff = info?.[CITIES.indexOf(HOME)].off ?? 0
  const sizeOf = (isHome: boolean) => narrow ? (isHome ? 90 : 76) : (isHome ? 96 : 72)

  return (
    <section ref={root} className={`rc ${visible ? 'is-in' : ''}`} aria-label="Reciprocal clubs — local times">
      <style dangerouslySetInnerHTML={{ __html: `
        .rc { background: ${INK}; color: ${CREAM}; overflow: hidden; }
        .rc-inner { max-width: 1180px; margin: 0 auto; padding: 48px 24px 40px; }
        .rc-rise { opacity: 0; transform: translateY(22px); }
        .rc.is-in .rc-rise { animation: rc-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes rc-rise { to { opacity: 1; transform: none } }
        .rc-wall { position: relative; display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-top: 26px; }
        /* the brass rail they hang from, through every centre */
        .rc-rail {
          position: absolute; left: -24px; right: -24px; top: 48px; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(212,184,90,.55) 12%, rgba(212,184,90,.55) 88%, transparent);
          transform: scaleX(0); transform-origin: center;
          transition: transform 1.4s cubic-bezier(.16,.84,.44,1) .1s;
        }
        .rc.is-in .rc-rail { transform: scaleX(1); }
        .rc-col { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .rc-clock { height: 96px; display: flex; align-items: center; justify-content: center; }
        .rc-city { font-family: ${SERIF}; font-size: 16px; line-height: 1; margin-top: 10px; }
        .rc-home .rc-city { font-size: 19px; color: ${GOLD}; }
        .rc-meta { font-family: ${MONO}; font-size: 10px; opacity: .62; margin-top: 4px; font-variant-numeric: tabular-nums; }
        .rc-time { font-family: ${MONO}; font-size: 11.5px; margin-top: 4px; letter-spacing: .08em; font-variant-numeric: tabular-nums; }
        @media (max-width: 760px) {
          /* A phone gets the wall as a row you swipe along — clocks at a size
             where their faces still read — opening centred on home. */
          .rc-inner { padding: 40px 0 34px; }
          .rc-inner > :not(.rc-wall) { padding-left: 20px; padding-right: 20px; }
          .rc-wall { display: flex; gap: 22px; overflow-x: auto; scroll-snap-type: x mandatory;
                     scrollbar-width: none; margin-top: 22px; padding: 4px 20px 6px; }
          .rc-wall::-webkit-scrollbar { display: none; }
          .rc-rail { display: none; }
          .rc-col { flex: 0 0 auto; width: 104px; scroll-snap-align: center; }
          .rc-clock { height: 92px; }
          .rc-city { font-size: 15px; }
          .rc-home .rc-city { font-size: 17px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rc-rise, .rc.is-in .rc-rise { opacity: 1; transform: none; animation: none; }
          .rc-rail { transition: none; transform: none; }
        }
      ` }} />

      <div className="rc-inner">
        <div className="rc-rise" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase',
                                           color: GOLD, animationDelay: '.05s' }}>
          Câu Lạc Bộ Đối Ứng · Reciprocal Clubs
        </div>
        <h2 className="rc-rise" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(26px, 3.4vw, 42px)',
                                          lineHeight: .98, margin: '16px 0 0', animationDelay: '.1s' }}>
          A World Beyond Sài Gòn
        </h2>
        <p className="rc-rise" style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, maxWidth: 540, margin: '8px 0 0',
                                         opacity: .8, animationDelay: '.16s' }}>
          Bespoke reciprocal access to a vetted network of premier private clubs.
        </p>

        <div ref={wall} className="rc-wall">
          <div className="rc-rail" />
          {CITIES.map((c, i) => {
            const isHome = c === HOME
            const x = info?.[i]
            const rel = x ? x.off - homeOff : null
            return (
              <div key={c.tz} className={`rc-col rc-rise ${isHome ? 'rc-home' : ''}`}
                   style={{ animationDelay: `${0.25 + Math.abs(i - 2) * 0.12}s` }}
                   role="img" aria-label={x ? `${c.name}, ${x.hhmm}` : c.name}>
                <div className="rc-clock">
                  <Clock i={i} size={sizeOf(isHome)} night={!!x?.night} iata={c.iata}
                         target={hands.current[i]} />
                </div>
                <div className="rc-city">{c.name}</div>
                <div className="rc-meta">
                  {x ? (isHome ? `${utcLabel(x.off)} · Home` : `${utcLabel(x.off)} · ${relLabel(rel!)}`) : ' '}
                </div>
                <div className="rc-time">{x ? x.hhmm : ' '}</div>
              </div>
            )
          })}
        </div>

        <p className="rc-rise" style={{ fontFamily: MONO, fontSize: 10.5, opacity: .5, marginTop: 22, animationDelay: '.6s' }}>
          Featured partner cities shown. The full reciprocal list is shared with members upon joining.
        </p>
      </div>
    </section>
  )
}
