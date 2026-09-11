'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// TONIGHT — a split-flap departures board.
// ───────────────────────────────────────────────────────────────────────────
// It was a small bordered card, stacked in the middle of the page with
// everything else. Now it is an object with a character of its own: the old
// Solari board from a station concourse. The greeting runs across the top in
// big flaps, Sài Gòn's clock sits in the corner and flips each minute, and
// every pick is a departure — what it is, the selection, the remarks, a status
// lamp. When it scrolls into view the letters shuffle and settle.
//
// The same component serves the homepage (cream) and the member dashboard
// (green, with the clubhouse count as a third row). The board is its own dark
// object either way; `bg` only sets how it sits on the page.

interface TonightData {
  date: string
  dram:  { label: string; note: string; curated: boolean }
  vinyl: { label: string; note: string; curated: boolean }
  quote: string
  quote_curated: boolean
}

const SAIGON_TZ = 'Asia/Ho_Chi_Minh'
const MONO  = "'Google Sans Code', 'DM Mono', monospace"
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function saigonNow(): { hour: number; hhmm: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: SAIGON_TZ,
  }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return { hour: parseInt(p.hour, 10) || 0, hhmm: `${p.hour}:${p.minute}` }
}

function greetingFor(hour: number, t: (en: string, vn: string) => string): string {
  if (hour < 5)  return t('After hours in Sài Gòn', 'Sài Gòn về khuya')
  if (hour < 11) return t('Good morning, Sài Gòn', 'Chào buổi sáng, Sài Gòn')
  if (hour < 17) return t('Good afternoon, Sài Gòn', 'Chào buổi chiều, Sài Gòn')
  if (hour < 21) return t('Good evening, Sài Gòn', 'Chào buổi tối, Sài Gòn')
  return t('Tonight in Sài Gòn', 'Đêm nay tại Sài Gòn')
}

// ── One line of flaps ─────────────────────────────────────────────────────
// Words wrap as whole groups, so a long selection folds onto a second row of
// flaps instead of shrinking to nothing on a phone. The shuffle writes straight
// to the cells (no re-render per frame); only cells whose letter CHANGED
// shuffle, so the clock flips its minute without the hour flickering.
function Flaps({ text, run, size, stagger = 1 }: {
  text: string; run: boolean; size: string; stagger?: number
}) {
  const up = text.toUpperCase()
  const cells = useRef<(HTMLSpanElement | null)[]>([])
  const shown = useRef<string>('')

  useEffect(() => {
    if (!run) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const chars = [...up]
    const prev = [...shown.current]
    shown.current = up
    if (reduce) { chars.forEach((c, i) => { const el = cells.current[i]; if (el) el.textContent = c }); return }
    let frame = 0
    const settleAt = chars.map((c, i) => (c === ' ' || c === prev[i]) ? 0 : 5 + Math.round(i * stagger * 0.9))
    const id = setInterval(() => {
      frame++
      let busy = false
      chars.forEach((c, i) => {
        const el = cells.current[i]
        if (!el) return
        if (frame >= settleAt[i]) { if (el.textContent !== c) { el.textContent = c; el.parentElement?.classList.remove('is-flip'); void el.offsetWidth; el.parentElement?.classList.add('is-flip') } return }
        busy = true
        el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      })
      if (!busy) clearInterval(id)
    }, 55)
    return () => clearInterval(id)
  }, [run, up, stagger])

  let k = -1
  const words = up.split(' ')
  return (
    <span className="tb-flaps" style={{ fontSize: size }} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} className="tb-word" aria-hidden="true">
          {[...w].map(c => { k++; const idx = k
            return <span key={idx} className="tb-cell"><span ref={el => { cells.current[idx] = el }}>{c}</span></span> })}
          {wi < words.length - 1 && (() => { k++; const idx = k
            return <span key="sp" className="tb-cell tb-blank"><span ref={el => { cells.current[idx] = el }}>{' '}</span></span> })()}
        </span>
      ))}
    </span>
  )
}

export default function TonightPanel({
  showClubhouseCount = false,
  bg = 'cream',
}: {
  showClubhouseCount?: boolean
  bg?: 'cream' | 'green'  // cream = light page bg (homepage), green = dark (members)
}) {
  const { t } = useLang()
  const [data, setData] = useState<TonightData | null>(null)
  const [now, setNow] = useState<{ hour: number; hhmm: string } | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [run, setRun] = useState(false)
  const board = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNow(saigonNow())
    const tick = setInterval(() => setNow(saigonNow()), 15_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    fetch('/api/tonight').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  useEffect(() => {
    if (!showClubhouseCount) return
    const load = () => fetch('/api/members/clubhouse-now')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCount(d.count) })
      .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [showClubhouseCount])

  // The board shuffles when it first comes into view, not on page load.
  useEffect(() => {
    const el = board.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRun(true); io.disconnect() } }, { threshold: .3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const greeting = now ? greetingFor(now.hour, t) : t('Tonight in Sài Gòn', 'Đêm nay tại Sài Gòn')

  const rows: { tag: string; value: string; remark: string; status: string; lamp: string }[] = [
    { tag: t('Dram of the day', 'Ly của ngày'), value: data?.dram.label || '', remark: data?.dram.note || '',
      status: t('Pouring', 'Đang rót'), lamp: '#E8B64A' },
    { tag: t('On the turntable', 'Trên mâm đĩa'), value: data?.vinyl.label || '', remark: data?.vinyl.note || '',
      status: t('Playing', 'Đang phát'), lamp: '#E8B64A' },
  ]
  if (showClubhouseCount && count !== null) {
    rows.push({
      tag: t('Clubhouse', 'Câu lạc bộ'),
      value: count === 0 ? t('Quiet', 'Yên tĩnh') : t(`${count} ${count === 1 ? 'member' : 'members'} in`, `${count} thành viên`),
      remark: t('Tapped within the last 4 hours', 'Quẹt thẻ trong 4 giờ qua'),
      status: t('Live', 'Trực tiếp'), lamp: '#6FCF8E',
    })
  }

  return (
    <div ref={board} className={`tb tb-on-${bg}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tb {
          container-type: inline-size;
          position: relative; width: 100%; box-sizing: border-box;
          background: linear-gradient(180deg, #121714, #0B0F0D);
          border-radius: 12px; padding: 22px 24px 18px;
          color: #EDE3CF;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), inset 0 2px 0 rgba(255,255,255,.05);
        }
        .tb-on-cream { box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 28px 60px rgba(5,46,32,.28), 0 6px 14px rgba(5,46,32,.18); }
        .tb-on-green { box-shadow: inset 0 0 0 1px rgba(229,212,194,.08), 0 24px 48px rgba(0,0,0,.35); }
        /* the four screws of a board bolted to a wall */
        .tb::before, .tb::after {
          content: ''; position: absolute; top: 9px; width: 5px; height: 5px; border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #5a5f58, #1b1f1c);
        }
        .tb::before { left: 9px; } .tb::after { right: 9px; }

        .tb-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .tb-eyebrow { font-family: ${MONO}; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: #D4B85A; }
        .tb-clock { display: flex; align-items: center; gap: 10px; font-family: ${MONO}; font-size: 10px; letter-spacing: .22em; color: rgba(237,227,207,.55); }

        .tb-flaps { display: inline-flex; flex-wrap: wrap; row-gap: .18em; font-family: 'Rampant Sans', serif; line-height: 1; }
        .tb-word { display: inline-flex; }
        .tb-cell {
          position: relative; display: inline-flex; align-items: center; justify-content: center;
          width: .74em; height: 1.28em; margin-right: .08em; border-radius: .08em;
          background: linear-gradient(180deg, #232925 0%, #1b201d 49.5%, #141816 50.5%, #181c1a 100%);
          box-shadow: inset 0 -1px 0 rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.03);
          color: #EDE3CF; overflow: hidden;
        }
        .tb-cell::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,.75); }
        .tb-cell > span { transform: translateY(.04em); }
        .tb-blank { background: linear-gradient(180deg, #1a1f1c 0%, #161a18 49.5%, #111412 50.5%, #141715 100%); }
        .tb-cell.is-flip > span { animation: tb-flip .16s ease-out; }
        @keyframes tb-flip { from { transform: translateY(.04em) scaleY(.35); filter: brightness(1.6); } to { transform: translateY(.04em) scaleY(1); } }

        .tb-greeting { margin: 18px 0 20px; }
        .tb-cols, .tb-row {
          display: grid; grid-template-columns: 150px minmax(0, 1fr) minmax(0, 250px) 110px;
          gap: 18px; align-items: center;
        }
        .tb-cols { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .22em; text-transform: uppercase;
                   color: rgba(237,227,207,.38); padding-bottom: 8px; border-bottom: 1px solid rgba(237,227,207,.1); }
        .tb-row { padding: 14px 0; border-bottom: 1px solid rgba(237,227,207,.07); }
        .tb-row:last-child { border-bottom: none; }
        .tb-tag { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: #D4B85A; }
        .tb-remark { font-family: ${MONO}; font-size: 12px; line-height: 1.6; color: rgba(237,227,207,.72); }
        .tb-status { display: flex; align-items: center; gap: 8px; font-family: ${MONO}; font-size: 10.5px;
                     letter-spacing: .16em; text-transform: uppercase; }
        .tb-lamp { width: 8px; height: 8px; border-radius: 50%; animation: tb-lamp 2.6s ease-in-out infinite; }
        @keyframes tb-lamp { 0%,100% { opacity: 1 } 50% { opacity: .35 } }

        /* Narrow boards — a phone, or half of the member dashboard — stack each
           departure: tag and status on one line, the flaps, then the remarks. */
        @container (max-width: 720px) {
          .tb-cols { display: none; }
          .tb-row { grid-template-columns: 1fr auto; row-gap: 10px; }
          .tb-row .tb-value { grid-column: 1 / -1; order: 2; }
          .tb-row .tb-remark { grid-column: 1 / -1; order: 3; }
          .tb-row .tb-status { order: 1; justify-self: end; }
          .tb-row .tb-tag { order: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tb-lamp, .tb-cell.is-flip > span { animation: none; }
        }
      ` }} />

      <div className="tb-head">
        <div className="tb-eyebrow">◆ {t('Tonight at The Rampant Club', 'Tối nay tại The Rampant Club')}</div>
        <div className="tb-clock">
          SÀI GÒN
          <Flaps text={now?.hhmm || '--:--'} run={run} size="17px" stagger={0.4} />
        </div>
      </div>

      <div className="tb-greeting">
        <Flaps text={greeting} run={run} size="clamp(22px, 3.6cqi, 38px)" stagger={0.6} />
      </div>

      <div className="tb-cols" aria-hidden="true">
        <span>{t('Tonight', 'Tối nay')}</span>
        <span>{t('Selection', 'Lựa chọn')}</span>
        <span>{t('Remarks', 'Ghi chú')}</span>
        <span>{t('Status', 'Trạng thái')}</span>
      </div>

      {rows.map(r => (
        <div key={r.tag} className="tb-row">
          <div className="tb-tag">{r.tag}</div>
          <div className="tb-value">
            {r.value
              ? <Flaps text={r.value} run={run} size="clamp(15px, 2cqi, 21px)" />
              : <span className="tb-remark">…</span>}
          </div>
          <div className="tb-remark">{r.remark}</div>
          <div className="tb-status">
            <span className="tb-lamp" style={{ background: r.lamp, boxShadow: `0 0 10px ${r.lamp}` }} />
            {r.status}
          </div>
        </div>
      ))}
    </div>
  )
}
