'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { vnDateString } from '@/lib/datetime'

// Admin / Floor / Calendar / New booking

interface MemberLite {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  email: string | null
}

const SPACES = ['Library Bar', 'The Studio', 'The Dining Room', 'The Rampant Room', 'Source & Origin Lab', 'Sports Club']
const SESSIONS = ['', 'early', 'evening', 'late']

export default function NewBookingPage() {
  const router = useRouter()
  // Vietnam-time today regardless of viewer timezone.
  const today = vnDateString()
  const [members, setMembers] = useState<MemberLite[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [bookingDate, setBookingDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [sessionLabel, setSessionLabel] = useState('evening')
  const [space, setSpace] = useState(SPACES[0])
  const [partySize, setPartySize] = useState('2')
  const [notes, setNotes] = useState('')
  const [sendConfirmation, setSendConfirmation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Toast for non-blocking notices (replaces alert()).
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.members) setMembers(d.members) })
  }, [])

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members.slice(0, 10)
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.member_no.toLowerCase().includes(q) ||
      (m.nickname || '').toLowerCase().includes(q)
    ).slice(0, 10)
  }, [members, memberQuery])

  const selectedMember = useMemo(() => members.find(m => m.member_no === memberNo) || null, [members, memberNo])

  const submit = useCallback(async () => {
    if (!memberNo) { setError('Pick a member.'); return }
    if (!sessionLabel && !startTime) { setError('Either a start time or a session is required.'); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/admin/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_no: memberNo,
          booking_date: bookingDate,
          start_time: startTime || null,
          end_time: endTime || null,
          session_label: sessionLabel || null,
          space,
          party_size: partySize ? Number(partySize) : 1,
          notes: notes || null,
          send_confirmation: sendConfirmation,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      if (sendConfirmation && j.email_error) {
        // Booking still saved — surface the email failure as a toast, then
        // give it a beat to be read before moving on to the calendar.
        setToast({ message: `Booking saved, but confirmation email failed: ${j.email_error}`, tone: 'error' })
        setTimeout(() => router.push('/admin/calendar'), 2600)
        return
      }
      router.push('/admin/calendar')
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }, [memberNo, bookingDate, startTime, endTime, sessionLabel, space, partySize, notes, sendConfirmation, router])

  return (
    <>
      <Link href="/admin/calendar" style={backLink}>← Calendar</Link>

      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Floor · Calendar</div>
        <h1 style={pageTitle}>New booking</h1>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {/* Member picker */}
      <div style={fieldRow}>
        <div style={editLabel}>Member *</div>
        {selectedMember ? (
          <div style={selectedMemberRow}>
            <div>
              <strong>{selectedMember.full_name}</strong>
              <span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 11 }}>{selectedMember.member_no} · {selectedMember.tier}</span>
            </div>
            <button onClick={() => { setMemberNo(''); setMemberQuery('') }} style={tinyBtn}>Change</button>
          </div>
        ) : (
          <>
            <input
              value={memberQuery}
              onChange={e => setMemberQuery(e.target.value)}
              placeholder="Search member by name or number…"
              style={inputStyle}
            />
            <div style={memberList}>
              {filteredMembers.map(m => (
                <button key={m.member_no} onClick={() => setMemberNo(m.member_no)} style={memberRow}>
                  <span>{m.full_name}</span>
                  <span style={{ color: '#B2AA98', fontSize: 11 }}>{m.member_no} · {m.tier}</span>
                </button>
              ))}
              {filteredMembers.length === 0 && (
                <div style={emptyHint}>No matches.</div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={metaGrid}>
        <div style={fieldRow}>
          <div style={editLabel}>Date *</div>
          <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>Space *</div>
          <select value={space} onChange={e => setSpace(e.target.value)} style={inputStyle}>
            {SPACES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>Party size</div>
          <input type="number" min={1} max={50} value={partySize} onChange={e => setPartySize(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={metaGrid}>
        <div style={fieldRow}>
          <div style={editLabel}>Session</div>
          <select value={sessionLabel} onChange={e => setSessionLabel(e.target.value)} style={inputStyle}>
            {SESSIONS.map(s => <option key={s} value={s}>{s || '— none —'}</option>)}
          </select>
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>Start time</div>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>End time</div>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ ...hintText, marginTop: 6 }}>Set either a precise time or a session. Both is fine too.</div>

      <div style={{ ...fieldRow, marginTop: 14 }}>
        <div style={editLabel}>Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Special requests, party context, anything the team should know."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '12px 14px',
        background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
        borderRadius: 6, cursor: selectedMember?.email ? 'pointer' : 'not-allowed',
        opacity: selectedMember && !selectedMember.email ? 0.5 : 1,
      }}>
        <input
          type="checkbox"
          checked={sendConfirmation}
          onChange={e => setSendConfirmation(e.target.checked)}
          disabled={!selectedMember || !selectedMember.email}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2' }}>
            Send confirmation email to the member
          </div>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 4 }}>
            {!selectedMember
              ? 'Pick a member first.'
              : selectedMember.email
                ? `Will go to ${selectedMember.email}`
                : `No email on file for ${selectedMember.full_name}. Add one to the member record to enable this.`}
          </div>
        </div>
      </label>

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={submit}
          disabled={saving || !memberNo}
          style={{ ...btnPrimary, opacity: !memberNo ? 0.4 : 1 }}
        >
          {saving ? 'Saving…' : 'Save booking'}
        </button>
        <Link href="/admin/calendar" style={btnGhost}>Cancel</Link>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div style={toast.tone === 'error' ? toastErrorBox : toastInfoBox} role="status">
          <span style={{ marginRight: 8, color: toast.tone === 'error' ? '#C27070' : '#7AB07A' }}>
            {toast.tone === 'error' ? '✕' : '✓'}
          </span>
          {toast.message}
        </div>
      )}
    </>
  )
}

const toastBase: React.CSSProperties = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 400,
  padding: '12px 18px', maxWidth: 'min(420px, 92vw)',
  background: '#0A3526',
  borderRadius: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.02em',
  display: 'flex', alignItems: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
}
const toastInfoBox: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(122,176,122,0.45)',
  borderLeft: '3px solid #7AB07A',
}
const toastErrorBox: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
}

const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 18, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  marginBottom: 14,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const metaGrid: React.CSSProperties = {
  display: 'grid', gap: 12, marginBottom: 4,
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
}
const memberList: React.CSSProperties = {
  marginTop: 6, maxHeight: 220, overflowY: 'auto',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const memberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  width: '100%', padding: '10px 12px',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(229,212,194,0.06)',
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  cursor: 'pointer', textAlign: 'left',
}
const selectedMemberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 12px',
  background: 'rgba(122,176,122,0.10)',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6,
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, cursor: 'pointer',
}
const hintText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7, letterSpacing: '0.04em',
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', textDecoration: 'none',
  textAlign: 'center', cursor: 'pointer',
}
const emptyHint: React.CSSProperties = {
  padding: '12px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, fontStyle: 'italic',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
