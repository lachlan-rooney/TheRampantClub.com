'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
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
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({})
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

  const supabase = createBrowserSupabaseClient()

  // Toast for non-blocking notices (replaces alert()).
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4200)
  }
  // Confirm modal — single destructive path (delete fixture).
  const [confirmFixture, setConfirmFixture] = useState<Fixture | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('fixtures').select('*').order('date', { ascending: false })
    if (data) setFixtures(data)
    const { data: signups } = await supabase.from('fixture_signups').select('fixture_id')
    if (signups) {
      const counts: Record<string, number> = {}
      signups.forEach(s => { counts[s.fixture_id] = (counts[s.fixture_id] || 0) + 1 })
      setSignupCounts(counts)
    }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setSport('golf'); setTitle(''); setDescription(''); setDate(''); setLocation('')
    setMaxSignups(''); setSignupDeadline(''); setResults('')
    setEditing(null); setShowForm(false)
  }

  const startEdit = (f: Fixture) => {
    setSport(f.sport); setTitle(f.title); setDescription(f.description || '')
    setDate(f.date ? new Date(f.date).toISOString().slice(0, 16) : '')
    setLocation(f.location || ''); setMaxSignups(f.max_signups?.toString() || '')
    setSignupDeadline(f.signup_deadline ? new Date(f.signup_deadline).toISOString().slice(0, 16) : '')
    setResults(f.results || '')
    setEditing(f); setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload = {
      sport, title, description: description || null,
      date: new Date(date).toISOString(), location: location || null,
      max_signups: maxSignups ? parseInt(maxSignups) : null,
      signup_deadline: signupDeadline ? new Date(signupDeadline).toISOString() : null,
      results: results || null,
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
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
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
          Fixtures
        </h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>+ New Fixture</button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `Editing: ${editing.title}` : 'New Fixture'}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Sport</label>
              <select style={inputStyle} value={sport} onChange={e => setSport(e.target.value as Fixture['sport'])}>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date &amp; Time</label>
              <input type="datetime-local" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Max Sign-ups</label>
              <input type="number" style={inputStyle} value={maxSignups} onChange={e => setMaxSignups(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Sign-up Deadline</label>
              <input type="datetime-local" style={inputStyle} value={signupDeadline} onChange={e => setSignupDeadline(e.target.value)} />
            </div>
          </div>
          {editing && isPast(editing.date) && (
            <div>
              <label style={labelStyle}>Results</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={results} onChange={e => setResults(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        {fixtures.map(f => (
          <div key={f.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                {signupCounts[f.id] || 0} signed up
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => startEdit(f)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => requestRemove(f)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Confirm modal (branded, replaces native window.confirm) ──── */}
      {confirmFixture && (
        <>
          <div style={confirmBackdrop} onClick={closeConfirm} />
          <div style={confirmModalBox} role="dialog">
            <div style={confirmEyebrow}>⚠ PERMANENT</div>
            <div style={confirmTitle}>Delete fixture?</div>
            <div style={confirmSubject}>{confirmFixture.title}</div>
            <p style={confirmBody}>
              Removes the fixture permanently, along with all {signupCounts[confirmFixture.id] || 0} sign-up{(signupCounts[confirmFixture.id] || 0) === 1 ? '' : 's'}. Members can no longer see or join it. Cannot be undone.
            </p>
            <div style={confirmActions}>
              <button onClick={closeConfirm} disabled={confirmBusy} style={confirmCancelBtn}>Cancel</button>
              <button
                onClick={runRemove}
                disabled={confirmBusy}
                style={{ ...confirmGoBtn, opacity: confirmBusy ? 0.5 : 1 }}
              >
                {confirmBusy ? 'Deleting…' : 'Delete fixture'}
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
