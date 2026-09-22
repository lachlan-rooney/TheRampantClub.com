'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { timeRemaining } from '@/lib/tet/queries'
import { MONO, GOLD, INK } from '@/components/public/kit'
import type { Countdown } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE RUN TO TẾT — the dates as a distance, not a list.
// ───────────────────────────────────────────────────────────────────────────
// Five rows of "date · N days" is a reference table. It says when things are
// and nothing about how they sit against each other, which is the only part
// that changes what a buyer does today: the casks shut in six weeks, then
// there is nothing to decide for two months, then three things land inside a
// fortnight. A list flattens exactly that.
//
// So: one rail from today to Tết, each gate at its true proportion along it.
// The gold length is the decision window — today to the first gate that can
// still be missed — so the shortening of that segment over the autumn IS the
// urgency, with nothing shouting about it.
//
// Blends and artwork fall on the same date, so they share one marker instead
// of pretending to be two decisions.
//
// ── MOVEMENT AND TOUCH (owner, 2026-09-22: "bring some animation /
// interactivity to this") ─────────────────────────────────────────────────
// It still plays ONCE, but now it plays as a journey instead of a fade:
//   · a pen line runs from Today to Tết at a constant speed, and each gate
//     arrives at the moment the line reaches it — so the gaps are FELT, the
//     long empty stretch across December takes as long as it looks;
//   · each gate's day count runs up as it lands;
//   · the gold window is drawn at the same speed, stopping at the lead gate.
// The only thing that keeps moving is a slow breath on the lead dot — the
// one gate that can still be missed.
//
// And it answers back. Hover a gate (or tap it, or Tab to it and use the
// arrow keys) and the rail fills from Today to that gate, the others step
// back, and it tells you two facts it can compute: days from today, days
// before Tết. Anywhere else on the rail, a hairline follows the pointer with
// the date under it — "what if I leave it until mid-December?" answered by
// pointing. Every figure is arithmetic on the dates; nothing is invented.
// ═══════════════════════════════════════════════════════════════════════════

const CREAM = '#E5D4C2'
const SAGE = '#7AB07A'
/** Seconds for the pen to travel the whole rail. Everything is timed off it. */
const DRAW = 2.2
/** Seconds each day count takes to run up. */
const COUNT = 0.9

interface Stop {
  at: number        // 0–1 along the rail
  date: string
  title: string
  note: string
  tone: string
  lead: boolean     // the next gate that can still be missed
  showDays: boolean
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

export default function TetTimeline({ cd, t, locale }: {
  cd: Countdown
  t: (en: string, vn: string) => string
  locale: string
}) {
  const fetchedAt = useMemo(() => Date.now(), [])
  const [now, setNow] = useState(fetchedAt)
  const [drawn, setDrawn] = useState(false)
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  // Seconds since the rail started drawing; null = not animating (the counts
  // show their real value — which is also what the server renders).
  const [clock, setClock] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const [wide, setWide] = useState(true)
  const stopRefs = useRef<(HTMLDivElement | null)[]>([])

  // Days, not seconds: the ticking clock lives one section up, and two of them
  // on one screen is a countdown competing with itself.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)')
    const read = () => setWide(mq.matches)
    read(); mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  useEffect(() => {
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setDrawn(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setDrawn(true); io.disconnect() }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [el])

  // The counts run up on one animation frame loop, which ends by itself.
  useEffect(() => {
    if (!drawn) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const t0 = performance.now()
    const tick = (ts: number) => {
      const s = (ts - t0) / 1000
      if (s > DRAW + COUNT + 0.2) { setClock(null); return }
      setClock(s); raf = requestAnimationFrame(tick)
    }
    setClock(0); raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [drawn])

  const rem = (iso: string) => timeRemaining(iso, cd.now, now, fetchedAt)
  const days = (iso: string) => rem(iso).days
  const fmt = (iso: string) => new Date(iso + 'T12:00:00+07:00')
    .toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

  // Everything is measured against the distance left to Tết, so the rail
  // shortens from the left as the season closes in.
  const span = Math.max(days(cd.festival_date), 1)
  const sameDay = cd.cutoffs.blend.date === cd.cutoffs.artwork.date

  const raw: Stop[] = [
    {
      at: days(cd.cutoffs.cask.date) / span, date: cd.cutoffs.cask.date,
      title: t('Casks close', 'Đóng đặt thùng'),
      note: t('bottled at Huntly, then shipped', 'đóng chai tại Huntly, rồi vận chuyển'),
      tone: GOLD, lead: false, showDays: true,
    },
    {
      at: days(cd.cutoffs.blend.date) / span, date: cd.cutoffs.blend.date,
      title: sameDay ? t('Blends & artwork', 'Pha trộn & thiết kế') : t('Blends close', 'Đóng đặt pha trộn'),
      note: sameDay
        ? t('last order, and the sleeve signed off', 'hạn đặt cuối, và chốt thiết kế hộp')
        : t('last order', 'hạn đặt cuối'),
      tone: CREAM, lead: false, showDays: true,
    },
    ...(sameDay ? [] : [{
      at: days(cd.cutoffs.artwork.date) / span, date: cd.cutoffs.artwork.date,
      title: t('Artwork agreed', 'Chốt thiết kế'),
      note: t('sleeves go to print', 'hộp vào in'),
      tone: CREAM, lead: false, showDays: true,
    }]),
    {
      at: days(cd.in_hand_date) / span, date: cd.in_hand_date,
      title: t('In your hands', 'Giao tận tay'),
      note: t('before the offices close', 'trước khi các văn phòng nghỉ Tết'),
      tone: SAGE, lead: false, showDays: true,
    },
    {
      at: 1, date: cd.festival_date,
      title: 'Tết Đinh Mùi',
      note: t('the fifteen days', 'mười lăm ngày Tết'),
      tone: GOLD, lead: false, showDays: false,
    },
  ].sort((a, b) => a.at - b.at)

  // The lead is the first gate still ahead — the one thing on this rail that
  // can be lost today. If the casks have shut it moves along on its own.
  const leadIdx = raw.findIndex(s => s.showDays && !rem(s.date).past)
  const stops = raw.map((s, i) => ({ ...s, lead: i === leadIdx }))
  const lead = leadIdx >= 0 ? stops[leadIdx] : null
  const windowPct = Math.max(2, Math.min(100, (lead ? lead.at : 1) * 100))

  // When each gate lands: when the pen reaches it on a wide screen, one after
  // another down the column on a phone.
  const landsAt = (i: number, at: number) => wide ? at * DRAW : 0.25 + i * 0.22
  const shown = (i: number, s: Stop) => {
    const real = days(s.date)
    if (clock === null) return real
    return Math.round(real * ease((clock - landsAt(i, s.at)) / COUNT))
  }

  const active = hover ?? pinned
  const act = active !== null ? stops[active] : null
  const festDays = days(cd.festival_date)

  // The pointer on the rail. Near a gate it becomes that gate; anywhere else
  // it is a date.
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!wide || e.pointerType !== 'mouse') return
    const onStop = (e.target as HTMLElement).closest('[data-stop]')
    if (onStop) { setHover(Number(onStop.getAttribute('data-stop'))); setScrub(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / r.width
    const y = Math.abs(e.clientY - (r.top + r.height / 2))
    if (f < 0 || f > 1 || y > 40) { setScrub(null); setHover(null); return }
    const near = stops.findIndex(s => Math.abs(s.at - f) < 0.025)
    if (near >= 0) { setHover(near); setScrub(null) } else { setHover(null); setScrub(f) }
  }
  const onLeave = () => { setHover(null); setScrub(null) }

  const toggle = (i: number) => setPinned(p => (p === i ? null : i))
  const keys = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); return }
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const j = Math.min(stops.length - 1, Math.max(0, i + d))
    stopRefs.current[j]?.focus(); setPinned(j)
  }

  // The scrubbed date: today plus that fraction of the run.
  const scrubDays = scrub !== null ? Math.round(scrub * span) : 0
  const scrubDate = scrub !== null
    ? new Date(new Date(cd.now).getTime() + scrubDays * 86400_000)
        .toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
    : ''
  const reachPct = act ? Math.min(100, act.at * 100) : scrub !== null ? scrub * 100 : 0

  return (
    <section className="pk-wrap" style={{ paddingTop: 12, paddingBottom: 8 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tl { position: relative; padding: 124px 0 142px; }
        .tl-rail, .tl-run, .tl-pen, .tl-reach { position: absolute; left: 0; top: 50%; height: 1px; }
        .tl-rail { right: 0; background: rgba(229,212,194,.16); }
        /* The pen: a brighter line travelling the whole rail at one speed. */
        .tl-pen  { right: 0; background: rgba(229,212,194,.42); transform-origin: left center;
                   transform: scaleX(0); transition: transform ${DRAW}s linear; }
        .tl.is-drawn .tl-pen { transform: scaleX(1); }
        /* The gold window, drawn at the pen's speed so the two leave together
           and the gold stops where the lead gate is. */
        .tl-run  { background: ${GOLD}; height: 2px; margin-top: -.5px; transform-origin: left center;
                   transform: scaleX(0); transition: transform calc(${DRAW}s * var(--w)) linear; }
        .tl.is-drawn .tl-run { transform: scaleX(1); }
        /* Hovering a gate fills the rail up to it. */
        .tl-reach { background: ${CREAM}; opacity: 0; transition: width .45s cubic-bezier(.16,.84,.44,1), opacity .3s ease; }
        .tl-reach.is-on { opacity: .75; }

        .tl-window { position: absolute; top: 50%; left: 0; margin-top: -34px;
                     opacity: 0; transition: opacity .6s ease; transition-delay: calc(${DRAW}s * var(--w)); }
        .tl.is-drawn .tl-window { opacity: 1; }
        .tl-window-inner { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                           text-transform: uppercase; color: ${GOLD}; white-space: nowrap;
                           padding-left: 2px; }
        .tl-window-bars { position: absolute; top: 50%; height: 9px; margin-top: -4px;
                          border-left: 1px solid ${GOLD}; border-right: 1px solid ${GOLD};
                          opacity: 0; transition: opacity .5s ease; transition-delay: calc(${DRAW}s * var(--w)); }
        .tl.is-drawn .tl-window-bars { opacity: .55; }

        .tl-stop { position: absolute; top: 50%; transform: translate(-50%, -50%); outline: none;
                   cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .tl-stop > * { opacity: 0; transition: opacity .7s ease, transform .7s cubic-bezier(.16,.84,.44,1);
                       transition-delay: var(--d); }
        .tl-label { transform: translate(var(--x), 10px); }
        .tl-label.is-up { transform: translate(var(--x), -10px); }
        .tl.is-drawn .tl-stop > * { opacity: 1; }
        .tl.is-drawn .tl-label { transform: translate(var(--x), 0); }
        /* Once something is chosen, the others step back — quickly, with no delay. */
        .tl.has-active .tl-stop > * { transition-delay: 0s; transition-duration: .3s; }
        .tl.has-active .tl-stop:not(.is-active) > * { opacity: .32; }

        .tl-dot { width: 7px; height: 7px; border-radius: 50%; background: ${CREAM}; position: relative;
                  transform: scale(0); transition: transform .5s cubic-bezier(.34,1.8,.5,1), opacity .3s ease !important;
                  transition-delay: var(--d) !important; }
        .tl.is-drawn .tl-dot { transform: scale(1); }
        .tl.has-active .tl-dot { transition-delay: 0s !important; }
        .tl-stop.is-active .tl-dot { transform: scale(1.7); }
        .tl-dot.is-lead { width: 13px; height: 13px; }
        /* The lead gate breathes: the one thing on this page that keeps moving,
           because it is the one thing that can still be missed. */
        .tl-dot.is-lead::after { content: ''; position: absolute; inset: -6px; border-radius: 50%;
                                 border: 1px solid ${GOLD}; opacity: 0;
                                 animation: tl-breathe 2.8s ease-out infinite; animation-delay: calc(var(--d) + .6s); }
        @keyframes tl-breathe { 0% { transform: scale(.7); opacity: .7 } 100% { transform: scale(2.1); opacity: 0 } }
        .tl-stop:focus-visible .tl-dot { box-shadow: 0 0 0 3px rgba(212,184,90,.5); }

        /* 186px, not 164: "31 thg 10, 2026 · 43 ngày" wrapped the day count
           onto its own line in Vietnamese, which read as a stray number. */
        .tl-label { position: absolute; left: 50%; width: 186px; }
        .tl-label.is-up   { bottom: 24px; }
        .tl-label.is-down { top: 24px; }
        .tl-title { font-family: 'Rampant Sans', Georgia, serif; font-size: 17px; line-height: 1.15; transition: color .3s ease; }
        .tl-date  { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .06em; opacity: .62; margin-top: 6px;
                    font-variant-numeric: tabular-nums; }
        .tl-note  { font-family: ${MONO}; font-size: 9.5px; opacity: .4; margin-top: 5px; line-height: 1.7; }
        /* The two computed facts, opened under the chosen gate. */
        .tl-more  { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.16,.84,.44,1); }
        .tl-more > div { overflow: hidden; font-family: ${MONO}; font-size: 10px; letter-spacing: .04em;
                         color: ${GOLD}; line-height: 1.7; }
        .tl-stop.is-active .tl-more { grid-template-rows: 1fr; }
        .tl-more > div > span { display: block; padding-top: 6px; }

        .tl-today { position: absolute; left: 0; top: 50%; transform: translateY(-50%); }
        .tl-today-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(229,212,194,.55);
                        transform: translateX(-50%); }
        .tl-today-cap { position: absolute; top: 20px; left: -2px; font-family: ${MONO};
                        font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
                        color: rgba(229,212,194,.45); white-space: nowrap; }

        /* The pointer's date, between gates. */
        .tl-cursor { position: absolute; top: 50%; width: 1px; height: 26px; margin-top: -13px;
                     background: ${CREAM}; pointer-events: none; opacity: .8; }
        .tl-cursor-cap { position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
                         font-family: ${MONO}; font-size: 10px; letter-spacing: .06em; white-space: nowrap;
                         color: ${CREAM}; background: ${INK}; padding: 3px 7px; border-radius: 2px;
                         font-variant-numeric: tabular-nums; }
        .tl-hint { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
                   opacity: 0; margin-top: -70px; text-align: left; color: rgba(229,212,194,.35);
                   transition: opacity .8s ease ${DRAW + 0.6}s; }
        .tl.is-drawn + .tl-hint { opacity: 1; }

        /* A phone cannot hold five labels on one horizontal line without
           turning them into confetti, so the rail stands up and runs down the
           side — same order, same proportions gone, but nothing overlaps. */
        @media (max-width: 860px) {
          .tl { padding: 0; }
          .tl-rail { left: 3px; right: auto; top: 6px; bottom: 6px; width: 1px; height: auto; }
          .tl-pen { left: 3px; right: auto; top: 6px; bottom: 6px; width: 1px; height: auto;
                    transform: scaleY(0); transform-origin: center top; transition-duration: 1.6s; }
          .tl.is-drawn .tl-pen { transform: scaleY(1); }
          /* The gold length means "this much of the run is still yours to
             decide in" — and that only reads while the stops are placed by
             real distance. Stacked evenly down a phone they are not, so the
             segment would be measuring nothing. The lead dot carries the gold
             on its own here. */
          .tl-run, .tl-window, .tl-window-bars, .tl-reach, .tl-cursor, .tl-hint { display: none; }
          .tl-stop { position: relative; top: auto; left: auto !important; transform: none;
                     display: grid; grid-template-columns: 14px 1fr; gap: 16px;
                     align-items: start; padding: 18px 0; }
          .tl-dot { margin-top: 6px; }
          .tl-dot.is-lead { margin-top: 3px; margin-left: -3px; }
          .tl-label, .tl-label.is-up { position: static; width: auto; transform: translateX(-14px); }
          .tl.is-drawn .tl-label { transform: none; }
          .tl-today { position: relative; display: grid; grid-template-columns: 14px 1fr;
                      gap: 16px; transform: none; padding-bottom: 2px; }
          .tl-today-dot { transform: none; margin-top: 6px; }
          .tl-today-cap { position: static; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tl-run, .tl-pen, .tl-reach, .tl-stop > *, .tl-dot, .tl-window, .tl-window-bars, .tl-more, .tl-hint
            { transition: none !important; }
          .tl-run, .tl-pen { transform: none !important; }
          .tl-stop > *, .tl-window { opacity: 1; }
          .tl-dot { transform: none; }
          .tl-dot.is-lead::after { animation: none; }
        }
      ` }} />

      <div
        ref={setEl}
        className={`tl${drawn ? ' is-drawn' : ''}${act ? ' has-active' : ''}`}
        style={{ ['--w' as string]: windowPct / 100 }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <div className="tl-rail" />
        <div className="tl-pen" />
        <div className="tl-run" style={{ width: `${windowPct}%` }} />
        <div className={`tl-reach${act || scrub !== null ? ' is-on' : ''}`} style={{ width: `${reachPct}%` }} />

        {/* The gold length, named. It is the only number on this rail that
            means "act", so it is the only one wearing the gold. */}
        {lead && (
          <>
            <div className="tl-window" style={{ width: `${windowPct}%` }}>
              {/* Named, not counted. The number is already in 60px type one
                  section above; printing it twice makes both of them smaller. */}
              <div className="tl-window-inner">
                {t('Your window to decide', 'Thời gian để quyết định')}
              </div>
            </div>
            <div className="tl-window-bars" style={{ left: 0, width: `${windowPct}%` }} />
          </>
        )}

        <div className="tl-today">
          <div className="tl-today-dot" />
          <div className="tl-today-cap">{t('Today', 'Hôm nay')}</div>
        </div>

        {scrub !== null && (
          <div className="tl-cursor" style={{ left: `${scrub * 100}%` }} aria-hidden>
            <div className="tl-cursor-cap">
              {scrubDate} · {scrubDays} {t('days', 'ngày')}
            </div>
          </div>
        )}

        {stops.map((s, i) => {
          const d = days(s.date)
          const past = rem(s.date).past
          const before = festDays - d
          return (
            <div
              key={s.date + s.title}
              ref={n => { stopRefs.current[i] = n }}
              data-stop={i}
              role="button"
              tabIndex={0}
              aria-expanded={active === i}
              className={`tl-stop${active === i ? ' is-active' : ''}`}
              style={{
                left: `${Math.min(100, Math.max(0, s.at * 100))}%`,
                ['--d' as string]: `${landsAt(i, s.at).toFixed(2)}s`,
                ['--x' as string]: s.at > 0.9 ? '-88%' : s.at < 0.1 ? '-12%' : '-50%',
              }}
              onClick={() => toggle(i)}
              onKeyDown={e => keys(e, i)}
              onBlur={() => setPinned(p => (p === i ? null : p))}
            >
              <div className={`tl-dot${s.lead ? ' is-lead' : ''}`} style={{ background: s.tone }} />
              {/* Labels alternate above and below so neighbouring gates never
                  share a line, and the last one is pulled in off the right edge
                  instead of hanging past it. */}
              <div className={`tl-label ${i % 2 ? 'is-down' : 'is-up'}`}>
                <div className="tl-title" style={{ color: s.lead || active === i ? GOLD : CREAM }}>{s.title}</div>
                <div className="tl-date">
                  {fmt(s.date)}
                  {s.showDays && (
                    past
                      ? <span style={{ opacity: .7 }}> · {t('passed', 'đã qua')}</span>
                      : <span style={{ opacity: .7 }}> · {shown(i, s)} {t('days', 'ngày')}</span>
                  )}
                </div>
                <div className="tl-note">{s.note}</div>
                <div className="tl-more" aria-hidden={active !== i}>
                  <div><span>
                    {past
                      ? t('This gate has passed.', 'Mốc này đã qua.')
                      : s.showDays
                        ? t(`${d} days from today · ${before} before Tết`, `${d} ngày từ hôm nay · ${before} ngày trước Tết`)
                        : t(`${d} days from today`, `${d} ngày từ hôm nay`)}
                  </span></div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {wide && (
        <div className="tl-hint" aria-hidden>{t('Point along the line for any date', 'Rê chuột dọc đường để xem ngày')}</div>
      )}
    </section>
  )
}
