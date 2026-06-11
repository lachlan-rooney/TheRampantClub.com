'use client'

import { useEffect, useState } from 'react'

// "Click who you are" — the shared staff login picks a team_member (+ PIN) before
// the portal. Attribution, not access (the login is the boundary). Mirrors the
// kiosk staff picker.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
interface Staff { id: string; display_name: string; role_title?: string | null }

export default function AdminWho() {
  const [roster, setRoster] = useState<Staff[]>([])
  const [picking, setPicking] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/acting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'roster' }) })
      .then(r => r.ok ? r.json() : { staff: [] }).then(j => setRoster(j.staff || []))
  }, [])

  const submit = async () => {
    if (!picking || pin.length < 4) return
    const r = await fetch('/api/admin/acting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pick', team_member_id: picking.id, pin }) })
    if (r.ok) window.location.href = '/admin'
    else { setErr((await r.json().catch(() => ({})))?.error || 'Wrong PIN.'); setPin('') }
  }

  return (
    <div style={wrap}>
      {picking ? (
        <div style={{ textAlign: 'center', width: 'min(360px, 92vw)' }}>
          <button onClick={() => { setPicking(null); setPin(''); setErr('') }} style={back}>← Not you?</button>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, color: '#E5D4C2', margin: '8px 0 4px' }}>{picking.display_name}</div>
          <div style={muted}>Enter your PIN</div>
          <div style={dots}>{Array.from({ length: Math.max(4, pin.length) }).map((_, i) => <span key={i} style={{ ...dot, background: i < pin.length ? '#D4B85A' : 'transparent' }} />)}</div>
          {err && <div style={errS}>{err}</div>}
          <div style={pad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => { setErr(''); setPin(p => (p + d).slice(0, 8)) }} style={key}>{d}</button>)}
            <button onClick={() => setPin(p => p.slice(0, -1))} style={key}>←</button>
            <button onClick={() => { setErr(''); setPin(p => (p + '0').slice(0, 8)) }} style={key}>0</button>
            <button onClick={submit} disabled={pin.length < 4} style={{ ...key, ...keyGo, opacity: pin.length < 4 ? 0.4 : 1 }}>→</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', width: 'min(640px, 94vw)' }}>
          <div style={kicker}>The Rampant Club · Admin</div>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', margin: '10px 0 22px' }}>Who are you?</div>
          {roster.length === 0 ? (
            <div style={muted}>No staff PINs set yet — set them in Kiosk → Staff PINs.</div>
          ) : (
            <div style={grid}>
              {roster.map(s => (
                <button key={s.id} onClick={() => { setPicking(s); setErr('') }} style={nameBtn}>
                  <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2' }}>{s.display_name}</div>
                  {s.role_title && <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginTop: 3 }}>{s.role_title}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const wrap: React.CSSProperties = { minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.8, lineHeight: 1.7 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }
const nameBtn: React.CSSProperties = { padding: '24px 16px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(212,184,90,0.25)', borderRadius: 14, cursor: 'pointer' }
const back: React.CSSProperties = { background: 'transparent', border: 'none', color: '#B2AA98', fontFamily: MONO, fontSize: 12, cursor: 'pointer', marginBottom: 8 }
const dots: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 12, margin: '18px 0' }
const dot: React.CSSProperties = { width: 14, height: 14, borderRadius: '50%', border: '1px solid #D4B85A' }
const pad: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }
const key: React.CSSProperties = { padding: '20px 0', background: 'rgba(229,212,194,0.05)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 12, fontFamily: MONO, fontSize: 24, color: '#E5D4C2', cursor: 'pointer' }
const keyGo: React.CSSProperties = { background: 'rgba(212,184,90,0.18)', border: '1px solid #D4B85A', color: '#D4B85A' }
const errS: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C27070' }
