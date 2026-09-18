'use client'

import { useEffect, useMemo, useState } from 'react'
import { timeRemaining } from '@/lib/tet/queries'
import { MONO, GOLD } from '@/components/public/kit'
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
// It draws once when it comes into view and then holds still. Motion that
// repeats is a distraction on a page somebody is reading to spend money.
// ═══════════════════════════════════════════════════════════════════════════

const CREAM = '#E5D4C2'
const SAGE = '#7AB07A'

interface Stop {
  at: number        // 0–1 along the rail
  date: string
  title: string
  note: string
  tone: string
  lead: boolean     // the next gate that can still be missed
  showDays: boolean
}

export default function TetTimeline({ cd, t, locale }: {
  cd: Countdown
  t: (en: string, vn: string) => string
  locale: string
}) {
  const fetchedAt = useMemo(() => Date.now(), [])
  const [now, setNow] = useState(fetchedAt)
  const [drawn, setDrawn] = useState(false)
  const [el, setEl] = useState<HTMLDivElement | null>(null)

  // Days, not seconds: the ticking clock lives one section up, and two of them
  // on one screen is a countdown competing with itself.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setDrawn(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setDrawn(true); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [el])

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

  return (
    <section className="pk-wrap" style={{ paddingTop: 12, paddingBottom: 8 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tl { position: relative; padding: 104px 0 108px; }
        .tl-rail, .tl-run { position: absolute; left: 0; top: 50%; height: 1px; }
        .tl-rail { right: 0; background: rgba(229,212,194,.16); }
        .tl-run  { background: ${GOLD}; transform-origin: left center;
                   transform: scaleX(0); transition: transform 1.6s cubic-bezier(.16,.84,.44,1) .1s; }
        .tl.is-drawn .tl-run { transform: scaleX(1); }

        .tl-window { position: absolute; top: 50%; left: 0; margin-top: -34px;
                     opacity: 0; transition: opacity .6s ease 1.1s; }
        .tl.is-drawn .tl-window { opacity: 1; }
        .tl-window-inner { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                           text-transform: uppercase; color: ${GOLD}; white-space: nowrap;
                           padding-left: 2px; }
        .tl-window-bars { position: absolute; top: 50%; height: 9px; margin-top: -4px;
                          border-left: 1px solid ${GOLD}; border-right: 1px solid ${GOLD};
                          opacity: 0; transition: opacity .5s ease 1.2s; }
        .tl.is-drawn .tl-window-bars { opacity: .55; }

        .tl-stop { position: absolute; top: 50%; transform: translate(-50%, -50%);
                   opacity: 0; transition: opacity .8s ease, transform .8s cubic-bezier(.16,.84,.44,1); }
        .tl.is-drawn .tl-stop { opacity: 1; }
        .tl-dot { width: 7px; height: 7px; border-radius: 50%; background: ${CREAM}; }
        .tl-dot.is-lead { width: 13px; height: 13px; box-shadow: 0 0 0 6px rgba(212,184,90,.14); }

        /* 186px, not 164: "31 thg 10, 2026 · 43 ngày" wrapped the day count
           onto its own line in Vietnamese, which read as a stray number. */
        .tl-label { position: absolute; left: 50%; width: 186px; }
        .tl-label.is-up   { bottom: 24px; }
        .tl-label.is-down { top: 24px; }
        .tl-title { font-family: 'Rampant Sans', Georgia, serif; font-size: 17px; line-height: 1.15; }
        .tl-date  { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .06em; opacity: .62; margin-top: 6px; }
        .tl-note  { font-family: ${MONO}; font-size: 9.5px; opacity: .4; margin-top: 5px; line-height: 1.7; }
        .tl-today { position: absolute; left: 0; top: 50%; transform: translateY(-50%); }
        .tl-today-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(229,212,194,.4);
                        transform: translateX(-50%); }
        .tl-today-cap { position: absolute; top: 20px; left: -2px; font-family: ${MONO};
                        font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
                        color: rgba(229,212,194,.45); white-space: nowrap; }

        /* A phone cannot hold five labels on one horizontal line without
           turning them into confetti, so the rail stands up and runs down the
           side — same order, same proportions gone, but nothing overlaps. */
        @media (max-width: 860px) {
          .tl { padding: 0; }
          .tl-rail { left: 3px; right: auto; top: 6px; bottom: 6px; width: 1px; height: auto; }
          /* The gold length means "this much of the run is still yours to
             decide in" — and that only reads while the stops are placed by
             real distance. Stacked evenly down a phone they are not, so the
             segment would be measuring nothing. The lead dot carries the gold
             on its own here. */
          .tl-run, .tl-window, .tl-window-bars { display: none; }
          .tl-stop { position: relative; top: auto; left: auto !important; transform: none;
                     display: grid; grid-template-columns: 14px 1fr; gap: 16px;
                     align-items: start; padding: 18px 0; }
          .tl-dot { margin-top: 6px; }
          .tl-dot.is-lead { margin-top: 3px; margin-left: -3px; }
          .tl-label { position: static; width: auto; transform: none !important; }
          .tl-today { position: relative; display: grid; grid-template-columns: 14px 1fr;
                      gap: 16px; transform: none; padding-bottom: 2px; }
          .tl-today-dot { transform: none; margin-top: 6px; }
          .tl-today-cap { position: static; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tl-run { transition: none; transform: scaleX(1); }
          .tl-stop, .tl-window, .tl-window-bars { transition: none; opacity: 1; }
        }
      ` }} />

      <div ref={setEl} className={`tl${drawn ? ' is-drawn' : ''}`}>
        <div className="tl-rail" />
        <div className="tl-run" style={{ width: `${windowPct}%` }} />

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

        {stops.map((s, i) => (
          <div
            key={s.date + s.title}
            className="tl-stop"
            style={{ left: `${Math.min(100, Math.max(0, s.at * 100))}%` }}
          >
            <div className={`tl-dot${s.lead ? ' is-lead' : ''}`} style={{ background: s.tone }} />
            {/* Labels alternate above and below so neighbouring gates never
                share a line, and the last one is pulled in off the right edge
                instead of hanging past it. */}
            <div
              className={`tl-label ${i % 2 ? 'is-down' : 'is-up'}`}
              style={{ transform: s.at > 0.9 ? 'translateX(-88%)' : s.at < 0.1 ? 'translateX(-12%)' : 'translateX(-50%)' }}
            >
              <div className="tl-title" style={{ color: s.lead ? GOLD : CREAM }}>{s.title}</div>
              <div className="tl-date">
                {fmt(s.date)}
                {s.showDays && (
                  rem(s.date).past
                    ? <span style={{ opacity: .7 }}> · {t('passed', 'đã qua')}</span>
                    : <span style={{ opacity: .7 }}> · {days(s.date)} {t('days', 'ngày')}</span>
                )}
              </div>
              <div className="tl-note">{s.note}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
