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

  // Toast for non-blocking notices (replaces alert()).
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4200)
  }
  // Confirm modal — single destructive path (delete rule).
  const [confirmRule, setConfirmRule] = useState<HouseRule | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

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

  const requestRemove = (r: HouseRule) => setConfirmRule(r)
  const closeConfirm  = () => { if (!confirmBusy) setConfirmRule(null) }
  const runRemove = async () => {
    if (!confirmRule) return
    setConfirmBusy(true)
    try {
      const { error } = await supabase.from('house_rules').delete().eq('id', confirmRule.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
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
              <button onClick={() => requestRemove(r)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Confirm modal (branded, replaces native window.confirm) ──── */}
      {confirmRule && (
        <>
          <div style={confirmBackdrop} onClick={closeConfirm} />
          <div style={confirmModalBox} role="dialog">
            <div style={confirmEyebrow}>⚠ PERMANENT</div>
            <div style={confirmTitle}>Delete house rule?</div>
            <div style={confirmSubject}>{confirmRule.section_title}</div>
            <p style={confirmBody}>
              Removes this rule section permanently. Members will no longer see it in the house rules. Cannot be undone.
            </p>
            <div style={confirmActions}>
              <button onClick={closeConfirm} disabled={confirmBusy} style={confirmCancelBtn}>Cancel</button>
              <button
                onClick={runRemove}
                disabled={confirmBusy}
                style={{ ...confirmGoBtn, opacity: confirmBusy ? 0.5 : 1 }}
              >
                {confirmBusy ? 'Deleting…' : 'Delete rule'}
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
