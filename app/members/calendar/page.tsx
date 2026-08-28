'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

interface Booking { booking_id: string; booking_date: string; start_time: string | null; end_time: string | null; session_label: string | null; space: string | null; party_size: number | null; status: string }
interface Fixture { id: string; sport: string; title: string; date: string; location: string | null; signed_up: boolean }
interface Entry { id: string; title: string; entry_date: string; start_time: string | null; end_time: string | null; session_label: string | null; space: string | null; kind: string }

type Item =
  | { kind: 'booking'; day: string; label: string; sub: string; tint: string; ring: string }
  | { kind: 'fixture'; day: string; label: string; sub: string; tint: string; ring: string; signed: boolean; href: string }
  | { kind: 'entry'; day: string; label: string; sub: string; tint: string; ring: string }

const SPORT_RING: Record<string, string> = { golf: '#5E6650', tennis: '#28483C', padel: '#B2AA98', hash: '#E5D4C2', other: '#D4B85A' }
const KIND_LABEL: Record<string, string> = { closure: 'Club closed', private_hire: 'Private event', supplier: 'Distiller visit', tasting: 'Tasting', event: 'Event', other: 'Notice' }

const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const vnDayOf = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const hm = (t: string | null) => t ? t.slice(0, 5) : ''
const timeStr = (start: string | null, end: string | null, session: string | null) =>
  start ? (end ? `${hm(start)}–${hm(end)}` : hm(start)) : (session ? session[0].toUpperCase() + session.slice(1) : 'All day')

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function MemberCalendarPage() {
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
    for (const b of bookings) push({ kind: 'booking', day: b.booking_date, label: b.space || 'Your booking', sub: timeStr(b.start_time, b.end_time, b.session_label), tint: 'rgba(212,184,90,0.16)', ring: '#D4B85A' })
    for (const f of fixtures) { const ring = SPORT_RING[f.sport] || SPORT_RING.other; push({ kind: 'fixture', day: vnDayOf(f.date), label: f.title, sub: (f.sport[0].toUpperCase() + f.sport.slice(1)) + (f.signed_up ? ' · you’re in' : ''), tint: 'rgba(94,102,80,0.22)', ring, signed: f.signed_up, href: '/members/events' }) }
    for (const e of entries) push({ kind: 'entry', day: e.entry_date, label: e.title, sub: KIND_LABEL[e.kind] || 'Notice', tint: 'rgba(178,170,152,0.16)', ring: '#B2AA98' })
    return m
  }, [bookings, fixtures, entries])

  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const step = (n: number) => setCursor(c => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  const agenda = useMemo(() => Object.keys(byDay).filter(d => d >= iso(new Date(Date.UTC(cursor.y, cursor.m, 1))) && d <= iso(new Date(Date.UTC(cursor.y, cursor.m + 1, 0)))).sort(), [byDay, cursor])

  return (
    <div style={{ minHeight: '100vh', background: '#052E20', padding: '92px 20px 90px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mc-wrap { max-width: 960px; margin: 0 auto; }
        .mc-back { font-family:${MONO}; font-size:11px; color:#B2AA98; text-decoration:none; letter-spacing:0.06em; }
        .mc-back:hover { color:#D4B85A; }
        .mc-bar { display:flex; align-items:center; gap:12px; margin:20px 0 16px; flex-wrap:wrap; }
        .mc-h1 { font-family:${SERIF}; font-size:28px; color:#E5D4C2; margin:0; }
        .mc-nav { display:flex; gap:6px; margin-left:auto; }
        .mc-btn { font-family:${MONO}; font-size:11px; background:rgba(229,212,194,0.04); color:#B2AA98; border:1px solid rgba(229,212,194,0.14); border-radius:6px; padding:6px 12px; cursor:pointer; }
        .mc-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
        .mc-dow { font-family:${MONO}; font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:#7E7864; text-align:center; padding-bottom:4px; }
        .mc-cell { min-height:96px; border:1px solid rgba(229,212,194,0.08); border-radius:8px; padding:6px; display:flex; flex-direction:column; gap:3px; overflow:hidden; }
        .mc-cell.dim { opacity:0.35; }
        .mc-cell.today { border-color:rgba(212,184,90,0.5); background:rgba(212,184,90,0.05); }
        .mc-num { font-family:${MONO}; font-size:10px; color:#B2AA98; }
        .mc-chip { font-family:${MONO}; font-size:9px; line-height:1.25; color:#E5D4C2; border-left:2px solid; border-radius:3px; padding:2px 5px; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mc-agenda { margin-top:30px; }
        .mc-arow { display:flex; gap:12px; padding:10px 0; border-top:1px solid rgba(229,212,194,0.08); }
        .mc-adate { font-family:${MONO}; font-size:10px; color:#D4B85A; width:64px; flex-shrink:0; }
        .mc-aitem { font-family:${MONO}; font-size:11px; color:#E5D4C2; }
        .mc-asub { color:#B2AA98; }
        .mc-legend { display:flex; gap:14px; flex-wrap:wrap; margin:8px 0 0; font-family:${MONO}; font-size:9px; color:#B2AA98; }
        .mc-dot { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; vertical-align:middle; }
        .mc-empty { font-family:${MONO}; font-size:12px; color:#B2AA98; opacity:0.6; font-style:italic; padding:20px 0; }
        @media (max-width:640px){ .mc-cell { min-height:64px; } .mc-chip { font-size:8px; } }
      ` }} />
      <div className="mc-wrap">
        <Link href="/members" className="mc-back">← Back to dashboard</Link>
        <div className="mc-bar">
          <h1 className="mc-h1">{monthLabel}</h1>
          <div className="mc-nav">
            <button className="mc-btn" onClick={() => step(-1)}>←</button>
            <button className="mc-btn" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })}>Today</button>
            <button className="mc-btn" onClick={() => step(1)}>→</button>
          </div>
        </div>
        <div className="mc-legend">
          <span><span className="mc-dot" style={{ background: '#D4B85A' }} />Your bookings</span>
          <span><span className="mc-dot" style={{ background: '#5E6650' }} />Fixtures</span>
          <span><span className="mc-dot" style={{ background: '#B2AA98' }} />House events</span>
        </div>

        <div className="mc-grid" style={{ marginTop: 14 }}>
          {DOW.map(d => <div key={d} className="mc-dow">{d}</div>)}
          {grid.map(d => {
            const k = iso(d)
            const inMonth = d.getUTCMonth() === cursor.m
            const items = byDay[k] || []
            return (
              <div key={k} className={'mc-cell' + (inMonth ? '' : ' dim') + (k === todayIso ? ' today' : '')}>
                <span className="mc-num">{d.getUTCDate()}</span>
                {items.slice(0, 4).map((it, i) => it.kind === 'fixture'
                  ? <Link key={i} href={it.href} className="mc-chip" style={{ background: it.tint, borderLeftColor: it.ring }}>{it.signed ? '✓ ' : ''}{it.label}</Link>
                  : <span key={i} className="mc-chip" style={{ background: it.tint, borderLeftColor: it.ring }}>{it.label}</span>)}
                {items.length > 4 && <span className="mc-num" style={{ opacity: 0.6 }}>+{items.length - 4}</span>}
              </div>
            )
          })}
        </div>

        {/* Agenda for the month */}
        <div className="mc-agenda">
          {loading ? <div className="mc-empty">Loading…</div>
            : agenda.length === 0 ? <div className="mc-empty">Nothing on your calendar this month.</div>
            : agenda.map(day => (
              <div key={day} className="mc-arow">
                <div className="mc-adate">{new Date(day + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>
                <div style={{ flex: 1 }}>
                  {(byDay[day] || []).map((it, i) => (
                    <div key={i} className="mc-aitem" style={{ marginBottom: 3 }}>
                      {it.kind === 'fixture' && it.signed ? '✓ ' : ''}{it.label} <span className="mc-asub">· {it.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
