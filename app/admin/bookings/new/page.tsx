'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useToast } from '@/components/admin/dialogs'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { vnDateString } from '@/lib/datetime'
import UnitPicker from '@/components/admin/UnitPicker'

// Admin / Floor / Calendar / New entry — a MEMBER booking (default) OR a
// free-text HOUSE / non-member entry (toggle): external hires, supplier visits,
// closures, tastings. House entries carry a visibility (member-visible/staff-only)
// and can close a room (block bookings). ?entry=<id> edits an existing house entry.

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
const KINDS: { v: string; label: string }[] = [
  { v: 'closure', label: 'Closure' }, { v: 'private_hire', label: 'Private hire' },
  { v: 'supplier', label: 'Supplier / distiller visit' }, { v: 'tasting', label: 'Tasting' }, { v: 'other', label: 'Other' },
]

export default function NewBookingPage() {
  const router = useRouter()
  const editId = useSearchParams().get('entry')   // present → edit an existing house entry
  const today = vnDateString()
  const [mode, setMode] = useState<'member' | 'house'>('member')

  // Shared
  const [bookingDate, setBookingDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [sessionLabel, setSessionLabel] = useState('evening')
  const [space, setSpace] = useState(SPACES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast, toastNode } = useToast()

  // Member-booking fields
  const [members, setMembers] = useState<MemberLite[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [notes, setNotes] = useState('')
  const [sendConfirmation, setSendConfirmation] = useState(false)

  // House-entry fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('closure')
  const [visibility, setVisibility] = useState<'member' | 'staff'>('staff')
  const [blocksSpace, setBlocksSpace] = useState(true)

  // Table units (member booking)
  const [rooms, setRooms] = useState<string[]>([])
  const [unitIds, setUnitIds] = useState<string[]>([])
  const [selectedSeats, setSelectedSeats] = useState(0)

  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.members) setMembers(d.members) })
    // Bookable rooms (distinct spaces with units — excludes Sports Club).
    fetch('/api/admin/bookings/availability', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.rooms) && d.rooms.length) { setRooms(d.rooms); setSpace(s => d.rooms.includes(s) ? s : d.rooms[0]) } })
  }, [])

  // Edit mode: load the existing house entry, switch to house mode, prefill.
  useEffect(() => {
    if (!editId) return
    fetch(`/api/admin/calendar-entries/${editId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const entry = d.entry
        if (!entry) return
        setMode('house')
        setTitle(entry.title || ''); setDescription(entry.description || '')
        setKind(entry.kind || 'other'); setVisibility(entry.visibility || 'staff')
        setBlocksSpace(!!entry.blocks_space)
        setBookingDate(entry.entry_date || today)
        setStartTime(entry.start_time ? entry.start_time.slice(0, 5) : '')
        setEndTime(entry.end_time ? entry.end_time.slice(0, 5) : '')
        setSessionLabel(entry.session_label || '')
        setSpace(entry.space || '')
        setUnitIds(Array.isArray(d.unit_ids) ? d.unit_ids : [])
      })
  }, [editId])  // eslint-disable-line react-hooks/exhaustive-deps

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

  const submitMember = useCallback(async () => {
    if (!memberNo) { setError('Pick a member.'); return }
    if (!sessionLabel && !startTime) { setError('Either a start time or a session is required.'); return }
    if (unitIds.length === 0) { setError('Pick at least one table for this booking.'); return }
    const party = partySize ? Number(partySize) : 1
    if (selectedSeats < party) { setError(`The selected table${unitIds.length === 1 ? '' : 's'} seat ${selectedSeats}, but the party is ${party}. Add a table or pick a larger one.`); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/admin/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_no: memberNo, booking_date: bookingDate,
          start_time: startTime || null, end_time: endTime || null,
          session_label: sessionLabel || null, space,
          party_size: party, unit_ids: unitIds,
          notes: notes || null, send_confirmation: sendConfirmation,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      if (sendConfirmation && j.email_error) {
        showToast(`Booking saved, but confirmation email failed: ${j.email_error}`, 'error')
        setTimeout(() => router.push('/admin/calendar'), 2600)
        return
      }
      router.push('/admin/calendar')
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }, [memberNo, bookingDate, startTime, endTime, sessionLabel, space, partySize, unitIds, selectedSeats, notes, sendConfirmation, router, showToast])

  const submitHouse = useCallback(async () => {
    if (!title.trim()) { setError('A title is required.'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        title: title.trim(), description: description || null, entry_date: bookingDate,
        start_time: startTime || null, end_time: endTime || null, session_label: sessionLabel || null,
        space: space || null, kind, visibility, blocks_space: space ? blocksSpace : false,
        // Tables this entry occupies (only meaningful for a blocking, room-scoped
        // entry). Empty = closes the whole room (or, if not blocking, nothing).
        unit_ids: space && blocksSpace ? unitIds : [],
      }
      const r = await fetch(editId ? `/api/admin/calendar-entries/${editId}` : '/api/admin/calendar-entries', {
        method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      router.push('/admin/calendar')
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }, [editId, title, description, bookingDate, startTime, endTime, sessionLabel, space, kind, visibility, blocksSpace, unitIds, router])

  return (
    <>
      <Link href="/admin/calendar" style={backLink}>← Calendar</Link>

      <div style={{ marginBottom: 20 }}>
        <div style={eyebrow}>Floor · Calendar</div>
        <h1 style={pageTitle}>{editId ? 'Edit house entry' : mode === 'house' ? 'New house entry' : 'New booking'}</h1>
      </div>

      {/* Mode toggle (hidden in edit mode — an entry is already a house entry) */}
      {!editId && (
        <div style={toggleRow}>
          <button onClick={() => { setMode('member'); setError(null); setUnitIds([]) }} style={mode === 'member' ? toggleOn : toggleOff}>Member booking</button>
          <button onClick={() => { setMode('house'); setError(null); setUnitIds([]) }} style={mode === 'house' ? toggleOn : toggleOff}>House / non-member entry</button>
        </div>
      )}

      {error && <div style={errorBox}>{error}</div>}

      {mode === 'member' ? (
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
              <input value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search member by name or number…" style={inputStyle} />
              <div style={memberList}>
                {filteredMembers.map(m => (
                  <button key={m.member_no} onClick={() => setMemberNo(m.member_no)} style={memberRow}>
                    <span>{m.full_name}</span>
                    <span style={{ color: '#B2AA98', fontSize: 11 }}>{m.member_no} · {m.tier}</span>
                  </button>
                ))}
                {filteredMembers.length === 0 && <div style={emptyHint}>No matches.</div>}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div style={fieldRow}>
            <div style={editLabel}>Title *</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Private hire — Nguyen party · Distiller visit — Fergus · Club closed" style={inputStyle} />
          </div>
          <div style={metaGrid}>
            <div style={fieldRow}>
              <div style={editLabel}>Kind</div>
              <select value={kind} onChange={e => setKind(e.target.value)} style={inputStyle}>
                {KINDS.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
              </select>
            </div>
            <div style={fieldRow}>
              <div style={editLabel}>Visibility</div>
              <select value={visibility} onChange={e => setVisibility(e.target.value as 'member' | 'staff')} style={inputStyle}>
                <option value="staff">Staff-only (members never see it)</option>
                <option value="member">Member-visible (shows on member events)</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div style={metaGrid}>
        <div style={fieldRow}>
          <div style={editLabel}>Date *</div>
          <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>{mode === 'house' ? 'Space' : 'Room *'}</div>
          <select value={space} onChange={e => { setSpace(e.target.value); setUnitIds([]) }} style={inputStyle}>
            {mode === 'house' ? (
              <>
                <option value="">— none (no room) —</option>
                {SPACES.map(s => <option key={s} value={s}>{s}</option>)}
              </>
            ) : (
              (rooms.length ? rooms : SPACES.filter(s => s !== 'Sports Club')).map(s => <option key={s} value={s}>{s}</option>)
            )}
          </select>
        </div>
        {mode === 'member' && (
          <div style={fieldRow}>
            <div style={editLabel}>Party size</div>
            <input type="number" min={1} max={50} value={partySize} onChange={e => setPartySize(e.target.value)} style={inputStyle} />
          </div>
        )}
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
      <div style={{ ...hintText, marginTop: 6 }}>
        {mode === 'house' ? 'No time = the whole day. A space + “closes the room” blocks bookings for that window.' : 'Set either a precise time or a session. Both is fine too.'}
      </div>

      {mode === 'member' && (
        <div style={{ marginTop: 14 }}>
          <UnitPicker
            space={space} date={bookingDate} startTime={startTime} endTime={endTime} sessionLabel={sessionLabel}
            partySize={partySize ? Number(partySize) : 1}
            selected={unitIds} onChange={setUnitIds} onSeatsChange={setSelectedSeats}
          />
        </div>
      )}

      {mode === 'member' ? (
        <>
          <div style={{ ...fieldRow, marginTop: 14 }}>
            <div style={editLabel}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Special requests, party context, anything the team should know." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '12px 14px',
            background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)', borderRadius: 6,
            cursor: selectedMember?.email ? 'pointer' : 'not-allowed', opacity: selectedMember && !selectedMember.email ? 0.5 : 1,
          }}>
            <input type="checkbox" checked={sendConfirmation} onChange={e => setSendConfirmation(e.target.checked)} disabled={!selectedMember || !selectedMember.email} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2' }}>Send confirmation email to the member</div>
              <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 4 }}>
                {!selectedMember ? 'Pick a member first.' : selectedMember.email ? `Will go to ${selectedMember.email}` : `No email on file for ${selectedMember.full_name}. Add one to the member record to enable this.`}
              </div>
            </div>
          </label>
        </>
      ) : (
        <>
          <div style={{ ...fieldRow, marginTop: 14 }}>
            <div style={editLabel}>Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Optional detail. For a member-visible entry this is what members read." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {space && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '12px 14px',
              background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)', borderRadius: 6, cursor: 'pointer',
            }}>
              <input type="checkbox" checked={blocksSpace} onChange={e => setBlocksSpace(e.target.checked)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2' }}>Closes {space} (blocks bookings)</div>
                <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 4 }}>
                  On = the room can&apos;t be booked for this window. Off = informational only (e.g. a visit that doesn&apos;t close the room).
                </div>
              </div>
            </label>
          )}
          {space && blocksSpace && (
            <div style={{ marginTop: 14 }}>
              <UnitPicker
                mode="house"
                space={space} date={bookingDate} startTime={startTime} endTime={endTime} sessionLabel={sessionLabel}
                partySize={0}
                selected={unitIds} onChange={setUnitIds}
                excludeEntryId={editId || undefined}
              />
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {mode === 'member' ? (
          <button onClick={submitMember} disabled={saving || !memberNo} style={{ ...btnPrimary, opacity: !memberNo ? 0.4 : 1 }}>
            {saving ? 'Saving…' : 'Save booking'}
          </button>
        ) : (
          <button onClick={submitHouse} disabled={saving || !title.trim()} style={{ ...btnPrimary, opacity: !title.trim() ? 0.4 : 1 }}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Save house entry'}
          </button>
        )}
        <Link href="/admin/calendar" style={btnGhost}>Cancel</Link>
      </div>

      {toastNode}
    </>
  )
}

const toggleRow: React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }
const toggleBase: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.04em',
}
const toggleOn: React.CSSProperties = { ...toggleBase, background: 'rgba(212,184,90,0.15)', color: '#D4B85A', border: '1px solid rgba(212,184,90,0.45)' }
const toggleOff: React.CSSProperties = { ...toggleBase, background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)' }

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
