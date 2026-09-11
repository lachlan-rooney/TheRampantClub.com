'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { typeLabel, TYPE_RING } from '@/lib/fixtures'
import { useLang, pick, type Lang } from '@/lib/lang'
import MemberPage from '@/components/MemberPage'
import { CreamInk } from '@/components/public/CreamInk'

// The member's month: their bookings, the club's fixtures and the house events,
// set as a month view with hairline rules rather than boxes, the month itself as
// the heading in the display face, and the month's agenda beneath. On a phone the
// squares are too small for words, so each day shows coloured marks and the
// agenda carries the detail.

const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const INK = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Booking { booking_id: string; booking_date: string; start_time: string | null; end_time: string | null; session_label: string | null; space: string | null; party_size: number | null; status: string }
interface Fixture { id: string; type: string; title: string; date: string; location: string | null; signed_up: boolean }
interface Entry { id: string; title: string; title_vn?: string | null; entry_date: string; start_time: string | null; end_time: string | null; session_label: string | null; space: string | null; kind: string }

type Item =
  | { kind: 'booking'; day: string; label: string; sub: string; tint: string; ring: string }
  | { kind: 'fixture'; day: string; label: string; sub: string; tint: string; ring: string; signed: boolean; href: string }
  | { kind: 'entry'; day: string; label: string; sub: string; tint: string; ring: string }


const KIND_LABEL: Record<string, string> = { closure: 'Club closed', private_hire: 'Private event', supplier: 'Distiller visit', tasting: 'Tasting', event: 'Event', other: 'Notice' }
const KIND_LABEL_VN: Record<string, string> = { closure: 'CLB đóng cửa', private_hire: 'Sự kiện riêng', supplier: 'Nhà chưng cất ghé thăm', tasting: 'Nếm thử', event: 'Sự kiện', other: 'Thông báo' }
// Display-only Vietnamese for the stored session labels; a custom label stays as typed.
const SESSION_VN: Record<string, string> = { early: 'Buổi chiều', evening: 'Buổi tối', late: 'Khuya' }

// The fixture colours from lib/fixtures, lifted where the original is too dark
// to read on the bottle green (tennis, hash).
const RING_ON_GREEN: Record<string, string> = { ...TYPE_RING, golf: '#A9BB84', tennis: '#7FB3A0' }
const FIXTURE_MARK = '#A9BB84'
const HOUSE_MARK = '#B2AA98'

const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const vnDayOf = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const hm = (t: string | null) => t ? t.slice(0, 5) : ''
const timeStr = (start: string | null, end: string | null, session: string | null, t: (en: string, vn: string) => string) =>
  start ? (end ? `${hm(start)}–${hm(end)}` : hm(start)) : (session ? t(session[0].toUpperCase() + session.slice(1), SESSION_VN[session.toLowerCase()] || session[0].toUpperCase() + session.slice(1)) : t('All day', 'Cả ngày'))

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_VN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

// The agenda's date, split so the day can be set large: the same formatter as
// before (weekday short + day numeric, en-GB / vi-VN), read as parts.
const agendaParts = (day: string, lang: Lang) => {
  const parts = new Intl.DateTimeFormat(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric' })
    .formatToParts(new Date(day + 'T12:00:00+07:00'))
  return {
    day: parts.find(p => p.type === 'day')?.value || '',
    weekday: parts.find(p => p.type === 'weekday')?.value || '',
  }
}

export default function MemberCalendarPage() {
  const { t, lang } = useLang()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } }) // m: 0-11
  const [bookings, setBookings] = useState<Booking[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  // 6-week grid starting on the Monday on/before the 1st.
  const grid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1))
    const dow = (first.getUTCDay() + 6) % 7 // Mon=0
    const start = new Date(first); start.setUTCDate(1 - dow)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d })
  }, [cursor])
  const rangeFrom = iso(grid[0]), rangeTo = iso(grid[41])
  const todayIso = iso(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/members/calendar?from=${rangeFrom}&to=${rangeTo}`, { cache: 'no-store' })
      const j = await r.json()
      setBookings(j.bookings || []); setFixtures(j.fixtures || []); setEntries(j.entries || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [rangeFrom, rangeTo])
  useEffect(() => { load() }, [load])

  const byDay = useMemo(() => {
    const m: Record<string, Item[]> = {}
    const push = (it: Item) => { (m[it.day] ||= []).push(it) }
    for (const b of bookings) push({ kind: 'booking', day: b.booking_date, label: b.space || t('Your booking', 'Đặt chỗ của bạn'), sub: timeStr(b.start_time, b.end_time, b.session_label, t), tint: 'rgba(212,184,90,0.16)', ring: GOLD })
    for (const f of fixtures) { const ring = RING_ON_GREEN[f.type] || RING_ON_GREEN.other; push({ kind: 'fixture', day: vnDayOf(f.date), label: f.title, sub: typeLabel(f.type, lang) + (f.signed_up ? t(' · you’re in', ' · bạn đã đăng ký') : ''), tint: 'rgba(169,187,132,0.12)', ring, signed: f.signed_up, href: '/members/events' }) }
    for (const e of entries) push({ kind: 'entry', day: e.entry_date, label: pick(lang, e.title, e.title_vn), sub: t(KIND_LABEL[e.kind] || 'Notice', KIND_LABEL_VN[e.kind] || 'Thông báo'), tint: 'rgba(178,170,152,0.12)', ring: HOUSE_MARK })
    return m
  }, [bookings, fixtures, entries, t, lang])

  const monthRaw = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const monthLabel = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)
  const step = (n: number) => setCursor(c => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  const agenda = useMemo(() => Object.keys(byDay).filter(d => d >= iso(new Date(Date.UTC(cursor.y, cursor.m, 1))) && d <= iso(new Date(Date.UTC(cursor.y, cursor.m + 1, 0)))).sort(), [byDay, cursor])

  return (
    <MemberPage title={monthLabel} subtitle="" art={<CreamInk name="butler-tray" width="100%" rot={4} dur={9} />}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mc-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-top: 0; }
        .mc-legend { display:flex; gap: 24px; flex-wrap: wrap; font-family:${MONO}; font-size: 12px; letter-spacing: .04em; }
        .mc-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:8px; vertical-align: 1px; }
        .mc-nav { display:flex; align-items: center; gap: 14px; }
        .mc-arrow { width: 44px; height: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
                    background: none; color: ${CREAM}; border: 1px solid rgba(229,212,194,.3); cursor: pointer;
                    font-family:${MONO}; font-size: 15px; transition: border-color .25s ease, color .25s ease, transform .35s ease; }
        .mc-arrow:hover { border-color: ${GOLD}; color: ${GOLD}; }
        .mc-arrow.prev:hover { transform: translateX(-3px); }
        .mc-arrow.next:hover { transform: translateX(3px); }
        .mc-today { background: none; border: none; border-bottom: 1px solid currentColor; padding: 0 0 5px; margin: 0 6px; cursor: pointer;
                    color: ${CREAM}; font-family:${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
        .mc-today:hover { color: ${GOLD}; }

        /* ── the month: hairlines, not boxes ── */
        .mc-dows { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); margin-top: 34px; }
        .mc-dow { font-family:${MONO}; font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; opacity: .7; padding: 0 0 12px 12px; }
        .mc-grid { display:grid; grid-template-columns: repeat(7, minmax(0, 1fr));
                   border-top: 1px solid rgba(229,212,194,.2); border-left: 1px solid rgba(229,212,194,.12); }
        .mc-cell { min-height: 124px; padding: 10px 10px 10px 12px; display:flex; flex-direction:column; gap: 5px; min-width: 0;
                   border-right: 1px solid rgba(229,212,194,.12); border-bottom: 1px solid rgba(229,212,194,.12); }
        .mc-cell.dim > * { opacity: .3; }
        .mc-cell.weekend { background: rgba(229,212,194,.025); }
        .mc-cell.today { background: rgba(212,184,90,.07); }
        .mc-num { font-family:${SERIF}; font-size: 24px; line-height: 1; margin-bottom: 4px; align-self: flex-start;
                  min-width: 32px; height: 32px; display: inline-flex; align-items: center; }
        .mc-cell.today .mc-num { justify-content: center; border-radius: 50%; background: ${GOLD}; color: ${INK}; padding: 0 4px; }
        .mc-chip { display: block; font-family:${MONO}; font-size: 11px; line-height: 1.35; color:${CREAM}; border-left: 2px solid;
                   border-radius: 2px; padding: 3px 6px; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
                   transition: background-color .2s ease; }
        a.mc-chip:hover { background-color: rgba(212,184,90,.2) !important; }
        .mc-more { font-family:${MONO}; font-size: 11px; opacity: .75; padding-left: 8px; }
        .mc-marks { display: none; gap: 4px; flex-wrap: wrap; }
        .mc-mark { width: 6px; height: 6px; border-radius: 50%; }

        /* ── the month's agenda ── */
        .mc-agenda { margin-top: 64px; }
        .mc-arow { display: grid; grid-template-columns: 124px minmax(0, 1fr); gap: 36px; padding: 26px 0; border-bottom: 1px solid rgba(229,212,194,.14); }
        .mc-arow:first-child { border-top: 1px solid rgba(229,212,194,.14); }
        .mc-aday { font-family:${SERIF}; font-size: clamp(48px, 5vw, 64px); line-height: .86; }
        .mc-awd { font-family:${MONO}; font-size: 12.5px; letter-spacing: .16em; text-transform: uppercase; color:${GOLD}; margin-top: 10px; }
        .mc-aitem { display: grid; grid-template-columns: 10px minmax(0, 1fr); gap: 14px; align-items: baseline; padding: 4px 0 10px; }
        .mc-aitem + .mc-aitem { border-top: 1px dashed rgba(229,212,194,.12); padding-top: 12px; }
        .mc-aitem .mc-dot { margin: 0; transform: translateY(-3px); }
        .mc-alabel { font-family:${SERIF}; font-size: clamp(22px, 2.4vw, 30px); line-height: 1.1; color:${CREAM}; text-decoration: none; }
        a.mc-alabel:hover { color:${GOLD}; }
        .mc-asub { font-family:${MONO}; font-size: 12px; letter-spacing: .08em; margin-top: 6px; opacity: .8; }
        .mc-empty { font-family:${MONO}; font-size: 13px; line-height: 1.9; opacity: .8; padding: 22px 0; }

        @media (max-width: 860px) {
          .mc-bar { flex-direction: column-reverse; align-items: flex-start; gap: 18px; }
        }
        @media (max-width: 640px) {
          .mc-dows { margin-top: 26px; }
          .mc-dow { padding: 0 0 10px; text-align: center; font-size: 10.5px; letter-spacing: .08em; }
          .mc-cell { min-height: 58px; padding: 6px 2px 8px; align-items: center; gap: 4px; }
          .mc-num { font-size: 17px; min-width: 26px; height: 26px; justify-content: center; margin: 0; align-self: center; }
          .mc-chip, .mc-more { display: none; }
          .mc-marks { display: flex; justify-content: center; }
          .mc-agenda { margin-top: 44px; }
          .mc-arow { grid-template-columns: 64px minmax(0, 1fr); gap: 18px; padding: 22px 0; }
          .mc-aday { font-size: 44px; }
          .mc-awd { font-size: 11.5px; }
          .mc-alabel { font-size: 22px; }
        }
        @media (prefers-reduced-motion: reduce) { .mc-arrow { transition: none; } }
      ` }} />
        <div className="mc-bar">
          <div className="mc-legend">
            <span><span className="mc-dot" style={{ background: GOLD }} />{t('Your bookings', 'Đặt chỗ của bạn')}</span>
            <span><span className="mc-dot" style={{ background: FIXTURE_MARK }} />{t('Fixtures', 'Thi đấu')}</span>
            <span><span className="mc-dot" style={{ background: HOUSE_MARK }} />{t('House events', 'Sự kiện tại CLB')}</span>
          </div>
          <div className="mc-nav">
            <button className="mc-arrow prev" onClick={() => step(-1)} aria-label={t('Previous month', 'Tháng trước')}>←</button>
            <button className="mc-today" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })}>{t('Today', 'Hôm nay')}</button>
            <button className="mc-arrow next" onClick={() => step(1)} aria-label={t('Next month', 'Tháng sau')}>→</button>
          </div>
        </div>

        <div className="mc-dows">
          {DOW.map((d, i) => <div key={d} className="mc-dow">{t(d, DOW_VN[i])}</div>)}
        </div>
        <div className="mc-grid">
          {grid.map((d, i) => {
            const k = iso(d)
            const inMonth = d.getUTCMonth() === cursor.m
            const items = byDay[k] || []
            const weekend = i % 7 >= 5
            return (
              <div key={k} className={'mc-cell' + (inMonth ? '' : ' dim') + (weekend ? ' weekend' : '') + (k === todayIso ? ' today' : '')}>
                <span className="mc-num">{d.getUTCDate()}</span>
                {items.slice(0, 4).map((it, i) => it.kind === 'fixture'
                  ? <Link key={i} href={it.href} className="mc-chip" title={it.label} style={{ background: it.tint, borderLeftColor: it.ring }}>{it.signed ? '✓ ' : ''}{it.label}</Link>
                  : <span key={i} className="mc-chip" title={it.label} style={{ background: it.tint, borderLeftColor: it.ring }}>{it.label}</span>)}
                {items.length > 4 && <span className="mc-more">+{items.length - 4}</span>}
                {items.length > 0 && (
                  <span className="mc-marks" aria-hidden="true">
                    {items.slice(0, 4).map((it, i) => <span key={i} className="mc-mark" style={{ background: it.ring }} />)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Agenda for the month */}
        <div className="mc-agenda">
          {loading ? <div className="mc-empty">{t('Loading…', 'Đang tải…')}</div>
            : agenda.length === 0 ? <div className="mc-empty">{t('Nothing on your calendar this month.', 'Tháng này lịch của bạn chưa có gì.')}</div>
            : agenda.map(day => {
              const p = agendaParts(day, lang)
              return (
                <div key={day} className="mc-arow">
                  <div>
                    <div className="mc-aday">{p.day}</div>
                    <div className="mc-awd">{p.weekday}</div>
                  </div>
                  <div>
                    {(byDay[day] || []).map((it, i) => (
                      <div key={i} className="mc-aitem">
                        <span className="mc-dot" style={{ background: it.ring }} />
                        <div>
                          {it.kind === 'fixture'
                            ? <Link href={it.href} className="mc-alabel">{it.signed ? '✓ ' : ''}{it.label}</Link>
                            : <div className="mc-alabel">{it.label}</div>}
                          <div className="mc-asub">{it.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
    </MemberPage>
  )
}
