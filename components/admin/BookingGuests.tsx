'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/admin-lang'

// Guest names on a booking, for staff (2026-09-14). Two shapes of the same field:
//   GuestNamesField     — the New Booking form. A local list, saved WITH the booking.
//   BookingGuestsEditor — the Edit Booking page. Live against
//                         /api/admin/bookings/[id]/guests; each change saves at once.
// Staff are not capped by party size (the member portal is); they are told when
// the list runs past it, because the seat check on the tables uses party size.

const MONO = "'Google Sans Code', monospace"

const partyNote = (t: (en: string, vn: string) => string, party: number, count: number) => {
  const cap = Math.max(0, party - 1)
  if (count <= cap) return null
  return t(`A party of ${party} is the member and ${cap} guest${cap === 1 ? '' : 's'} — raise the party size so the tables seat everyone.`,
           `Nhóm ${party} người gồm hội viên và ${cap} khách — hãy tăng số khách để bàn đủ chỗ cho mọi người.`)
}

export function GuestNamesField({ names, onChange, partySize }: { names: string[]; onChange: (n: string[]) => void; partySize: number }) {
  const { t } = useLang()
  const [draft, setDraft] = useState('')
  const add = () => {
    const n = draft.replace(/\s+/g, ' ').trim()
    if (!n || n.length > 120) return
    onChange([...names, n]); setDraft('')
  }
  const warn = partyNote(t, partySize, names.length)
  return (
    <div style={{ marginTop: 14 }}>
      <div style={label}>{t('Guest names', 'Tên khách')}</div>
      <div style={hint}>{t('Every guest signs in at the door; a name not given here goes to the duty manager.', 'Mọi khách đều đăng ký tại cửa; tên không được báo ở đây sẽ do quản lý ca trực quyết định.')}</div>
      {names.map((n, i) => (
        <div key={i} style={rowStyle}>
          <input value={n} onChange={e => onChange(names.map((x, j) => j === i ? e.target.value : x))} style={input} maxLength={120} />
          <button onClick={() => onChange(names.filter((_, j) => j !== i))} style={removeBtn}>{t('Remove', 'Xoá')}</button>
        </div>
      ))}
      <div style={rowStyle}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={t('Add a guest’s full name…', 'Thêm họ tên khách…')} style={input} maxLength={120} />
        <button onClick={add} disabled={!draft.trim()} style={{ ...addBtn, opacity: draft.trim() ? 1 : 0.4 }}>{t('Add', 'Thêm')}</button>
      </div>
      {warn && <div style={{ ...hint, color: '#D4B85A', opacity: 1 }}>{warn}</div>}
    </div>
  )
}

interface Guest { id: string; guest_name: string; added_by_kind: 'member' | 'staff'; signed_in: boolean }

export function BookingGuestsEditor({ bookingId, partySize }: { bookingId: string; partySize: number }) {
  const { t } = useLang()
  const [guests, setGuests] = useState<Guest[]>([])
  const [ready, setReady] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/bookings/${bookingId}/guests`, { cache: 'no-store' })
      const j = await r.json()
      setReady(j.ready !== false); setGuests(j.guests || [])
    } catch { setError(t('Could not load guest names.', 'Không tải được tên khách.')) } finally { setLoaded(true) }
  }, [bookingId, t])
  useEffect(() => { load() }, [load])

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true); setError(null)
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error || t('Could not save.', 'Không thể lưu.')); return false }
      await load(); return true
    } finally { setBusy(false) }
  }

  const add = async () => {
    const n = draft.replace(/\s+/g, ' ').trim()
    if (!n) return
    if (await call(`/api/admin/bookings/${bookingId}/guests`, 'POST', { guest_name: n })) setDraft('')
  }
  const save = async () => {
    if (!editing) return
    if (await call(`/api/admin/bookings/${bookingId}/guests/${editing.id}`, 'PATCH', { guest_name: editing.name })) setEditing(null)
  }
  const remove = (id: string) => call(`/api/admin/bookings/${bookingId}/guests/${id}`, 'DELETE')

  const warn = partyNote(t, partySize, guests.length)

  return (
    <div style={{ marginTop: 14 }}>
      <div style={label}>{t('Guest names', 'Tên khách')}</div>
      {!ready ? (
        <div style={hint}>{t('Not set up yet — run db/guest_signin.sql.', 'Chưa được thiết lập — cần chạy db/guest_signin.sql.')}</div>
      ) : (
        <>
          <div style={hint}>{t('Saved as you go. The member can also add names in their portal. ✓ = signed in at the door.', 'Lưu ngay khi thay đổi. Hội viên cũng có thể thêm tên trong cổng thành viên. ✓ = đã đăng ký tại cửa.')}</div>
          {error && <div style={{ ...hint, color: '#C27070', opacity: 1 }}>{error}</div>}
          {!loaded && <div style={hint}>{t('Loading…', 'Đang tải…')}</div>}
          {guests.map(g => (
            <div key={g.id} style={rowStyle}>
              {editing?.id === g.id ? (
                <>
                  <input value={editing.name} onChange={e => setEditing({ id: g.id, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') save() }} style={input} maxLength={120} autoFocus />
                  <button onClick={save} disabled={busy} style={addBtn}>{t('Save', 'Lưu')}</button>
                  <button onClick={() => setEditing(null)} style={removeBtn}>{t('Cancel', 'Hủy')}</button>
                </>
              ) : (
                <>
                  <div style={{ ...input, background: 'transparent', border: '1px solid rgba(229,212,194,0.06)' }}>
                    {g.signed_in ? '✓ ' : ''}{g.guest_name}
                    <span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 10 }}>{g.added_by_kind === 'member' ? t('added by member', 'hội viên thêm') : t('added by staff', 'nhân viên thêm')}</span>
                  </div>
                  <button onClick={() => setEditing({ id: g.id, name: g.guest_name })} disabled={busy} style={removeBtn}>{t('Edit', 'Sửa')}</button>
                  <button onClick={() => remove(g.id)} disabled={busy} style={{ ...removeBtn, color: '#C27070' }}>{t('Remove', 'Xoá')}</button>
                </>
              )}
            </div>
          ))}
          <div style={rowStyle}>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder={t('Add a guest’s full name…', 'Thêm họ tên khách…')} style={input} maxLength={120} />
            <button onClick={add} disabled={busy || !draft.trim()} style={{ ...addBtn, opacity: draft.trim() ? 1 : 0.4 }}>{t('Add', 'Thêm')}</button>
          </div>
          {warn && <div style={{ ...hint, color: '#D4B85A', opacity: 1 }}>{warn}</div>}
        </>
      )}
    </div>
  )
}

const label: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }
const hint: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', opacity: 0.7, letterSpacing: '0.04em', margin: '2px 0 8px', lineHeight: 1.6 }
const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }
const input: React.CSSProperties = { flex: 1, minWidth: 0, background: 'rgba(5,46,32,0.4)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6, padding: '10px 12px', fontFamily: MONO, fontSize: 12, boxSizing: 'border-box', outline: 'none' }
const addBtn: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '10px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap' }
const removeBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 6, padding: '9px 12px', fontFamily: MONO, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }
