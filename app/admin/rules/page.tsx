'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'
import type { HouseRule } from '@/lib/types'

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

export default function AdminRules() {
  const { t } = useLang()
  const [rules, setRules] = useState<HouseRule[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<HouseRule | null>(null)
  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionTitleVn, setSectionTitleVn] = useState('')
  const [body, setBody] = useState('')
  const [bodyVn, setBodyVn] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [translating, setTranslating] = useState(false)

  const supabase = createBrowserSupabaseClient()

  const { showToast, toastNode } = useToast()
  // Confirm modal — single destructive path (delete rule).
  const [confirmRule, setConfirmRule] = useState<HouseRule | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('house_rules').select('*').order('sort_order')
    if (data) setRules(data)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setSectionTitle(''); setSectionTitleVn(''); setBody(''); setBodyVn(''); setSortOrder('0')
    setEditing(null); setShowForm(false)
  }

  const startEdit = (r: HouseRule) => {
    setSectionTitle(r.section_title); setSectionTitleVn(r.section_title_vn || '')
    setBody(r.body); setBodyVn(r.body_vn || ''); setSortOrder(r.sort_order.toString())
    setEditing(r); setShowForm(true)
  }

  // Typing in a Vietnamese box marks that field as WRITTEN BY A PERSON, and the
  // translator never touches a field marked that way again. Only a real change
  // counts: opening a machine translation, reading it and saving without edits
  // would otherwise lock it as human work and freeze a rough draft in place.
  const changed = (now: string, before: string | null | undefined) =>
    now.trim() !== (before || '').trim()

  const handleSubmit = async () => {
    const payload: Record<string, unknown> = {
      section_title: sectionTitle, section_title_vn: sectionTitleVn || null,
      body, body_vn: bodyVn || null, sort_order: parseInt(sortOrder) || 0,
    }
    if (changed(sectionTitleVn, editing?.section_title_vn)) payload.title_vn_source = sectionTitleVn ? 'human' : null
    if (changed(bodyVn, editing?.body_vn))                  payload.body_vn_source  = bodyVn ? 'human' : null
    if (editing) {
      await supabase.from('house_rules').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('house_rules').insert(payload)
    }
    resetForm(); load()
  }

  // Fill in the Vietnamese that nobody has written yet. Never overwrites a
  // field marked 'human' — the report says how many it left alone.
  const runTranslate = async () => {
    setTranslating(true)
    try {
      const res = await fetch('/api/admin/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const out = await res.json().catch(() => null)
      if (!res.ok) { showToast(out?.error || t('Translation failed.', 'Dịch thất bại.'), 'error'); return }
      const firstFailure = out?.failed?.[0]?.why
      showToast(firstFailure ? `${out.summary} — ${firstFailure}` : out.summary,
        out?.failed?.length ? 'error' : 'success')
      load()
    } finally {
      setTranslating(false)
    }
  }

  const requestRemove = (r: HouseRule) => setConfirmRule(r)
  const closeConfirm  = () => { if (!confirmBusy) setConfirmRule(null) }
  const runRemove = async () => {
    if (!confirmRule) return
    setConfirmBusy(true)
    try {
      const { error } = await supabase.from('house_rules').delete().eq('id', confirmRule.id)
      if (error) { showToast(`${t('Delete failed', 'Xóa thất bại')}: ${error.message}`, 'error'); return }
      setConfirmRule(null)
      load()
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          {t('House Rules', 'Nội Quy')}
        </h1>
        {!showForm && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={runTranslate} disabled={translating} style={{ ...btnStyle, opacity: translating ? 0.5 : 1 }}>
              {translating ? t('Translating…', 'Đang dịch…') : t('Translate to Vietnamese', 'Dịch sang Tiếng Việt')}
            </button>
            <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>{t('+ New Rule', '+ Nội quy mới')}</button>
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `${t('Editing', 'Đang sửa')}: ${editing.section_title}` : t('New Rule', 'Nội quy mới')}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>{t('Section Title', 'Tiêu đề mục')}</label>
              <input style={inputStyle} value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>{t('Section Title (Vietnamese)', 'Tiêu đề mục (Tiếng Việt)')}</label>
              <input style={inputStyle} value={sectionTitleVn} onChange={e => setSectionTitleVn(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Sort Order', 'Thứ tự sắp xếp')}</label>
              <input type="number" style={inputStyle} value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('Body', 'Nội dung')}</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={6} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>
              {t('Body (Vietnamese)', 'Nội dung (Tiếng Việt)')}
              {editing?.body_vn_source === 'machine' && ` — ${t('machine translation; edit it and it becomes yours', 'bản dịch máy; sửa là thành của bạn')}`}
            </label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={6} value={bodyVn} onChange={e => setBodyVn(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? t('Update', 'Cập nhật') : t('Create', 'Tạo mới')}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>{t('Cancel', 'Hủy')}</button>
          </div>
        </div>
      )}

      <div>
        {rules.map(r => (
          <div key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', minWidth: 24 }}>{r.sort_order}</span>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{r.section_title}</span>
              {/* Where the Vietnamese came from, at a glance — so nobody has to
                  open a rule to find out whether it has been read by a person. */}
              <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, letterSpacing: '0.06em',
                color: r.body_vn_source === 'human' ? '#D4B85A' : '#B2AA98', opacity: r.body_vn ? 0.9 : 0.4 }}>
                {!r.body_vn ? t('NO VN', 'CHƯA CÓ TV')
                  : r.body_vn_source === 'human' ? t('VN · BY HAND', 'TV · NGƯỜI DỊCH')
                  : t('VN · MACHINE', 'TV · DỊCH MÁY')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => startEdit(r)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>{t('Edit', 'Sửa')}</button>
              <button onClick={() => requestRemove(r)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>{t('Delete', 'Xóa')}</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!confirmRule}
        eyebrow={t('⚠ PERMANENT', '⚠ VĨNH VIỄN')}
        title={t('Delete house rule?', 'Xóa nội quy này?')}
        subject={confirmRule?.section_title}
        body={t('Removes this rule section permanently. Members will no longer see it in the house rules. Cannot be undone.', 'Xóa vĩnh viễn mục nội quy này. Hội viên sẽ không còn thấy nó trong nội quy. Không thể hoàn tác.')}
        confirmLabel={t('Delete rule', 'Xóa nội quy')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
