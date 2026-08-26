'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'

type PressType = 'kit' | 'release' | 'mention'

interface PressItem {
  id: string
  type: PressType
  title: string
  outlet: string | null
  body: string | null
  link: string | null
  image_url: string | null
  published_at: string | null
  is_published: boolean
  sort_order: number
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

const TYPE_LABEL: Record<PressType, string> = {
  kit: 'Press Kit',
  release: 'Press Release',
  mention: 'In the Press',
}

export default function AdminPress() {
  const { t } = useLang()
  const [items, setItems] = useState<PressItem[]>([])
  const [editing, setEditing] = useState<PressItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'release' as PressType, title: '', outlet: '', body: '',
    link: '', image_url: '', published_at: '',
    is_published: true, sort_order: 0,
  })
  const [busy, setBusy] = useState(false)
  const supabase = createBrowserSupabaseClient()

  const { showToast, toastNode } = useToast()
  // Confirm modal — single destructive path (delete press item).
  const [confirmItem, setConfirmItem] = useState<PressItem | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('press_items')
      .select('*')
      .order('type', { ascending: true })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('sort_order', { ascending: true })
    if (data) setItems(data as PressItem[])
  }
  useEffect(() => { load() }, [])

  const reset = () => {
    setEditing(null); setShowForm(false)
    setForm({ type: 'release', title: '', outlet: '', body: '', link: '', image_url: '', published_at: '', is_published: true, sort_order: 0 })
  }

  const startEdit = (i: PressItem) => {
    setEditing(i); setShowForm(true)
    setForm({
      type: i.type, title: i.title,
      outlet: i.outlet || '', body: i.body || '',
      link: i.link || '', image_url: i.image_url || '',
      published_at: i.published_at || '',
      is_published: i.is_published, sort_order: i.sort_order,
    })
  }

  const save = async () => {
    if (!form.title.trim()) { showToast(t('Title is required.', 'Cần nhập tiêu đề.'), 'error'); return }
    setBusy(true)
    const payload = {
      type: form.type,
      title: form.title.trim(),
      outlet: form.outlet.trim() || null,
      body: form.body.trim() || null,
      link: form.link.trim() || null,
      image_url: form.image_url.trim() || null,
      published_at: form.published_at || null,
      is_published: form.is_published,
      sort_order: form.sort_order,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('press_items').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('press_items').insert(payload)
    }
    setBusy(false); reset(); load()
  }

  const togglePublish = async (i: PressItem) => {
    await supabase.from('press_items')
      .update({ is_published: !i.is_published, updated_at: new Date().toISOString() })
      .eq('id', i.id)
    load()
  }

  const requestRemove = (i: PressItem) => setConfirmItem(i)
  const closeConfirm  = () => { if (!confirmBusy) setConfirmItem(null) }
  const runRemove = async () => {
    if (!confirmItem) return
    setConfirmBusy(true)
    try {
      const { error } = await supabase.from('press_items').delete().eq('id', confirmItem.id)
      if (error) { showToast(`${t('Delete failed', 'Xóa thất bại')}: ${error.message}`, 'error'); return }
      setConfirmItem(null)
      load()
    } finally {
      setConfirmBusy(false)
    }
  }

  const groups: Record<PressType, PressItem[]> = { kit: [], release: [], mention: [] }
  for (const i of items) groups[i.type].push(i)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          {t('Press', 'Báo chí')}
        </h1>
        {!showForm && <button onClick={() => setShowForm(true)} style={btnPrimary}>{t('+ New Press Item', '+ Mục báo chí mới')}</button>}
      </div>

      {showForm && (
        <div style={{
          padding: 24, marginBottom: 32,
          background: 'rgba(229,212,194,0.04)',
          border: '1px solid rgba(229,212,194,0.10)',
          borderRadius: 10,
          display: 'grid', gap: 14,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('Type', 'Loại')}</label>
              <select style={inputStyle} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as PressType }))}>
                <option value="release" style={{ background: '#052E20' }}>{t('Press Release', 'Thông cáo báo chí')}</option>
                <option value="kit"     style={{ background: '#052E20' }}>{t('Press Kit', 'Bộ tài liệu báo chí')}</option>
                <option value="mention" style={{ background: '#052E20' }}>{t('In the Press (coverage)', 'Truyền thông đưa tin (bài viết)')}</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t('Date', 'Ngày')}</label>
              <input type="date" style={inputStyle} value={form.published_at}
                onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('Title', 'Tiêu đề')}</label>
            <input style={inputStyle} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={form.type === 'mention' ? t('A members’ club worth knowing', 'Một câu lạc bộ hội viên đáng để biết đến') : t('The Rampant Club opens its doors', 'The Rampant Club mở cửa đón khách')}
            />
          </div>
          {form.type === 'mention' && (
            <div>
              <label style={labelStyle}>{t('Outlet', 'Đơn vị báo chí')}</label>
              <input style={inputStyle} value={form.outlet}
                onChange={e => setForm(f => ({ ...f, outlet: e.target.value }))}
                placeholder="Drinks Business, Saigon Times, Robb Report…"
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>{form.type === 'mention' ? t('Excerpt / pull quote', 'Trích đoạn / câu trích dẫn') : t('Description', 'Mô tả')}</label>
            <textarea
              rows={3}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={form.type === 'mention' ? t('"...one of the most distinctive private members’ clubs in Southeast Asia."', '"...một trong những câu lạc bộ hội viên tư nhân đặc sắc nhất Đông Nam Á."') : t('A short paragraph describing this kit/release.', 'Một đoạn ngắn mô tả bộ tài liệu/thông cáo này.')}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('Link (external URL or download)', 'Liên kết (URL bên ngoài hoặc tải xuống)')}</label>
              <input style={inputStyle} value={form.link}
                onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div>
              <label style={labelStyle}>{t('Image URL (optional)', 'URL hình ảnh (tùy chọn)')}</label>
              <input style={inputStyle} value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="/images/…"
              />
            </div>
          </div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_published}
              onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
            />
            {t('Published', 'Đã xuất bản')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={busy} style={btnPrimary}>
              {busy ? t('Saving…', 'Đang lưu…') : editing ? t('Update', 'Cập nhật') : t('Save', 'Lưu')}
            </button>
            <button onClick={reset} style={btn}>{t('Cancel', 'Hủy')}</button>
          </div>
        </div>
      )}

      {(['release', 'mention', 'kit'] as PressType[]).map(pt => (
        <section key={pt} style={{ marginBottom: 32 }}>
          <h2 style={{
            fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
            color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 12,
          }}>
            {TYPE_LABEL[pt]} &middot; <span style={{ opacity: 0.5, fontSize: 12 }}>{groups[pt].length}</span>
          </h2>
          {groups[pt].length === 0 ? (
            <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.5 }}>
              {t('None yet.', 'Chưa có mục nào.')}
            </p>
          ) : groups[pt].map(i => (
            <div key={i.id} style={{
              padding: '12px 0', borderBottom: '1px solid rgba(229,212,194,0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <span style={{
                  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
                  background: i.is_published ? 'rgba(94,102,80,0.4)' : 'rgba(178,170,152,0.18)',
                  color: '#E5D4C2', borderRadius: 4, padding: '2px 8px', marginRight: 10,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {i.is_published ? t('Live', 'Đang hiển thị') : t('Draft', 'Bản nháp')}
                </span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{i.title}</span>
                <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6, marginTop: 4 }}>
                  {i.outlet ? `${i.outlet} · ` : ''}
                  {i.published_at ? new Date(i.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : t('no date', 'chưa có ngày')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => togglePublish(i)} style={btn}>
                  {i.is_published ? t('Unpublish', 'Gỡ xuất bản') : t('Publish', 'Xuất bản')}
                </button>
                <button onClick={() => startEdit(i)} style={btn}>{t('Edit', 'Sửa')}</button>
                <button onClick={() => requestRemove(i)} style={btnDanger}>{t('Delete', 'Xóa')}</button>
              </div>
            </div>
          ))}
        </section>
      ))}

      <ConfirmModal
        open={!!confirmItem}
        eyebrow={t('⚠ PERMANENT', '⚠ VĨNH VIỄN')}
        title={t('Delete press item?', 'Xóa mục báo chí?')}
        subject={confirmItem?.title}
        body={confirmItem
          ? `${t('Removes this', 'Gỡ bỏ')} ${TYPE_LABEL[confirmItem.type].toLowerCase()} ${t('permanently from the press page. Cannot be undone.', 'này khỏi trang báo chí vĩnh viễn. Không thể hoàn tác.')}`
          : ''}
        confirmLabel={t('Delete item', 'Xóa mục')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
