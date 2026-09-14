'use client'

import { useCallback, useEffect, useState } from 'react'
import MemberModal from '@/components/MemberModal'
import { useLang } from '@/lib/lang'

// The member names the guests on one of their own upcoming bookings (decided
// 2026-09-14). Built on MemberModal, which portals to <body> — a fixed modal
// rendered inside MemberPage's transformed wrapper opens off-centre.
//
// Every call goes to /api/members/bookings/[id]/guests, which scopes to the
// signed-in member's own bookings; this component never sees anyone else's list.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'

interface Guest { id: string; guest_name: string; signed_in: boolean }

export default function BookingGuestsModal({ bookingId, title, onClose, onChanged }: {
  bookingId: string | null
  title?: string
  onClose: () => void
  onChanged?: () => void
}) {
  const { t } = useLang()
  const [guests, setGuests] = useState<Guest[]>([])
  const [cap, setCap] = useState(0)
  const [editable, setEditable] = useState(false)
  const [ready, setReady] = useState(true)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bookingId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/members/bookings/${bookingId}/guests`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setError(j.error || t('Could not load your guests.', 'Không tải được danh sách khách.')); return }
      setGuests(j.guests || []); setCap(j.cap ?? 0); setEditable(!!j.editable); setReady(j.ready !== false)
    } catch { setError(t('Could not load your guests.', 'Không tải được danh sách khách.')) } finally { setLoading(false) }
  }, [bookingId, t])

  useEffect(() => {
    setGuests([]); setDraft(''); setEditing(null); setError(null)
    if (bookingId) load()
  }, [bookingId, load])

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true); setError(null)
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error || t('Could not save.', 'Không thể lưu.')); return false }
      await load(); onChanged?.(); return true
    } finally { setBusy(false) }
  }

  const base = `/api/members/bookings/${bookingId}/guests`
  const add = async () => { const n = draft.replace(/\s+/g, ' ').trim(); if (n && await call(base, 'POST', { guest_name: n })) setDraft('') }
  const save = async () => { if (editing && await call(`${base}/${editing.id}`, 'PATCH', { guest_name: editing.name })) setEditing(null) }
  const remove = (id: string) => call(`${base}/${id}`, 'DELETE')

  const full = guests.length >= cap

  return (
    <MemberModal
      open={!!bookingId}
      onClose={onClose}
      title={t('Your guests', 'Khách của bạn')}
      subtitle={title}
      maxWidth={560}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .bg-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(229,212,194,.12); }
        .bg-name { font-family: ${SERIF}; font-size: 22px; line-height: 1.2; color: ${CREAM}; overflow-wrap: anywhere; }
        .bg-acts { display: flex; gap: 14px; }
        .bg-link { background: none; border: none; border-bottom: 1px solid currentColor; padding: 0 0 3px; cursor: pointer; color: ${CREAM};
                   font-family: ${MONO}; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; }
        .bg-link:hover { color: ${GOLD}; }
        .bg-link:disabled { opacity: .4; cursor: default; }
        .bg-input { width: 100%; box-sizing: border-box; background: rgba(229,212,194,.05); color: ${CREAM}; border: 1px solid rgba(229,212,194,.22);
                    border-radius: 10px; padding: 12px 14px; font-family: ${MONO}; font-size: 16px; outline: none; }
        .bg-input:focus { border-color: ${GOLD}; }
        .bg-add { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; margin-top: 18px; }
        .bg-btn { background: ${GOLD}; color: #052E20; border: none; border-radius: 10px; padding: 0 20px; font-family: ${MONO};
                  font-size: 12px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; cursor: pointer; }
        .bg-btn:disabled { opacity: .4; cursor: default; }
        .bg-note { font-family: ${MONO}; font-size: 12px; line-height: 1.8; opacity: .75; margin-top: 18px; }
        .bg-err { font-family: ${MONO}; font-size: 12px; color: #E0A0A0; margin-top: 12px; }
      ` }} />

      {loading && !guests.length ? <div className="bg-note">{t('Loading…', 'Đang tải…')}</div>
        : !ready ? <div className="bg-note">{t('Naming guests is not open yet. Please tell the Club your guests’ names when you book.', 'Chức năng báo tên khách chưa mở. Vui lòng báo tên khách cho Câu lạc bộ khi đặt chỗ.')}</div>
        : (
          <>
            <div className="bg-note" style={{ marginTop: 0 }}>
              {cap === 0
                ? t('This booking is for you alone. To bring a guest, ask the Club to change the party size.', 'Lượt đặt này chỉ dành cho bạn. Để đi cùng khách, vui lòng nhờ Câu lạc bộ đổi số người.')
                : t(`Room for ${cap} guest${cap === 1 ? '' : 's'} on this booking — ${guests.length} named.`, `Lượt đặt này có chỗ cho ${cap} khách — đã báo ${guests.length} tên.`)}
            </div>

            {guests.map(g => (
              <div key={g.id} className="bg-row">
                {editing?.id === g.id ? (
                  <>
                    <input className="bg-input" value={editing.name} maxLength={120} autoFocus
                      onChange={e => setEditing({ id: g.id, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') save() }} />
                    <div className="bg-acts">
                      <button className="bg-link" onClick={save} disabled={busy}>{t('Save', 'Lưu')}</button>
                      <button className="bg-link" onClick={() => setEditing(null)}>{t('Cancel', 'Hủy')}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-name">{g.guest_name}</div>
                    {g.signed_in
                      ? <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: GOLD }}>{t('Signed in', 'Đã vào')}</span>
                      : editable && (
                        <div className="bg-acts">
                          <button className="bg-link" onClick={() => setEditing({ id: g.id, name: g.guest_name })} disabled={busy}>{t('Edit', 'Sửa')}</button>
                          <button className="bg-link" onClick={() => remove(g.id)} disabled={busy}>{t('Remove', 'Xoá')}</button>
                        </div>
                      )}
                  </>
                )}
              </div>
            ))}

            {editable && !full && (
              <div className="bg-add">
                <input className="bg-input" value={draft} maxLength={120} placeholder={t('Guest’s full name', 'Họ tên đầy đủ của khách')}
                  autoComplete="off" onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
                <button className="bg-btn" onClick={add} disabled={busy || !draft.trim()}>{t('Add', 'Thêm')}</button>
              </div>
            )}
            {error && <div className="bg-err">{error}</div>}

            <div className="bg-note">
              {t('Every guest signs in at the door on arrival. A guest whose name was not given is admitted at the duty manager’s discretion. Only the Club’s staff see these names.',
                 'Mỗi khách đều đăng ký tại cửa khi đến. Khách không được báo tên trước sẽ do quản lý ca trực quyết định. Chỉ nhân viên Câu lạc bộ xem được các tên này.')}
            </div>
          </>
        )}
    </MemberModal>
  )
}
