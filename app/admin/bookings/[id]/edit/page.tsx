'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast, ConfirmModal } from '@/components/admin/dialogs'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

// Admin / Floor / Calendar / Edit booking.
// Loads via GET /api/admin/bookings/[id], saves via PATCH (member is fixed — the
// endpoint can't reassign), cancels via DELETE (soft-cancel). Mirrors the
// new-booking form's fields + house styling.

const SPACES = ['Library Bar', 'The Studio', 'The Dining Room', 'The Rampant Room', 'Source & Origin Lab', 'Sports Club']
const SESSIONS = ['', 'early', 'evening', 'late']
const STATUSES = ['pending', 'confirmed', 'arrived', 'cancelled', 'no_show']

export default function EditBookingPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { showToast, toastNode } = useToast()

  const [loading, setLoading] = useState(true)
  const [memberName, setMemberName] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [sessionLabel, setSessionLabel] = useState('')
  const [space, setSpace] = useState(SPACES[0])
  const [partySize, setPartySize] = useState('2')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('confirmed')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/bookings/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const b = d.booking
        if (!b) { setError('Booking not found.'); setLoading(false); return }
        setMemberName(b.member_name || '—'); setMemberNo(b.member_no || '')
        setBookingDate(b.booking_date || '')
        setStartTime((b.start_time || '').slice(0, 5)); setEndTime((b.end_time || '').slice(0, 5))
        setSessionLabel(b.session_label || ''); setSpace(b.space || SPACES[0])
        setPartySize(String(b.party_size ?? 2)); setNotes(b.notes || '')
        setStatus(b.status || 'confirmed'); setLoading(false)
      })
      .catch(() => { setError('Failed to load booking.'); setLoading(false) })
  }, [id])

  const save = useCallback(async () => {
    if (!sessionLabel && !startTime) { setError('Either a start time or a session is required.'); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: bookingDate,
          start_time: startTime || null,
          end_time: endTime || null,
          session_label: sessionLabel || null,
          space,
          party_size: partySize ? Number(partySize) : 1,
          notes: notes || null,
          status,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      router.push('/admin/calendar')
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }, [id, bookingDate, startTime, endTime, sessionLabel, space, partySize, notes, status, router])

  const doCancel = async () => {
    setCancelBusy(true)
    const r = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      showToast(j.error || 'Cancel failed', 'error'); setCancelBusy(false); return
    }
    router.push('/admin/calendar')
  }

  if (loading) return (<><Link href="/admin/calendar" style={backLink}>← Calendar</Link><div style={hintText}>Loading…</div></>)

  return (
    <>
      <Link href="/admin/calendar" style={backLink}>← Calendar</Link>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Floor · Calendar</div>
        <h1 style={pageTitle}>Edit booking</h1>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={fieldRow}>
        <div style={editLabel}>Member</div>
        <div style={selectedMemberRow}>
          <div><strong>{memberName}</strong><span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 11 }}>{memberNo}</span></div>
          <span style={{ color: '#B2AA98', fontSize: 10 }}>fixed — create a new booking to change member</span>
        </div>
      </div>

      <div style={metaGrid}>
        <div style={fieldRow}><div style={editLabel}>Date *</div><input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={inputStyle} /></div>
        <div style={fieldRow}><div style={editLabel}>Space *</div><select value={space} onChange={e => setSpace(e.target.value)} style={inputStyle}>{SPACES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div style={fieldRow}><div style={editLabel}>Party size</div><input type="number" min={1} max={50} value={partySize} onChange={e => setPartySize(e.target.value)} style={inputStyle} /></div>
      </div>

      <div style={metaGrid}>
        <div style={fieldRow}><div style={editLabel}>Session</div><select value={sessionLabel} onChange={e => setSessionLabel(e.target.value)} style={inputStyle}>{SESSIONS.map(s => <option key={s} value={s}>{s || '— none —'}</option>)}</select></div>
        <div style={fieldRow}><div style={editLabel}>Start time</div><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} /></div>
        <div style={fieldRow}><div style={editLabel}>End time</div><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ ...hintText, marginTop: 6 }}>Set either a precise time or a session. Both is fine too.</div>

      <div style={metaGrid}>
        <div style={fieldRow}><div style={editLabel}>Status</div><select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>

      <div style={{ ...fieldRow, marginTop: 14 }}>
        <div style={editLabel}>Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save changes'}</button>
        <Link href="/admin/calendar" style={btnGhost}>Discard</Link>
        <button onClick={() => setConfirmCancel(true)} style={{ ...btnGhost, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Cancel booking</button>
      </div>

      <ConfirmModal
        open={confirmCancel}
        eyebrow="⚠ CANCEL BOOKING"
        title="Cancel this booking?"
        subject={`${memberName} · ${bookingDate}`}
        body="Marks the booking cancelled (soft-cancel) — it leaves the active calendar. Can't be undone from here."
        confirmLabel="Cancel booking"
        busyLabel="Cancelling…"
        busy={cancelBusy}
        tone="danger"
        onConfirm={doCancel}
        onCancel={() => { if (!cancelBusy) setConfirmCancel(false) }}
      />
      {toastNode}
    </>
  )
}

const backLink: React.CSSProperties = { display: 'inline-block', marginBottom: 18, textDecoration: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7 }
const eyebrow: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px' }
const fieldRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }
const editLabel: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase' }
const inputStyle: React.CSSProperties = { background: 'rgba(5,46,32,0.4)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6, padding: '10px 12px', fontFamily: "'Google Sans Code', monospace", fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }
const metaGrid: React.CSSProperties = { display: 'grid', gap: 12, marginBottom: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }
const selectedMemberRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(122,176,122,0.10)', border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6, color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12 }
const hintText: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.7, letterSpacing: '0.04em' }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '12px 22px', fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6, padding: '12px 22px', fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.08em', textDecoration: 'none', textAlign: 'center', cursor: 'pointer' }
const errorBox: React.CSSProperties = { marginBottom: 14, padding: '10px 14px', background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)', borderRadius: 6, color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 11 }
