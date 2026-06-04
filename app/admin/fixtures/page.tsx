'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
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

  const supabase = createBrowserSupabaseClient()

  const { showToast, toastNode } = useToast()
  // Confirm modal — single destructive path (delete fixture).
  const [confirmFixture, setConfirmFixture] = useState<Fixture | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('fixtures').select('*').order('date', { ascending: false })
    if (data) setFixtures(data)
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
                  {signupCounts[f.id] || 0} signed up
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => startEdit(f)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => requestRemove(f)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Delete</button>
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
        eyebrow="⚠ PERMANENT"
        title="Delete fixture?"
        subject={confirmFixture?.title}
        body={confirmFixture
          ? `Removes the fixture permanently, along with all ${signupCounts[confirmFixture.id] || 0} sign-up${(signupCounts[confirmFixture.id] || 0) === 1 ? '' : 's'}. Members can no longer see or join it. Cannot be undone.`
          : ''}
        confirmLabel="Delete fixture"
        busyLabel="Deleting…"
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runRemove}
      />

      {toastNode}
    </>
  )
}
