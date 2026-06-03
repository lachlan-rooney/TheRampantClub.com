'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

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

  // Toast for non-blocking notices (replaces alert()).
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4200)
  }
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
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return }
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
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
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
          Press
        </h1>
        {!showForm && <button onClick={() => setShowForm(true)} style={btnPrimary}>+ New Press Item</button>}
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
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as PressType }))}>
                <option value="release" style={{ background: '#052E20' }}>Press Release</option>
                <option value="kit"     style={{ background: '#052E20' }}>Press Kit</option>
                <option value="mention" style={{ background: '#052E20' }}>In the Press (coverage)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" style={inputStyle} value={form.published_at}
                onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={form.type === 'mention' ? 'A members’ club worth knowing' : 'The Rampant Club opens its doors'}
            />
          </div>
          {form.type === 'mention' && (
            <div>
              <label style={labelStyle}>Outlet</label>
              <input style={inputStyle} value={form.outlet}
                onChange={e => setForm(f => ({ ...f, outlet: e.target.value }))}
                placeholder="Drinks Business, Saigon Times, Robb Report…"
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>{form.type === 'mention' ? 'Excerpt / pull quote' : 'Description'}</label>
            <textarea
              rows={3}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={form.type === 'mention' ? '"...one of the most distinctive private members’ clubs in Southeast Asia."' : 'A short paragraph describing this kit/release.'}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Link (external URL or download)</label>
              <input style={inputStyle} value={form.link}
                onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div>
              <label style={labelStyle}>Image URL (optional)</label>
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
            Published
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={busy} style={btnPrimary}>
              {busy ? 'Saving…' : editing ? 'Update' : 'Save'}
            </button>
            <button onClick={reset} style={btn}>Cancel</button>
          </div>
        </div>
      )}

      {(['release', 'mention', 'kit'] as PressType[]).map(t => (
        <section key={t} style={{ marginBottom: 32 }}>
          <h2 style={{
            fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
            color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 12,
          }}>
            {TYPE_LABEL[t]} &middot; <span style={{ opacity: 0.5, fontSize: 12 }}>{groups[t].length}</span>
          </h2>
          {groups[t].length === 0 ? (
            <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.5 }}>
              None yet.
            </p>
          ) : groups[t].map(i => (
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
                  {i.is_published ? 'Live' : 'Draft'}
                </span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{i.title}</span>
                <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6, marginTop: 4 }}>
                  {i.outlet ? `${i.outlet} · ` : ''}
                  {i.published_at ? new Date(i.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'no date'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => togglePublish(i)} style={btn}>
                  {i.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => startEdit(i)} style={btn}>Edit</button>
                <button onClick={() => requestRemove(i)} style={btnDanger}>Delete</button>
              </div>
            </div>
          ))}
        </section>
      ))}

      {/* ── Confirm modal (branded, replaces native window.confirm) ──── */}
      {confirmItem && (
        <>
          <div style={confirmBackdrop} onClick={closeConfirm} />
          <div style={confirmModalBox} role="dialog">
            <div style={confirmEyebrow}>⚠ PERMANENT</div>
            <div style={confirmTitle}>Delete press item?</div>
            <div style={confirmSubject}>{confirmItem.title}</div>
            <p style={confirmBody}>
              Removes this {TYPE_LABEL[confirmItem.type].toLowerCase()} permanently from the press page. Cannot be undone.
            </p>
            <div style={confirmActions}>
              <button onClick={closeConfirm} disabled={confirmBusy} style={confirmCancelBtn}>Cancel</button>
              <button
                onClick={runRemove}
                disabled={confirmBusy}
                style={{ ...confirmGoBtn, opacity: confirmBusy ? 0.5 : 1 }}
              >
                {confirmBusy ? 'Deleting…' : 'Delete item'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div style={toast.tone === 'error' ? toastErrorBox : toastInfoBox} role="status">
          <span style={{ marginRight: 8, color: toast.tone === 'error' ? '#C27070' : '#7AB07A' }}>
            {toast.tone === 'error' ? '✕' : '✓'}
          </span>
          {toast.message}
        </div>
      )}
    </>
  )
}

// ── Confirm + toast styles ──────────────────────────────────────────
const confirmBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300,
}
const confirmModalBox: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(480px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 301,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const confirmEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#C27070', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
  marginBottom: 8,
}
const confirmTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.02em', marginBottom: 6,
}
const confirmSubject: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', marginBottom: 12,
}
const confirmBody: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, marginBottom: 14,
}
const confirmActions: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
}
const confirmCancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const confirmGoBtn: React.CSSProperties = {
  background: '#C27070', color: '#FFFFFF',
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const toastBase: React.CSSProperties = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 400,
  padding: '12px 18px',
  background: '#0A3526',
  borderRadius: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.02em',
  display: 'flex', alignItems: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
}
const toastInfoBox: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(122,176,122,0.45)',
  borderLeft: '3px solid #7AB07A',
}
const toastErrorBox: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
}
