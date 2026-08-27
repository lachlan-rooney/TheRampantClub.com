'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast, ConfirmModal } from '@/components/admin/dialogs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { vnDateString } from '@/lib/datetime'
import { useLang } from '@/lib/admin-lang'

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
  tables?: string[]
}

interface CalendarEntry {
  id: string
  title: string
  description: string | null
  entry_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string | null
  attendee: string | null
  kind: string
  visibility: 'member' | 'staff'
  blocks_space: boolean
  tables?: string[]
}

const SPACES = ['Library Bar', 'The Studio', 'The Dining Room', 'The Rampant Room', 'Source & Origin Lab', 'Sports Club']

interface TimeOff {
  id: string
  team_member_id: string | null
  member_name: string | null
  kind: 'annual_leave' | 'public_holiday' | 'sick' | 'unpaid'
  start_date: string
  end_date: string
  note: string | null
}
interface RosterStaff { id: string; display_name: string; role_title?: string | null }

// Colour + label per time-off kind (dot tint on the calendar strip).
const TO_META: Record<TimeOff['kind'], { en: string; vi: string; tint: string; ring: string }> = {
  annual_leave:   { en: 'Annual leave',   vi: 'Nghỉ phép',    tint: 'rgba(122,176,122,0.18)', ring: '#7AB07A' },
  public_holiday: { en: 'Public holiday', vi: 'Ngày lễ',       tint: 'rgba(212,184,90,0.20)',  ring: '#D4B85A' },
  sick:           { en: 'Sick leave',     vi: 'Nghỉ ốm',      tint: 'rgba(194,112,112,0.18)', ring: '#C27070' },
  unpaid:         { en: 'Unpaid / other', vi: 'Không lương',  tint: 'rgba(178,170,152,0.18)', ring: '#B2AA98' },
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
function kindLabel(kind: string, t: (en: string, vi: string) => string): string {
  switch (kind) {
    case 'meeting': return t('Meeting', 'Cuộc họp')
    case 'interview': return t('Interview', 'Phỏng vấn')
    case 'event': return t('Event', 'Sự kiện')
    case 'reminder': return t('Reminder', 'Nhắc nhở')
    case 'closure': return t('Closure', 'Đóng cửa')
    case 'private_hire': return t('Private hire', 'Thuê riêng')
    case 'supplier': return t('Supplier visit', 'Nhà cung cấp ghé')
    case 'tasting': return t('Tasting', 'Nếm thử')
    case 'other': return t('House', 'Nội bộ')
    default: return t('House', 'Nội bộ')
  }
}

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
  const { t } = useLang()
  const router = useRouter()
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [spaceFilter, setSpaceFilter] = useState<string>('All spaces')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CalendarEntry | null>(null)
  const [entryBusy, setEntryBusy] = useState(false)
  // Staff time off / public holidays.
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [roster, setRoster] = useState<RosterStaff[]>([])
  const [showTO, setShowTO] = useState(false)
  const [toBusy, setToBusy] = useState(false)
  const [toForm, setToForm] = useState({ kind: 'annual_leave' as TimeOff['kind'], team_member_id: '', start_date: isoDate(new Date()), end_date: isoDate(new Date()), note: '' })
  const { showToast, toastNode } = useToast()

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const from = isoDate(days[0])
  const to   = isoDate(days[6])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (spaceFilter !== 'All spaces') params.set('space', spaceFilter)
    Promise.all([
      fetch(`/api/admin/bookings?${params}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/admin/calendar-entries?${params}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/admin/time-off?from=${from}&to=${to}`, { cache: 'no-store' }).then(r => r.json()),
    ])
      .then(([b, e, o]) => {
        setBookings(b.bookings || []); setEntries(e.entries || [])
        setTimeOff(o.time_off || []); if (o.roster) setRoster(o.roster)
        setLoading(false)
      })
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

  const byDayEntries = useMemo(() => {
    const m: Record<string, CalendarEntry[]> = {}
    for (const d of days) m[isoDate(d)] = []
    for (const e of entries) { if (m[e.entry_date]) m[e.entry_date].push(e) }
    return m
  }, [entries, days])

  // A range covers a day when start <= day <= end.
  const byDayTimeOff = useMemo(() => {
    const m: Record<string, TimeOff[]> = {}
    for (const d of days) {
      const iso = isoDate(d)
      m[iso] = timeOff.filter(o => o.start_date <= iso && o.end_date >= iso)
    }
    return m
  }, [timeOff, days])

  const saveTimeOff = async () => {
    if (toForm.kind !== 'public_holiday' && !toForm.team_member_id) { showToast(t('Pick a staff member.', 'Chọn một nhân viên.'), 'error'); return }
    if (toForm.end_date < toForm.start_date) { showToast(t('End date is before start date.', 'Ngày kết thúc trước ngày bắt đầu.'), 'error'); return }
    setToBusy(true)
    try {
      const res = await fetch('/api/admin/time-off', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: toForm.kind,
          team_member_id: toForm.kind === 'public_holiday' ? null : toForm.team_member_id,
          start_date: toForm.start_date, end_date: toForm.end_date,
          note: toForm.note || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(`${t('Save failed', 'Lưu thất bại')}: ${j.error || res.status}`, 'error'); return }
      showToast(t('Time off added.', 'Đã thêm nghỉ.'), 'success')
      setShowTO(false)
      setToForm(f => ({ ...f, note: '', team_member_id: '' }))
      load()
    } finally { setToBusy(false) }
  }

  const deleteTimeOff = async (id: string) => {
    const res = await fetch(`/api/admin/time-off/${id}`, { method: 'DELETE' })
    if (!res.ok) { showToast(t('Remove failed', 'Xoá thất bại'), 'error'); return }
    load()
  }

  const startVisit = async (booking: Booking) => {
    if (starting) return
    setStarting(booking.booking_id)
    try {
      const r = await fetch('/api/admin/visits/start-from-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: booking.member_no }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Could not start visit', 'Không thể bắt đầu lượt ghé'))
      router.push(`/admin/mis/visits/${j.visit_id}`)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setStarting(null)
    }
  }

  // Soft-cancel a booking (DELETE → status='cancelled'), then refresh.
  const cancelConfirmed = async () => {
    if (!confirmCancel) return
    setCancelBusy(true)
    const r = await fetch(`/api/admin/bookings/${confirmCancel.booking_id}`, { method: 'DELETE' })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      showToast(j.error || t('Cancel failed', 'Huỷ thất bại'), 'error'); setCancelBusy(false); return
    }
    showToast(t('Booking cancelled.', 'Đã huỷ đặt chỗ.'), 'success')
    setCancelBusy(false); setConfirmCancel(null); load()
  }

  const deleteEntryConfirmed = async () => {
    if (!confirmDeleteEntry) return
    setEntryBusy(true)
    const r = await fetch(`/api/admin/calendar-entries/${confirmDeleteEntry.id}`, { method: 'DELETE' })
    if (!r.ok) { const j = await r.json().catch(() => ({})); showToast(j.error || t('Remove failed', 'Xoá thất bại'), 'error'); setEntryBusy(false); return }
    showToast(t('House entry removed.', 'Đã xoá mục nội bộ.'), 'success')
    setEntryBusy(false); setConfirmDeleteEntry(null); load()
  }

  const weekLabel = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const todayIso = isoDate(new Date())

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>{t('Floor', 'Sàn')}</div>
          <h1 style={pageTitle}>{t('Calendar', 'Lịch')}</h1>
          <p style={lede}>
            {t("Who's coming in, which room, when. Tap-to-start auto-links the booking when a member scans their card; from here you can start the visit manually if needed.", 'Ai đang đến, phòng nào, khi nào. Chạm-để-bắt-đầu tự động liên kết đặt chỗ khi hội viên quét thẻ; từ đây bạn có thể bắt đầu lượt ghé thủ công nếu cần.')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <Link href="/admin/bookings/new" style={btnPrimary}>{t('＋ New booking', '＋ Đặt chỗ mới')}</Link>
          <button onClick={() => setShowTO(true)} style={btnSecondary}>{t('＋ Time off / holiday', '＋ Nghỉ phép / ngày lễ')}</button>
        </div>
      </div>

      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}>←</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ ...navBtn, padding: '6px 14px' }}>{t('This week', 'Tuần này')}</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}>→</button>
          <div style={weekLabelStyle}>{weekLabel}</div>
        </div>
        <select value={spaceFilter} onChange={e => setSpaceFilter(e.target.value)} style={spaceSelect}>
          <option value="All spaces">{t('All spaces', 'Tất cả không gian')}</option>
          {SPACES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : (
        <div style={weekGrid}>
          {days.map((d, i) => {
            const iso = isoDate(d)
            const isToday = iso === todayIso
            const dayBookings = byDay[iso] || []
            const dayEntries = byDayEntries[iso] || []
            const dayTimeOff = byDayTimeOff[iso] || []
            return (
              <div key={iso} style={{ ...dayCol, ...(isToday ? dayColToday : null) }}>
                <div style={{ ...dayHeader, ...(isToday ? dayHeaderToday : null) }}>
                  <span style={dayName}>{DAYS[i]}</span>
                  <span style={dayDate}>{d.getDate()}</span>
                </div>
                {dayTimeOff.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    {dayTimeOff.map(o => {
                      const meta = TO_META[o.kind]
                      return (
                        <div key={o.id} title={o.note || undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, background: meta.tint, borderLeft: `2px solid ${meta.ring}`, borderRadius: 4, padding: '4px 7px' }}>
                          <span style={{ flex: 1, minWidth: 0, fontFamily: "'Google Sans Code', monospace", fontSize: 9.5, color: '#E5D4C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.kind === 'public_holiday' ? (o.note || t(TO_META.public_holiday.en, TO_META.public_holiday.vi)) : (o.member_name || t('Staff', 'Nhân viên'))}
                            <span style={{ color: '#B2AA98', opacity: 0.7 }}> · {t(meta.en, meta.vi)}</span>
                          </span>
                          {o.start_date === iso && (
                            <button onClick={() => deleteTimeOff(o.id)} title={t('Remove', 'Xoá')} style={{ background: 'none', border: 'none', color: '#B2AA98', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {dayBookings.length === 0 && dayEntries.length === 0 && dayTimeOff.length === 0 ? (
                  <div style={emptyDay}>—</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayEntries.map(e => (
                      <div
                        key={e.id}
                        style={{ ...houseCard, position: 'relative' }}
                        onMouseEnter={() => setHoveredEntry(e.id)}
                        onMouseLeave={() => setHoveredEntry(h => h === e.id ? null : h)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                          <span style={houseTime}>{fmtEntryTime(e, t)}</span>
                          {e.visibility === 'staff'
                            ? <span style={staffBadge}>{t('STAFF ONLY', 'CHỈ NHÂN VIÊN')}</span>
                            : <span style={memberBadge}>{t('MEMBER', 'HỘI VIÊN')}</span>}
                        </div>
                        <div style={houseTitle}>{e.title}</div>
                        {e.attendee && <div style={{ ...houseMeta, color: '#D4B85A' }}>{t('with', 'với')} {e.attendee}</div>}
                        <div style={houseMeta}>
                          {kindLabel(e.kind, t)}{e.space ? ` · ${e.space}` : ''}
                          {e.space && e.blocks_space && (e.tables && e.tables.length > 0 ? ` · ${e.tables.join(', ')}` : ` · ${t('closed', 'đóng cửa')}`)}
                        </div>
                        {e.description && <div style={bookingNotes}>{e.description}</div>}

                        {hoveredEntry === e.id && (
                          <div style={tooltip} onMouseEnter={() => setHoveredEntry(e.id)}>
                            <div style={tipMember}>{e.title}</div>
                            <div style={tipMeta}>{kindLabel(e.kind, t)} · {e.visibility === 'staff' ? t('Staff-only', 'Chỉ nhân viên') : t('Member-visible', 'Hội viên thấy được')}</div>
                            <div style={tipRow}>
                              {fmtEntryTime(e, t)}{e.space ? ` · ${e.space}` : ''}
                              {e.space && e.blocks_space && (e.tables && e.tables.length > 0 ? ` · ${e.tables.join(', ')}` : ` · ${t('room closed', 'phòng đóng cửa')}`)}
                            </div>
                            <div style={tipNotesLabel}>{t('Details', 'Chi tiết')}</div>
                            <div style={tipNotesBox}>{e.description && e.description.trim() ? e.description : t('No description on this entry.', 'Không có mô tả cho mục này.')}</div>
                          </div>
                        )}

                        <div style={cardActions}>
                          <Link href={`/admin/bookings/new?entry=${e.id}`} style={cardActionLink}>{t('Edit', 'Sửa')}</Link>
                          <button onClick={() => setConfirmDeleteEntry(e)} style={cardActionBtn}>{t('Remove', 'Xoá')}</button>
                        </div>
                      </div>
                    ))}
                    {dayBookings.map(b => (
                      <div
                        key={b.booking_id}
                        style={{ ...bookingCard, borderLeftColor: statusColor(b.status), position: 'relative' }}
                        onMouseEnter={() => setHovered(b.booking_id)}
                        onMouseLeave={() => setHovered(h => h === b.booking_id ? null : h)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                          <span style={bookingTime}>{fmtTime(b)}</span>
                          <span style={statusPill(b.status)}>{b.status}</span>
                        </div>
                        <Link href={`/admin/mis/${b.member_no}`} style={bookingMember}>{b.member_name}</Link>
                        <div style={bookingMeta}>
                          {b.space} · {b.party_size}p
                        </div>
                        {b.tables && b.tables.length > 0 && (
                          <div style={bookingTables}>{b.tables.join(' · ')}</div>
                        )}
                        {b.notes && <div style={bookingNotes}>{b.notes}</div>}

                        {hovered === b.booking_id && (
                          <div style={tooltip} onMouseEnter={() => setHovered(b.booking_id)}>
                            <div style={tipMember}>
                              {b.member_name}{b.member_nickname ? ` “${b.member_nickname}”` : ''}
                            </div>
                            <div style={tipMeta}>{b.member_tier} · {b.member_no}</div>
                            <div style={tipRow}>{fmtTime(b)} · {b.space} · {b.party_size}p · <span style={{ color: statusColor(b.status) }}>{b.status}</span></div>
                            {b.tables && b.tables.length > 0 && <div style={tipRow}>{t('Tables', 'Bàn')}: {b.tables.join(', ')}</div>}
                            <div style={tipNotesLabel}>{t('Comments', 'Ghi chú')}</div>
                            <div style={tipNotesBox}>{b.notes && b.notes.trim() ? b.notes : t('No comments on this booking.', 'Không có ghi chú cho đặt chỗ này.')}</div>
                          </div>
                        )}
                        {b.status === 'arrived' && b.linked_visit_id && (
                          <Link href={`/admin/mis/visits/${b.linked_visit_id}`} style={visitLink}>
                            {t('→ open visit', '→ mở lượt ghé')}
                          </Link>
                        )}
                        {(b.status === 'confirmed' || b.status === 'pending') && iso === todayIso && (
                          <button
                            onClick={() => startVisit(b)}
                            disabled={starting === b.booking_id}
                            style={startBtn}
                          >
                            {starting === b.booking_id ? t('Starting…', 'Đang bắt đầu…') : t('◉ Start visit', '◉ Bắt đầu lượt ghé')}
                          </button>
                        )}
                        {b.status !== 'cancelled' && (
                          <div style={cardActions}>
                            <Link href={`/admin/bookings/${b.booking_id}/edit`} style={cardActionLink}>{t('Edit', 'Sửa')}</Link>
                            <button onClick={() => setConfirmCancel(b)} style={cardActionBtn}>{t('Cancel', 'Huỷ')}</button>
                          </div>
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

      <ConfirmModal
        open={!!confirmCancel}
        eyebrow={t('⚠ CANCEL BOOKING', '⚠ HUỶ ĐẶT CHỖ')}
        title={t('Cancel this booking?', 'Huỷ đặt chỗ này?')}
        subject={confirmCancel ? `${confirmCancel.member_name} · ${confirmCancel.booking_date}` : ''}
        body={t("Marks the booking cancelled (soft-cancel) — it leaves the active calendar. Can't be undone from here.", 'Đánh dấu đặt chỗ đã huỷ (huỷ mềm) — nó rời khỏi lịch đang hoạt động. Không thể hoàn tác từ đây.')}
        confirmLabel={t('Cancel booking', 'Huỷ đặt chỗ')}
        busyLabel={t('Cancelling…', 'Đang huỷ…')}
        busy={cancelBusy}
        tone="danger"
        onConfirm={cancelConfirmed}
        onCancel={() => { if (!cancelBusy) setConfirmCancel(null) }}
      />
      <ConfirmModal
        open={!!confirmDeleteEntry}
        eyebrow={t('⚠ REMOVE HOUSE ENTRY', '⚠ XOÁ MỤC NỘI BỘ')}
        title={t('Remove this entry?', 'Xoá mục này?')}
        subject={confirmDeleteEntry ? `${confirmDeleteEntry.title} · ${confirmDeleteEntry.entry_date}` : ''}
        body={t('Removes the house entry from the calendar. If it was closing a room, that room becomes bookable again.', 'Xoá mục nội bộ khỏi lịch. Nếu nó đang đóng một phòng, phòng đó sẽ có thể đặt lại.')}
        confirmLabel={t('Remove entry', 'Xoá mục')}
        busyLabel={t('Removing…', 'Đang xoá…')}
        busy={entryBusy}
        tone="danger"
        onConfirm={deleteEntryConfirmed}
        onCancel={() => { if (!entryBusy) setConfirmDeleteEntry(null) }}
      />

      {showTO && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => !toBusy && setShowTO(false)} />
          <div style={{ position: 'relative', width: 'min(440px, 94vw)', background: '#0A3526', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 12, padding: '22px 24px', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
            <div style={eyebrow}>{t('Staff', 'Nhân viên')}</div>
            <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', margin: '4px 0 16px' }}>{t('Add time off / holiday', 'Thêm nghỉ phép / ngày lễ')}</h2>

            <label style={toLabel}>{t('Type', 'Loại')}</label>
            <select value={toForm.kind} onChange={e => setToForm(f => ({ ...f, kind: e.target.value as TimeOff['kind'] }))} style={toInput}>
              {(Object.keys(TO_META) as TimeOff['kind'][]).map(k => <option key={k} value={k}>{t(TO_META[k].en, TO_META[k].vi)}</option>)}
            </select>

            {toForm.kind !== 'public_holiday' && (
              <>
                <label style={toLabel}>{t('Staff member', 'Nhân viên')}</label>
                <select value={toForm.team_member_id} onChange={e => setToForm(f => ({ ...f, team_member_id: e.target.value }))} style={toInput}>
                  <option value="">{t('— select —', '— chọn —')}</option>
                  {roster.map(s => <option key={s.id} value={s.id}>{s.display_name}{s.role_title ? ` · ${s.role_title}` : ''}</option>)}
                </select>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={toLabel}>{t('From', 'Từ')}</label>
                <input type="date" value={toForm.start_date} onChange={e => setToForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))} style={toInput} />
              </div>
              <div>
                <label style={toLabel}>{t('To', 'Đến')}</label>
                <input type="date" value={toForm.end_date} min={toForm.start_date} onChange={e => setToForm(f => ({ ...f, end_date: e.target.value }))} style={toInput} />
              </div>
            </div>

            <label style={toLabel}>{toForm.kind === 'public_holiday' ? t('Holiday name', 'Tên ngày lễ') : t('Note (optional)', 'Ghi chú (tuỳ chọn)')}</label>
            <input value={toForm.note} onChange={e => setToForm(f => ({ ...f, note: e.target.value }))} placeholder={toForm.kind === 'public_holiday' ? t('e.g. National Day', 'vd. Quốc Khánh') : ''} maxLength={200} style={toInput} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowTO(false)} disabled={toBusy} style={btnSecondary}>{t('Cancel', 'Huỷ')}</button>
              <button onClick={saveTimeOff} disabled={toBusy} style={{ ...btnPrimary, opacity: toBusy ? 0.5 : 1 }}>{toBusy ? t('Saving…', 'Đang lưu…') : t('Add', 'Thêm')}</button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </>
  )
}

function fmtEntryTime(e: CalendarEntry, t: (en: string, vi: string) => string): string {
  if (e.start_time) {
    const time = e.start_time.slice(0, 5)
    return e.end_time ? `${time}–${e.end_time.slice(0, 5)}` : time
  }
  if (e.session_label) return e.session_label
  return t('All day', 'Cả ngày')
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

// House entries — gold-tinted, distinct from member bookings (green-ish).
const houseCard: React.CSSProperties = {
  background: 'rgba(212,184,90,0.07)',
  border: '1px solid rgba(212,184,90,0.28)', borderLeft: '3px solid #D4B85A',
  borderRadius: 4, padding: '7px 8px',
}
const houseTime: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', letterSpacing: '0.04em',
}
const houseTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 13, color: '#E5D4C2', marginTop: 3, lineHeight: 1.2,
}
const houseMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', marginTop: 3, letterSpacing: '0.03em',
}
const staffBadge: React.CSSProperties = {
  background: 'rgba(194,112,112,0.14)', color: '#C27070', border: '1px solid rgba(194,112,112,0.45)',
  borderRadius: 3, padding: '1px 6px', fontFamily: "'Google Sans Code', monospace", fontSize: 7.5,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap',
}
const memberBadge: React.CSSProperties = {
  background: 'rgba(122,176,122,0.14)', color: '#7AB07A', border: '1px solid rgba(122,176,122,0.45)',
  borderRadius: 3, padding: '1px 6px', fontFamily: "'Google Sans Code', monospace", fontSize: 7.5,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap',
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
const bookingTables: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 8.5,
  color: '#D4B85A', opacity: 0.85, letterSpacing: '0.03em', marginTop: 2, lineHeight: 1.35,
}
const bookingNotes: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.7, lineHeight: 1.4,
  overflow: 'hidden', textOverflow: 'ellipsis',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
}
// Hover tooltip — fuller booking detail with the comments shown clearly.
const tooltip: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0,
  width: 'max(100%, 240px)', zIndex: 60,
  background: '#0A3526', border: '1px solid rgba(229,212,194,0.20)',
  borderLeft: '3px solid #D4B85A', borderRadius: 6,
  padding: '12px 14px', boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
  display: 'flex', flexDirection: 'column', gap: 4,
}
const tipMember: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2', letterSpacing: '0.02em',
}
const tipMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.75,
}
const tipRow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A', marginTop: 2,
}
const tipNotesLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98',
  letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 8, marginBottom: 2,
}
const tipNotesBox: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2',
  lineHeight: 1.6, whiteSpace: 'pre-wrap',
  background: 'rgba(229,212,194,0.05)', border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 4, padding: '8px 10px', maxHeight: 220, overflowY: 'auto',
}
const visitLink: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7AB07A', textDecoration: 'none', letterSpacing: '0.06em',
  marginTop: 4,
}
const cardActions: React.CSSProperties = {
  display: 'flex', gap: 10, marginTop: 6, paddingTop: 6,
  borderTop: '1px solid rgba(229,212,194,0.06)',
}
const cardActionLink: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', textDecoration: 'none', cursor: 'pointer', letterSpacing: '0.04em',
}
const cardActionBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#C27070', cursor: 'pointer', letterSpacing: '0.04em',
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
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.22)', borderRadius: 6,
  padding: '8px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
}
const toLabel: React.CSSProperties = {
  display: 'block', fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98',
  margin: '0 0 5px',
}
const toInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(5,46,32,0.5)',
  color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 7,
  padding: '9px 12px', fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  outline: 'none', marginBottom: 12,
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
