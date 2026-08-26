'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'
import type { Notice } from '@/lib/types'

const CATEGORIES = ['committee', 'fixture', 'general', 'whisky'] as const

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

export default function AdminNotices() {
  const { t } = useLang()
  const [notices, setNotices] = useState<Notice[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Notice['category']>('general')
  const [pinned, setPinned] = useState(false)
  const [author, setAuthor] = useState('')

  const supabase = createBrowserSupabaseClient()

  const { showToast, toastNode } = useToast()
  // Confirm modal — single destructive path (delete notice).
  const [confirmNotice, setConfirmNotice] = useState<Notice | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
    if (data) setNotices(data)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setTitle(''); setBody(''); setCategory('general'); setPinned(false); setAuthor('')
    setEditing(null); setShowForm(false)
  }

  const startEdit = (n: Notice) => {
    setTitle(n.title); setBody(n.body); setCategory(n.category); setPinned(n.pinned); setAuthor(n.author || '')
    setEditing(n); setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload = { title, body, category, pinned, author: author || null }
    if (editing) {
      await supabase.from('notices').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('notices').insert(payload)
    }
    resetForm(); load()
  }

  const requestRemove = (n: Notice) => setConfirmNotice(n)
  const closeConfirm  = () => { if (!confirmBusy) setConfirmNotice(null) }
  const runRemove = async () => {
    if (!confirmNotice) return
    setConfirmBusy(true)
    try {
      const { error } = await supabase.from('notices').delete().eq('id', confirmNotice.id)
      if (error) { showToast(`${t('Delete failed', 'Xóa thất bại')}: ${error.message}`, 'error'); return }
      setConfirmNotice(null)
      load()
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          {t('Notices', 'Thông báo')}
        </h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>{t('+ New Notice', '+ Thông báo mới')}</button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 4 }}>
            {editing ? `${t('Editing', 'Đang chỉnh sửa')}: ${editing.title}` : t('New Notice', 'Thông báo mới')}
          </div>
          <div>
            <label style={labelStyle}>{t('Title', 'Tiêu đề')}</label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{t('Body', 'Nội dung')}</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={6} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Category', 'Danh mục')}</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value as Notice['category'])}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Author', 'Tác giả')}</label>
              <input style={inputStyle} value={author} onChange={e => setAuthor(e.target.value)} />
            </div>
          </div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> {t('Pinned', 'Đã ghim')}
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? t('Update', 'Cập nhật') : t('Create', 'Tạo mới')}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>{t('Cancel', 'Hủy')}</button>
          </div>
        </div>
      )}

      <div>
        {notices.map(n => (
          <div key={n.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{n.title}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', background: 'rgba(229,212,194,0.1)', borderRadius: 4, padding: '2px 8px' }}>{n.category}</span>
                {n.pinned && <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>◆ {t('Pinned', 'Đã ghim')}</span>}
              </div>
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                {n.author && `${n.author} · `}{new Date(n.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => startEdit(n)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>{t('Edit', 'Sửa')}</button>
              <button onClick={() => requestRemove(n)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>{t('Delete', 'Xóa')}</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!confirmNotice}
        eyebrow={t('⚠ PERMANENT', '⚠ VĨNH VIỄN')}
        title={t('Delete notice?', 'Xóa thông báo?')}
        subject={confirmNotice?.title}
        body={t('Removes the notice permanently. Members can no longer see it on the board. Cannot be undone.', 'Xóa thông báo vĩnh viễn. Hội viên sẽ không còn thấy nó trên bảng tin. Không thể hoàn tác.')}
        confirmLabel={t('Delete notice', 'Xóa thông báo')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
