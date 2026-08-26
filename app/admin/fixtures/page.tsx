'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'
import type { Fixture } from '@/lib/types'

const SPORTS = ['golf', 'tennis', 'padel', 'hash', 'other'] as const
const SPORT_COLORS: Record<string, string> = {
  golf: '#5E6650', tennis: '#28483C', padel: '#B2AA98', hash: '#052E20', other: '#221E20',
}

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
  const { t } = useLang()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({})
  const [roster, setRoster] = useState<Record<string, string[]>>({})   // ADMIN-ONLY: fixture_id → member names
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fixture | null>(null)
  const [sport, setSport] = useState<Fixture['sport']>('golf')
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
  // Confirm modal — single destructive path (delete fixture).
  const [confirmFixture, setConfirmFixture] = useState<Fixture | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('fixtures').select('*').order('date', { ascending: false })
    if (data) setFixtures(data)
    const { data: pj } = await supabase.from('projects').select('id, name').eq('status', 'active').order('name')
    if (pj) setProjects(pj)
    const { data: signups } = await supabase.from('fixture_signups').select('fixture_id, user_id')
    if (signups) {
      const counts: Record<string, number> = {}
      const byFixture: Record<string, string[]> = {}
      signups.forEach((s: { fixture_id: string; user_id: string }) => {
        counts[s.fixture_id] = (counts[s.fixture_id] || 0) + 1
        ;(byFixture[s.fixture_id] ||= []).push(s.user_id)
      })
      setSignupCounts(counts)
      // Roster (WHO) — admin-only: resolve user_id → member name via profiles
      // (admin-readable). The member view + public /sports never run this.
      const ids = [...new Set(signups.map((s: { user_id: string }) => s.user_id))]
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids)
        const nameById: Record<string, string> = {}
        ;(profs || []).forEach((p: { id: string; display_name: string | null }) => { nameById[p.id] = p.display_name || p.id.slice(0, 8) })
        const ros: Record<string, string[]> = {}
        Object.entries(byFixture).forEach(([fid, uids]) => { ros[fid] = uids.map(u => nameById[u] || u.slice(0, 8)) })
        setRoster(ros)
      } else setRoster({})
    }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setSport('golf'); setTitle(''); setDescription(''); setDate(''); setLocation('')
    setMaxSignups(''); setSignupDeadline(''); setResults(''); setOpsProjectId('')
    setEditing(null); setShowForm(false)
  }

  const startEdit = (f: Fixture) => {
    setSport(f.sport); setTitle(f.title); setDescription(f.description || '')
    setDate(f.date ? new Date(f.date).toISOString().slice(0, 16) : '')
    setLocation(f.location || ''); setMaxSignups(f.max_signups?.toString() || '')
    setSignupDeadline(f.signup_deadline ? new Date(f.signup_deadline).toISOString().slice(0, 16) : '')
    setResults(f.results || ''); setOpsProjectId(f.ops_project_id || '')
    setEditing(f); setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload = {
      sport, title, description: description || null,
      date: new Date(date).toISOString(), location: location || null,
      max_signups: maxSignups ? parseInt(maxSignups) : null,
      signup_deadline: signupDeadline ? new Date(signupDeadline).toISOString() : null,
      results: results || null,
      ops_project_id: opsProjectId || null,
    }
    if (editing) {
      await supabase.from('fixtures').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('fixtures').insert(payload)
    }
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
          {t('Fixtures', 'Lịch thi đấu')}
        </h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>{t('+ New Fixture', '+ Trận đấu mới')}</button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `${t('Editing:', 'Đang sửa:')} ${editing.title}` : t('New Fixture', 'Trận đấu mới')}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Sport', 'Môn thể thao')}</label>
              <select style={inputStyle} value={sport} onChange={e => setSport(e.target.value as Fixture['sport'])}>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
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
                  color: '#E5D4C2', background: SPORT_COLORS[f.sport] || '#5E6650',
                  borderRadius: 4, padding: '2px 10px',
                }}>{f.sport}</span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{f.title}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                  {new Date(f.date).toLocaleDateString()} · {f.location || '—'}
                </span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                  {signupCounts[f.id] || 0} {t('signed up', 'đã đăng ký')}
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
            {/* ADMIN-ONLY roster — who signed up (member view + public /sports stay counts-only) */}
            {roster[f.id]?.length > 0 && (
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#8B8576', paddingLeft: 2 }}>
                ↳ {roster[f.id].join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!confirmFixture}
        eyebrow={t('⚠ PERMANENT', '⚠ VĨNH VIỄN')}
        title={t('Delete fixture?', 'Xóa trận đấu?')}
        subject={confirmFixture?.title}
        body={confirmFixture
          ? `${t('Removes the fixture permanently, along with all', 'Xóa vĩnh viễn trận đấu, cùng với toàn bộ')} ${signupCounts[confirmFixture.id] || 0} ${t('sign-up', 'lượt đăng ký')}${(signupCounts[confirmFixture.id] || 0) === 1 ? '' : 's'}. ${t('Members can no longer see or join it. Cannot be undone.', 'Hội viên sẽ không còn thấy hoặc tham gia được. Không thể hoàn tác.')}`
          : ''}
        confirmLabel={t('Delete fixture', 'Xóa trận đấu')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
