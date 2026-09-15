'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'
import type { Fixture } from '@/lib/types'

import { FIXTURE_TYPES, TYPE_COLOR, typeLabel } from '@/lib/fixtures'
import ShareBox from '@/components/admin/ShareBox'
import AttachmentField from '@/components/admin/AttachmentField'
import FixtureAttendees, { type RosterMember } from '@/components/admin/FixtureAttendees'
import { vnInputValue, vnInputToISO, vnEventLabel } from '@/lib/datetime'

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '10px 24px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
}

export default function AdminFixtures() {
  const { t, lang } = useLang()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({})
  // The roster to add attendees from. undefined while loading, null if it failed —
  // adding by name still works then.
  const [members, setMembers] = useState<RosterMember[] | null | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fixture | null>(null)
  const [type, setType] = useState<Fixture['type']>('golf')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [maxSignups, setMaxSignups] = useState('')
  const [signupDeadline, setSignupDeadline] = useState('')
  const [results, setResults] = useState('')
  const [opsProjectId, setOpsProjectId] = useState('')                              // D: optional Ops Hub board link
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  const supabase = createBrowserSupabaseClient()

  const { showToast, toastNode } = useToast()
  // Confirm modal — single destructive path (delete event).
  const [confirmFixture, setConfirmFixture] = useState<Fixture | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('fixtures').select('*').order('date', { ascending: false })
    if (data) setFixtures(data)
    const { data: pj } = await supabase.from('projects').select('id, name').eq('status', 'active').order('name')
    if (pj) setProjects(pj)
    // Counts only here. Every row is one place — portal sign-ups and people staff
    // added alike — and admins read all of them under RLS. The NAMES now come from
    // the attendees route when a row is opened, not from a profiles lookup that
    // could only ever name people with a portal login (2026-09-15).
    const { data: signups, error: sErr } = await supabase.from('fixture_signups').select('fixture_id')
    if (sErr) showToast(`${t('Could not load sign-up counts:', 'Không tải được số lượt đăng ký:')} ${sErr.message}`, 'error')
    if (signups) {
      const counts: Record<string, number> = {}
      signups.forEach((s: { fixture_id: string }) => { counts[s.fixture_id] = (counts[s.fixture_id] || 0) + 1 })
      setSignupCounts(counts)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setMembers(((d.members || []) as RosterMember[]).map(m => ({ member_no: m.member_no, full_name: m.full_name, nickname: m.nickname, status: m.status }))))
      .catch(() => setMembers(null))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setType('golf'); setTitle(''); setDescription(''); setDate(''); setLocation('')
    setMaxSignups(''); setSignupDeadline(''); setResults(''); setOpsProjectId('')
    setEditing(null); setShowForm(false)
  }

  const startEdit = (f: Fixture) => {
    setType(f.type); setTitle(f.title); setDescription(f.description || '')
    setDate(vnInputValue(f.date))
    setLocation(f.location || ''); setMaxSignups(f.max_signups?.toString() || '')
    setSignupDeadline(vnInputValue(f.signup_deadline))
    setResults(f.results || ''); setOpsProjectId(f.ops_project_id || '')
    setEditing(f); setShowForm(true)
    // The form renders at the TOP of the page, above the list. Clicking Edit on
    // an event further down opened it off-screen, so the click looked like it did
    // nothing (2026-09-15, Lachlan: "clicking edit can't do anything"). Bring it
    // to the eye once it has rendered, and put the cursor in the title.
    requestAnimationFrame(() => {
      const form = document.getElementById('event-form')
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      form?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  }

  const handleSubmit = async () => {
    const payload = {
      type, title, description: description || null,
      // Read as VIETNAM wall-clock. Reading it as the browser's clock is what
      // moved every fixture 7 hours earlier on each save.
      date: vnInputToISO(date), location: location || null,
      max_signups: maxSignups ? parseInt(maxSignups) : null,
      signup_deadline: vnInputToISO(signupDeadline),
      results: results || null,
      ops_project_id: opsProjectId || null,
    }
    // The result used to be ignored: a refused or failed save closed the form as
    // if it had worked. Now a failure says why and keeps the form open with the
    // edits still in it. `.select('id')` makes an update that touched no row
    // (e.g. refused by RLS, which returns no error) visible as a failure too.
    const { data, error } = editing
      ? await supabase.from('fixtures').update(payload).eq('id', editing.id).select('id')
      : await supabase.from('fixtures').insert(payload).select('id')
    if (error || !data?.length) {
      showToast(`${editing ? t('Update failed:', 'Cập nhật thất bại:') : t('Create failed:', 'Tạo thất bại:')} ${error?.message || t('the change was not saved — check you are signed in as an admin.', 'thay đổi chưa được lưu — hãy kiểm tra bạn đang đăng nhập bằng tài khoản quản trị.')}`, 'error')
      return
    }
    showToast(editing ? t('Event updated', 'Đã cập nhật sự kiện') : t('Event created', 'Đã tạo sự kiện'), 'success')
    resetForm(); load()
  }

  const requestRemove = (f: Fixture) => setConfirmFixture(f)
  const closeConfirm  = () => { if (!confirmBusy) setConfirmFixture(null) }
  const runRemove = async () => {
    if (!confirmFixture) return
    setConfirmBusy(true)
    try {
      const { error } = await supabase.from('fixtures').delete().eq('id', confirmFixture.id)
      if (error) { showToast(`${t('Delete failed:','Xóa thất bại:')} ${error.message}`, 'error'); return }
      setConfirmFixture(null)
      load()
    } finally {
      setConfirmBusy(false)
    }
  }

  const isPast = (d: string) => new Date(d) < new Date()

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          {t('Events', 'Sự Kiện')}
        </h1>
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', opacity: .75, margin: '4px 0 0', lineHeight: 1.7 }}>
          {t('Events appear in the members\u2019 What\u2019s On, alongside member-visible calendar entries.',
             'Sự kiện hiển thị trong mục What\u2019s On của hội viên, cùng với các mục lịch dành cho hội viên.')}
          {/* Said once, here — not above every event's image. */}
          {' '}{t('Artwork may also go out to the club\u2019s Zalo and WhatsApp groups: never upload a seating plan, a guest list, or anything else naming a member or a guest.',
                  'Hình ảnh cũng có thể được gửi tới nhóm Zalo và WhatsApp của câu lạc bộ: tuyệt đối không tải lên sơ đồ chỗ ngồi, danh sách khách, hay bất cứ thứ gì có tên hội viên hoặc khách.')}
        </p>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>{t('+ New Event', '+ Sự kiện mới')}</button>
        )}
      </div>

      {showForm && (
        <div id="event-form" style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 24 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `${t('Editing:', 'Đang sửa:')} ${editing.title}` : t('New Event', 'Sự kiện mới')}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Type', 'Loại')}</label>
              <select style={inputStyle} value={type} onChange={e => setType(e.target.value as Fixture['type'])}>
                {FIXTURE_TYPES.map(s => <option key={s} value={s}>{typeLabel(s, lang)}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>{t('Title', 'Tiêu đề')}</label>
              <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('Description', 'Mô tả')}</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Date & Time', 'Ngày & Giờ')}</label>
              <input type="datetime-local" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Location', 'Địa điểm')}</label>
              <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Max Sign-ups', 'Số lượt đăng ký tối đa')}</label>
              <input type="number" style={inputStyle} value={maxSignups} onChange={e => setMaxSignups(e.target.value)} />
              {/* The prompt at the moment you are already here. "Worth doing next
                  time" is the shape of a thing that never gets done; a capped
                  fixture is the one moment the cap can actually be exercised. */}
              {maxSignups && (
                <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10.5, color: '#D4B85A', opacity: .85, margin: '6px 0 0', lineHeight: 1.65 }}>
                  {t('Once it\u2019s live: sign yourself up, then have someone else try when it\u2019s full. Read the refusal as a member would \u2014 one minute, and it is the only time the cap gets tested.',
                     'Khi \u0111\u00e3 ho\u1ea1t \u0111\u1ed9ng: t\u1ef1 \u0111\u0103ng k\u00fd, r\u1ed3i nh\u1edd ng\u01b0\u1eddi kh\u00e1c th\u1eed khi \u0111\u00e3 \u0111\u1ee7. \u0110\u1ecdc th\u00f4ng b\u00e1o t\u1eeb ch\u1ed1i nh\u01b0 m\u1ed9t h\u1ed9i vi\u00ean \u2014 m\u1ed9t ph\u00fat, v\u00e0 \u0111\u00f3 l\u00e0 l\u1ea7n duy nh\u1ea5t gi\u1edbi h\u1ea1n \u0111\u01b0\u1ee3c ki\u1ec3m tra.')}
                </p>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Sign-up Deadline', 'Hạn chót đăng ký')}</label>
              <input type="datetime-local" style={inputStyle} value={signupDeadline} onChange={e => setSignupDeadline(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('Ops Hub board', 'Bảng Ops Hub')} <span style={{ opacity: 0.5 }}>{t('· optional link', '· liên kết tùy chọn')}</span></label>
            <select style={inputStyle} value={opsProjectId} onChange={e => setOpsProjectId(e.target.value)}>
              <option value="">{t('— none —', '— không —')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {editing && isPast(editing.date) && (
            <div>
              <label style={labelStyle}>{t('Results', 'Kết quả')}</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={results} onChange={e => setResults(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? t('Update', 'Cập nhật') : t('Create', 'Tạo mới')}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>{t('Cancel', 'Hủy')}</button>
          </div>
        </div>
      )}

      <div>
        {fixtures.map(f => (
          <div key={f.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                  color: '#E5D4C2', background: TYPE_COLOR[f.type] || '#5E6650',
                  borderRadius: 4, padding: '2px 10px',
                }}>{typeLabel(f.type, lang)}</span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{f.title}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                  {vnEventLabel(f.date)} · {f.location || '—'}
                </span>
                {f.ops_project_id && (
                  <a href={`/admin/ops/${f.ops_project_id}`} style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#9E8FC4', textDecoration: 'none' }} title={t('Open the linked Ops Hub board', 'Mở bảng Ops Hub đã liên kết')}>{t('⊙ ops board →', '⊙ bảng ops →')}</a>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => startEdit(f)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>{t('Edit', 'Sửa')}</button>
                <button onClick={() => requestRemove(f)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>{t('Delete', 'Xóa')}</button>
              </div>
            </div>
            {/* Who is coming — ADMIN-ONLY. Replaces the old roster line, which could
                only name people who had signed up in the portal themselves. The
                count shown is every place: portal sign-ups plus staff-added. */}
            <FixtureAttendees fixture={f} count={signupCounts[f.id] || 0} roster={members}
              showToast={showToast} onChanged={load} />

            {/* On the ROW, not only in the create form: the events that most need
                artwork are the ones already in the calendar. Ken Grier exists
                already and has to be attachable without being recreated. */}
            <AttachmentField entityType="fixture" entityId={f.id} memberVisible hideNote />

            {/* The share draft. Every fixture is member-visible by RLS, so there is
                no visibility condition here — unlike calendar entries, where a
                staff-only row must get no box at all.
                The attendee list ABOVE is admin-only and deliberately not passed
                in: ShareInput has no field for it. */}
            <ShareBox entityType="fixture" entityId={f.id} entry={{
              type: f.type,
              title: f.title,
              blurb: f.description,          // fixtures.description IS member-visible
              date: f.date,
              where: f.location,
              capped: f.max_signups != null,
              url: 'https://therampantclub.com/members/events',
            }} />
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!confirmFixture}
        eyebrow={t('⚠ PERMANENT', '⚠ VĨNH VIỄN')}
        title={t('Delete event?', 'Xóa sự kiện?')}
        subject={confirmFixture?.title}
        body={confirmFixture
          ? `${t('Removes the event permanently, along with all', 'Xóa vĩnh viễn sự kiện, cùng với toàn bộ')} ${signupCounts[confirmFixture.id] || 0} ${t('sign-up', 'lượt đăng ký')}${(signupCounts[confirmFixture.id] || 0) === 1 ? '' : 's'}. ${t('Members can no longer see or join it. Cannot be undone.', 'Hội viên sẽ không còn thấy hoặc tham gia được. Không thể hoàn tác.')}`
          : ''}
        confirmLabel={t('Delete event', 'Xóa sự kiện')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
