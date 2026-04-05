'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
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
  const [notices, setNotices] = useState<Notice[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Notice['category']>('general')
  const [pinned, setPinned] = useState(false)
  const [author, setAuthor] = useState('')

  const supabase = createBrowserSupabaseClient()

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this notice?')) return
    await supabase.from('notices').delete().eq('id', id)
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          Notices
        </h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>+ New Notice</button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 4 }}>
            {editing ? `Editing: ${editing.title}` : 'New Notice'}
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Body</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={6} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value as Notice['category'])}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Author</label>
              <input style={inputStyle} value={author} onChange={e => setAuthor(e.target.value)} />
            </div>
          </div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Pinned
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        {notices.map(n => (
          <div key={n.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{n.title}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#E5D4C2', background: 'rgba(229,212,194,0.1)', borderRadius: 4, padding: '2px 8px' }}>{n.category}</span>
                {n.pinned && <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#B2AA98' }}>◆ Pinned</span>}
              </div>
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                {n.author && `${n.author} · `}{new Date(n.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => startEdit(n)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
