'use client'

import { useMemo, useState } from 'react'
import { ConfirmModal, type ToastTone } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { foldName, isMissingColumn } from '@/lib/fixtures'
import { vnEventLabel } from '@/lib/datetime'
import type { Fixture } from '@/lib/types'

// Who is coming, on the event row itself (2026-09-15).
//
// "Some people sign up on the system, some sign up on Zalo via our hotline." So
// staff add people here — a member from the roster, or a typed name for someone
// who is not on it — and can mark the event full before every name is in. Each
// person takes one place, exactly as a portal sign-up does.
//
// ADMIN-ONLY. The names come from /api/admin/fixtures/[id]/attendees and are never
// passed to ShareBox or anything else that leaves this page.

export interface RosterMember { member_no: string; full_name: string; nickname: string | null; status: string | null }

interface Attendee {
  id: string; name: string; source: 'portal' | 'staff'; member_no: string | null
  has_account: boolean; note: string | null; added_by: string | null; signed_up_at: string
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const smallInput: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 6,
  padding: '7px 10px', fontFamily: MONO, fontSize: 11, boxSizing: 'border-box', minWidth: 0,
}
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontFamily: MONO, fontSize: 10, color: '#E5D4C2',
}
const tag = (bg: string, fg: string): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
  background: bg, color: fg, borderRadius: 3, padding: '1px 6px',
})

export default function FixtureAttendees({ fixture, count, roster, showToast, onChanged }: {
  fixture: Fixture
  count: number
  /** undefined while loading · null when the roster could not be read */
  roster: RosterMember[] | null | undefined
  showToast: (message: string, tone?: ToastTone) => void
  onChanged: () => void
}) {
  const { t } = useLang()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [open, setOpen] = useState(false)
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [ready, setReady] = useState<boolean | null>(null)
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Attendee | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const cap = fixture.max_signups
  // is_full is on the row only once the SQL has run; its absence is the signal.
  const fullReady = typeof fixture.is_full === 'boolean'
  const atCap = cap != null && count >= cap
  const isFull = !!fixture.is_full || atCap

  const loadList = async () => {
    try {
      const r = await fetch(`/api/admin/fixtures/${fixture.id}/attendees`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { showToast(`${t('Could not load attendees:', 'Không tải được danh sách tham gia:')} ${j.error || r.status}`, 'error'); return }
      setAttendees(j.attendees || []); setReady(!!j.ready)
    } catch {
      showToast(t('Could not load attendees — check the connection.', 'Không tải được danh sách tham gia — kiểm tra kết nối.'), 'error')
    }
  }

  const toggleOpen = () => { const next = !open; setOpen(next); if (next) loadList() }

  const matches = useMemo(() => {
    const q = foldName(query)
    if (!q || !roster) return []
    return roster.filter(m => foldName(m.full_name).includes(q) || foldName(m.member_no).includes(q) || foldName(m.nickname).includes(q))
  }, [roster, query])
  const onList = new Set((attendees || []).map(a => a.member_no).filter(Boolean))

  const add = async (body: { member_no: string } | { attendee_name: string }) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/fixtures/${fixture.id}/attendees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, note: note.trim() || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (j.ready === false) setReady(false)
        showToast(`${t('Not added:', 'Chưa thêm:')} ${j.error || r.status}`, 'error')
        return
      }
      // Staff may go over the cap (the Zalo list may already be longer than the
      // portal allows). The toast is where they find out they did.
      if (j.over_cap) showToast(`${j.name} ${t('added — that takes it to', 'đã được thêm — nâng lên')} ${j.count} / ${j.cap}, ${t('over the cap.', 'vượt giới hạn.')}`, 'warn')
      else if (j.at_cap) showToast(`${j.name} ${t('added — that takes it to', 'đã được thêm — nâng lên')} ${j.count} / ${j.cap}: ${t('now full.', 'đã kín chỗ.')}`, 'warn')
      else showToast(`${j.name} ${t('added', 'đã được thêm')} · ${j.count}${j.cap != null ? ` / ${j.cap}` : ''}`, 'success')
      setQuery(''); setNote('')
      loadList(); onChanged()
    } catch {
      showToast(t('Not added — check the connection.', 'Chưa thêm — kiểm tra kết nối.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const runRemove = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      const r = await fetch(`/api/admin/fixtures/${fixture.id}/attendees/${confirm.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { showToast(`${t('Remove failed:', 'Xóa thất bại:')} ${j.error || r.status}`, 'error'); return }
      showToast(`${confirm.name} ${t('removed', 'đã được xóa')}`, 'success')
      setConfirm(null)
      loadList(); onChanged()
    } catch {
      showToast(t('Remove failed — check the connection.', 'Xóa thất bại — kiểm tra kết nối.'), 'error')
    } finally {
      setConfirmBusy(false)
    }
  }

  const toggleFull = async () => {
    if (!fullReady) { showToast(t('The Full switch is not set up yet — run db/fixture_attendees.sql.', 'Nút Hết chỗ chưa được thiết lập — hãy chạy db/fixture_attendees.sql.'), 'warn'); return }
    const next = !fixture.is_full
    // .select() so an update RLS refused (no error, no row) reads as a failure.
    const { data, error } = await supabase.from('fixtures').update({ is_full: next }).eq('id', fixture.id).select('id')
    if (error || !data?.length) {
      const why = isMissingColumn(error)
        ? t('not set up yet — run db/fixture_attendees.sql.', 'chưa được thiết lập — hãy chạy db/fixture_attendees.sql.')
        : error?.message || t('the change was not saved — check you are signed in as an admin.', 'thay đổi chưa được lưu — hãy kiểm tra bạn đang đăng nhập bằng tài khoản quản trị.')
      showToast(`${t('Not changed:', 'Chưa thay đổi:')} ${why}`, 'error')
      return
    }
    showToast(next ? t('Marked as full — members now see Full.', 'Đã đánh dấu hết chỗ — hội viên sẽ thấy Hết chỗ.')
                   : t('Sign-ups reopened.', 'Đã mở lại đăng ký.'), 'success')
    onChanged()
  }

  return (
    <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={toggleOpen} style={{ ...linkBtn, opacity: 0.85 }} aria-expanded={open}>
          {open ? '▾' : '▸'} {t('Attendees', 'Người tham gia')} · {count}{cap != null ? ` / ${cap}` : ''}
        </button>
        {isFull && <span style={tag('rgba(194,112,112,0.22)', '#E8A0A0')}>{t('Full', 'Hết chỗ')}</span>}
        {cap != null && count > cap && <span style={{ color: '#D4B85A' }}>{t('over the cap', 'vượt giới hạn')}</span>}
        {/* The switch is for when the places are gone but the names are not all in.
            Reaching the cap already reads as Full, so it is offered either way. */}
        <button onClick={toggleFull} style={{ ...linkBtn, opacity: fullReady ? 0.55 : 0.35 }}
          title={fullReady ? undefined : t('Not set up yet', 'Chưa được thiết lập')}>
          {fixture.is_full ? t('Reopen sign-ups', 'Mở lại đăng ký') : t('Mark as full', 'Đánh dấu hết chỗ')}
          {!fullReady && ` · ${t('not set up yet', 'chưa thiết lập')}`}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '1px solid rgba(229,212,194,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attendees === null ? (
            <div style={{ opacity: 0.6 }}>{t('Loading…', 'Đang tải…')}</div>
          ) : attendees.length === 0 ? (
            <div style={{ opacity: 0.6 }}>{t('Nobody yet.', 'Chưa có ai.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {attendees.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ opacity: 0.5, minWidth: 16 }}>{i + 1}.</span>
                  <span style={{ color: '#E5D4C2', fontSize: 11 }}>{a.name}</span>
                  {a.member_no && <span style={{ opacity: 0.6 }}>{a.member_no}</span>}
                  {a.source === 'staff'
                    ? <span style={tag('rgba(212,184,90,0.16)', '#D4B85A')}>{t('added by staff', 'nhân viên thêm')}</span>
                    : <span style={tag('rgba(127,179,160,0.16)', '#7FB3A0')}>{t('portal', 'cổng hội viên')}</span>}
                  {a.note && <span style={{ fontStyle: 'italic' }}>“{a.note}”</span>}
                  <span style={{ opacity: 0.5 }}>{vnEventLabel(a.signed_up_at)}</span>
                  <button onClick={() => setConfirm(a)} style={{ ...linkBtn, opacity: 0.45, marginLeft: 'auto' }}>{t('Remove', 'Xóa')}</button>
                </div>
              ))}
            </div>
          )}

          {ready === false ? (
            <div style={{ color: '#D4B85A', opacity: 0.85, lineHeight: 1.6 }}>
              {t('Adding people by hand is not set up yet — run db/fixture_attendees.sql. Portal sign-ups above are shown as before.',
                 'Chưa thiết lập việc thêm người thủ công — hãy chạy db/fixture_attendees.sql. Các lượt đăng ký qua cổng ở trên vẫn hiển thị như trước.')}
            </div>
          ) : ready === true && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={{ ...smallInput, flex: '2 1 220px' }} value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t('Search members, or type a name', 'Tìm hội viên, hoặc nhập tên')} />
                <input style={{ ...smallInput, flex: '1 1 140px' }} value={note} maxLength={200} onChange={e => setNote(e.target.value)}
                  placeholder={t('Note (optional) — e.g. via Zalo', 'Ghi chú (tùy chọn) — vd. qua Zalo')} />
              </div>
              {roster === null && <div style={{ opacity: 0.6 }}>{t('The member roster could not be loaded — you can still add by name.', 'Không tải được danh sách hội viên — vẫn có thể thêm theo tên.')}</div>}
              {query.trim() && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
                  {matches.map(m => (
                    <button key={m.member_no} disabled={busy || onList.has(m.member_no)} onClick={() => add({ member_no: m.member_no })}
                      style={{ ...linkBtn, textAlign: 'left', padding: '3px 0', opacity: onList.has(m.member_no) ? 0.35 : 0.85 }}>
                      + {m.full_name} <span style={{ opacity: 0.6 }}>· {m.member_no}{m.status && m.status !== 'Active' ? ` · ${m.status}` : ''}{onList.has(m.member_no) ? ` · ${t('on the list', 'đã có tên')}` : ''}</span>
                    </button>
                  ))}
                  <button disabled={busy} onClick={() => add({ attendee_name: query })}
                    style={{ ...linkBtn, textAlign: 'left', padding: '3px 0', color: '#D4B85A' }}>
                    + {t('Add', 'Thêm')} “{query.trim()}” {t('as a name — not on the roster', 'theo tên — không có trong danh sách hội viên')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        eyebrow={t('⚠ REMOVE ATTENDEE', '⚠ XÓA NGƯỜI THAM GIA')}
        title={t('Remove from this event?', 'Xóa khỏi sự kiện này?')}
        subject={confirm ? `${confirm.name} · ${fixture.title}` : undefined}
        body={confirm
          ? `${t('Their place is freed and the count drops by one.', 'Chỗ của họ được giải phóng và số lượng giảm một.')}${confirm.has_account ? ' ' + t('They can sign up again in the portal while places remain.', 'Họ có thể đăng ký lại trên cổng hội viên nếu còn chỗ.') : ''}`
          : ''}
        confirmLabel={t('Remove', 'Xóa')}
        busyLabel={t('Removing…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={() => { if (!confirmBusy) setConfirm(null) }}
        onConfirm={runRemove}
      />
    </div>
  )
}
