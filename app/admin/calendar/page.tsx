'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { vnDateString } from '@/lib/datetime'

// Admin / Floor / Calendar
//
// Weekly grid of bookings. Filter by space, navigate by week. Each
// booking card links to the member profile + has a Start visit button
// that fires the tap-to-start RPC and routes to the visit detail.

interface Booking {
  booking_id: string
  member_no: string
  member_name: string
  member_nickname: string | null
  member_tier: string
  member_status: string
  booking_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string
  party_size: number
  notes: string | null
  status: 'pending' | 'confirmed' | 'arrived' | 'cancelled' | 'no_show'
  linked_visit_id: string | null
  arrived_at: string | null
  created_at: string
}

const SPACES = ['Library Bar', 'The Studio', 'The Dining Room', 'The Rampant Room', 'Source & Origin Lab', 'Sports Club']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfWeek(d: Date): Date {
  const day = d.getDay()  // 0=Sun
  const diff = day === 0 ? -6 : 1 - day  // shift to Monday
  const out = new Date(d)
  out.setDate(d.getDate() + diff)
  out.setHours(0, 0, 0, 0)
  return out
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d); out.setDate(d.getDate() + n); return out
}
// Vietnam-time YYYY-MM-DD. Browser-local "today" can disagree with
// Saigon "today" for several hours each morning if the user (or the
// server during SSR) sits outside GMT+7. vnDateString pins to the
// Vietnamese calendar regardless of viewer location.
const isoDate = vnDateString

export default function CalendarPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [spaceFilter, setSpaceFilter] = useState<string>('All spaces')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const from = isoDate(days[0])
  const to   = isoDate(days[6])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (spaceFilter !== 'All spaces') params.set('space', spaceFilter)
    fetch(`/api/admin/bookings?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setBookings(d.bookings || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [from, to, spaceFilter])
  useEffect(() => { load() }, [load])

  const byDay = useMemo(() => {
    const m: Record<string, Booking[]> = {}
    for (const d of days) m[isoDate(d)] = []
    for (const b of bookings) {
      const k = b.booking_date
      if (m[k]) m[k].push(b)
    }
    return m
  }, [bookings, days])

  const startVisit = async (booking: Booking) => {
    if (starting) return
    setStarting(booking.booking_id)
    try {
      const r = await fetch('/api/admin/visits/start-from-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: booking.member_no }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not start visit')
      router.push(`/admin/mis/visits/${j.visit_id}`)
    } catch (e) {
      alert((e as Error).message)
      setStarting(null)
    }
  }

  const weekLabel = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const todayIso = isoDate(new Date())

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Floor</div>
          <h1 style={pageTitle}>Calendar</h1>
          <p style={lede}>
            Who&apos;s coming in, which room, when. Tap-to-start auto-links the booking when a member scans their card; from here you can start the visit manually if needed.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <Link href="/admin/bookings/new" style={btnPrimary}>＋ New booking</Link>
        </div>
      </div>

      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}>←</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ ...navBtn, padding: '6px 14px' }}>This week</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}>→</button>
          <div style={weekLabelStyle}>{weekLabel}</div>
        </div>
        <select value={spaceFilter} onChange={e => setSpaceFilter(e.target.value)} style={spaceSelect}>
          <option value="All spaces">All spaces</option>
          {SPACES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : (
        <div style={weekGrid}>
          {days.map((d, i) => {
            const iso = isoDate(d)
            const isToday = iso === todayIso
            const dayBookings = byDay[iso] || []
            return (
              <div key={iso} style={{ ...dayCol, ...(isToday ? dayColToday : null) }}>
                <div style={{ ...dayHeader, ...(isToday ? dayHeaderToday : null) }}>
                  <span style={dayName}>{DAYS[i]}</span>
                  <span style={dayDate}>{d.getDate()}</span>
                </div>
                {dayBookings.length === 0 ? (
                  <div style={emptyDay}>—</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayBookings.map(b => (
                      <div key={b.booking_id} style={{ ...bookingCard, borderLeftColor: statusColor(b.status) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                          <span style={bookingTime}>{fmtTime(b)}</span>
                          <span style={statusPill(b.status)}>{b.status}</span>
                        </div>
                        <Link href={`/admin/mis/${b.member_no}`} style={bookingMember}>{b.member_name}</Link>
                        <div style={bookingMeta}>
                          {b.space} · {b.party_size}p
                        </div>
                        {b.notes && <div style={bookingNotes}>{b.notes}</div>}
                        {b.status === 'arrived' && b.linked_visit_id && (
                          <Link href={`/admin/mis/visits/${b.linked_visit_id}`} style={visitLink}>
                            → open visit
                          </Link>
                        )}
                        {(b.status === 'confirmed' || b.status === 'pending') && iso === todayIso && (
                          <button
                            onClick={() => startVisit(b)}
                            disabled={starting === b.booking_id}
                            style={startBtn}
                          >
                            {starting === b.booking_id ? 'Starting…' : '◉ Start visit'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function fmtTime(b: Booking): string {
  if (b.start_time) {
    const time = b.start_time.slice(0, 5)
    if (b.end_time) return `${time}–${b.end_time.slice(0, 5)}`
    return time
  }
  if (b.session_label) return b.session_label
  return '—'
}

function statusColor(s: Booking['status']): string {
  return s === 'arrived' ? '#7AB07A'
       : s === 'confirmed' ? '#D4B85A'
       : s === 'pending' ? '#9E8FC4'
       : s === 'cancelled' ? '#7E7864'
       : '#C27070'  // no_show
}
function statusPill(s: Booking['status']): React.CSSProperties {
  const c = statusColor(s)
  return {
    background: c + '14', color: c, border: `1px solid ${c}50`,
    borderRadius: 3, padding: '1px 6px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 8,
    letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  }
}

const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 24,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const toolbar: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 14, gap: 12, flexWrap: 'wrap',
}
const navBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, cursor: 'pointer',
}
const weekLabelStyle: React.CSSProperties = {
  marginLeft: 14,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const spaceSelect: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, outline: 'none',
}
const weekGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
}
const dayCol: React.CSSProperties = {
  background: 'rgba(229,212,194,0.02)',
  border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 6, padding: 8,
  minHeight: 300,
}
const dayColToday: React.CSSProperties = {
  background: 'rgba(212,184,90,0.05)',
  border: '1px solid rgba(212,184,90,0.25)',
}
const dayHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  padding: '4px 6px 10px', borderBottom: '1px solid rgba(229,212,194,0.08)',
  marginBottom: 8,
}
const dayHeaderToday: React.CSSProperties = {
  borderBottom: '1px solid rgba(212,184,90,0.40)',
}
const dayName: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const dayDate: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 600,
  color: '#E5D4C2',
}
const emptyDay: React.CSSProperties = {
  textAlign: 'center', padding: '20px 0',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', opacity: 0.5,
}
const bookingCard: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderLeft: '2px solid',
  borderRadius: 4, padding: '8px 10px',
  display: 'flex', flexDirection: 'column', gap: 4,
}
const bookingTime: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', fontWeight: 600, letterSpacing: '0.04em',
}
const bookingMember: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 13, fontWeight: 500,
  color: '#E5D4C2', textDecoration: 'none',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const bookingMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const bookingNotes: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.7, lineHeight: 1.4,
  overflow: 'hidden', textOverflow: 'ellipsis',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
}
const visitLink: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7AB07A', textDecoration: 'none', letterSpacing: '0.06em',
  marginTop: 4,
}
const startBtn: React.CSSProperties = {
  background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 3,
  padding: '4px 8px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 9, letterSpacing: '0.08em', cursor: 'pointer',
  marginTop: 4,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '10px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textDecoration: 'none', textAlign: 'center',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
