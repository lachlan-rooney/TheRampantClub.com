'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'

interface Entry {
  id: string
  title: string
  body: string
  excerpt: string | null
  author_name: string | null
  cover_image_url: string | null
  related_whisky_id: string | null
  is_published: boolean
  published_at: string
  created_at: string
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', display: 'block', marginBottom: 4,
}
const btn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.10)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '8px 18px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
}
const btnPrimary = { ...btn, background: '#5E6650' }
const btnDanger  = { ...btn, background: 'rgba(180,70,70,0.2)' }

export default function AdminJournal() {
  const { t } = useLang()
  const [entries, setEntries] = useState<Entry[]>([])
  const [editing, setEditing] = useState<Entry | null>(null)
  const [form, setForm] = useState({
    title: '', body: '', excerpt: '', author_name: 'The Cellarmaster',
    cover_image_url: '', is_published: true,
  })
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const supabase = createBrowserSupabaseClient()

  const load = async () => {
    const { data } = await supabase.from('journal_entries')
      .select('*').order('published_at', { ascending: false })
    if (data) setEntries(data as Entry[])
  }
  useEffect(() => { load() }, [])

  const reset = () => {
    setEditing(null); setShowForm(false)
    setForm({ title: '', body: '', excerpt: '', author_name: 'The Cellarmaster', cover_image_url: '', is_published: true })
  }

  const startEdit = (e: Entry) => {
    setEditing(e); setShowForm(true)
    setForm({
      title: e.title, body: e.body,
      excerpt: e.excerpt || '', author_name: e.author_name || 'The Cellarmaster',
      cover_image_url: e.cover_image_url || '', is_published: e.is_published,
    })
  }

  const { showToast, toastNode } = useToast()
  // Confirm modal — single destructive path (delete entry).
  const [confirmEntry, setConfirmEntry] = useState<Entry | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast(t('Title and body are required.', 'Tiêu đề và nội dung là bắt buộc.'), 'error'); return
    }
    setBusy(true)
    const payload = {
      title: form.title.trim(),
      body: form.body,
      excerpt: form.excerpt.trim() || null,
      author_name: form.author_name.trim() || 'The Cellarmaster',
      cover_image_url: form.cover_image_url.trim() || null,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('journal_entries').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('journal_entries').insert({ ...payload, published_at: new Date().toISOString() })
    }
    setBusy(false); reset(); load()
  }

  const togglePublish = async (e: Entry) => {
    await supabase.from('journal_entries')
      .update({ is_published: !e.is_published, updated_at: new Date().toISOString() })
      .eq('id', e.id)
    load()
  }

  const requestRemove = (e: Entry) => setConfirmEntry(e)
  const closeConfirm  = () => { if (!confirmBusy) setConfirmEntry(null) }
  const runRemove = async () => {
    if (!confirmEntry) return
    setConfirmBusy(true)
    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', confirmEntry.id)
      if (error) { showToast(`${t('Delete failed', 'Xóa thất bại')}: ${error.message}`, 'error'); return }
      setConfirmEntry(null)
      load()
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          {t("The Cellarmaster's Journal", 'Nhật ký của The Cellarmaster')}
        </h1>
        {!showForm && <button onClick={() => setShowForm(true)} style={btnPrimary}>{t('+ New Entry', '+ Bài viết mới')}</button>}
      </div>

      {showForm && (
        <div style={{
          padding: 24, marginBottom: 32,
          background: 'rgba(229,212,194,0.04)',
          border: '1px solid rgba(229,212,194,0.10)',
          borderRadius: 10,
          display: 'grid', gap: 14,
        }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? t('Edit entry', 'Sửa bài viết') : t('New entry', 'Bài viết mới')}
          </div>
          <div>
            <label style={labelStyle}>{t('Title', 'Tiêu đề')}</label>
            <input style={inputStyle} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t('On the matter of Mizunara', 'Về chủ đề gỗ sồi Mizunara')}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('Excerpt (optional, shown on the index)', 'Đoạn trích (không bắt buộc, hiển thị ở trang danh sách)')}</label>
            <input style={inputStyle} value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder={t("A few words on Japan's most distinctive cask.", 'Đôi lời về loại thùng gỗ đặc trưng nhất của Nhật Bản.')}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('Body (Markdown-ish — line breaks render as paragraphs)', 'Nội dung (kiểu Markdown — ngắt dòng sẽ thành đoạn văn)')}</label>
            <textarea
              rows={12}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', minHeight: 220 }}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={t('The cask comes from Quercus mizuno, a slow-growing Japanese oak…', 'Loại thùng này làm từ Quercus mizuno, một giống sồi Nhật Bản sinh trưởng chậm…')}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('Author', 'Tác giả')}</label>
              <input style={inputStyle} value={form.author_name}
                onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('Cover image URL (optional)', 'URL ảnh bìa (không bắt buộc)')}</label>
              <input style={inputStyle} value={form.cover_image_url}
                onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                placeholder="/images/…"
              />
            </div>
          </div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_published}
              onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
            />
            {t('Published — visible to members', 'Đã đăng — hội viên có thể xem')}
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={save} disabled={busy} style={btnPrimary}>
              {busy ? t('Saving…', 'Đang lưu…') : editing ? t('Update', 'Cập nhật') : t('Publish', 'Đăng')}
            </button>
            <button onClick={reset} style={btn}>{t('Cancel', 'Hủy')}</button>
          </div>
        </div>
      )}

      <div>
        {entries.length === 0 && (
          <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98' }}>
            {t('No entries yet. Write the first one.', 'Chưa có bài viết nào. Hãy viết bài đầu tiên.')}
          </p>
        )}
        {entries.map(e => (
          <div key={e.id} style={{
            padding: '14px 0', borderBottom: '1px solid rgba(229,212,194,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span style={{
                fontFamily: "'Google Sans Code', monospace", fontSize: 10,
                background: e.is_published ? 'rgba(94,102,80,0.4)' : 'rgba(178,170,152,0.18)',
                color: '#E5D4C2', borderRadius: 4, padding: '2px 8px', marginRight: 10,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {e.is_published ? t('Live', 'Đang hiển thị') : t('Draft', 'Bản nháp')}
              </span>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{e.title}</span>
              <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6, marginTop: 4 }}>
                {e.author_name} · {new Date(e.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => togglePublish(e)} style={btn}>
                {e.is_published ? t('Unpublish', 'Gỡ đăng') : t('Publish', 'Đăng')}
              </button>
              <button onClick={() => startEdit(e)} style={btn}>{t('Edit', 'Sửa')}</button>
              <button onClick={() => requestRemove(e)} style={btnDanger}>{t('Delete', 'Xóa')}</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!confirmEntry}
        eyebrow={t('⚠ PERMANENT', '⚠ VĨNH VIỄN')}
        title={t('Delete journal entry?', 'Xóa bài viết nhật ký?')}
        subject={confirmEntry?.title}
        body={t('Removes the entry permanently. Members can no longer read it, and any links to it will break. Cannot be undone.', 'Xóa vĩnh viễn bài viết này. Hội viên sẽ không còn đọc được, và mọi liên kết tới bài sẽ hỏng. Không thể hoàn tác.')}
        confirmLabel={t('Delete entry', 'Xóa bài viết')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
