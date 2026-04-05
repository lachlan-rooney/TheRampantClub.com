'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
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
  const [rules, setRules] = useState<HouseRule[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<HouseRule | null>(null)
  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionTitleVn, setSectionTitleVn] = useState('')
  const [body, setBody] = useState('')
  const [sortOrder, setSortOrder] = useState('0')

  const supabase = createBrowserSupabaseClient()

  const load = async () => {
    const { data } = await supabase.from('house_rules').select('*').order('sort_order')
    if (data) setRules(data)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setSectionTitle(''); setSectionTitleVn(''); setBody(''); setSortOrder('0')
    setEditing(null); setShowForm(false)
  }

  const startEdit = (r: HouseRule) => {
    setSectionTitle(r.section_title); setSectionTitleVn(r.section_title_vn || '')
    setBody(r.body); setSortOrder(r.sort_order.toString())
    setEditing(r); setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload = {
      section_title: sectionTitle, section_title_vn: sectionTitleVn || null,
      body, sort_order: parseInt(sortOrder) || 0,
    }
    if (editing) {
      await supabase.from('house_rules').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('house_rules').insert(payload)
    }
    resetForm(); load()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this rule?')) return
    await supabase.from('house_rules').delete().eq('id', id)
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          House Rules
        </h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>+ New Rule</button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `Editing: ${editing.section_title}` : 'New Rule'}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Section Title</label>
              <input style={inputStyle} value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Section Title (Vietnamese)</label>
              <input style={inputStyle} value={sectionTitleVn} onChange={e => setSectionTitleVn(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Sort Order</label>
              <input type="number" style={inputStyle} value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Body</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={6} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        {rules.map(r => (
          <div key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', minWidth: 24 }}>{r.sort_order}</span>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{r.section_title}</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => startEdit(r)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
