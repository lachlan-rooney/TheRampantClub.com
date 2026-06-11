'use client'

import { useState } from 'react'

// Tablet enrolment entry (public). An admin issues a pairing code in the portal;
// typed here, the tablet exchanges it for a device token (the security boundary)
// and becomes a trusted kiosk. No PII here — just the handshake.

export default function KioskPair() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const pair = async () => {
    if (!code.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      if (r.ok) window.location.href = '/kiosk/staff'
      else setErr((await r.json().catch(() => ({})))?.error || 'Could not pair.')
    } finally { setBusy(false) }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={diamond} />
        <div style={title}>The Rampant Club</div>
        <div style={sub}>Kiosk enrolment</div>
        <p style={hint}>Enter the pairing code from the admin portal to make this tablet a trusted kiosk.</p>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') pair() }}
          placeholder="CODE" maxLength={8} autoFocus style={input} />
        {err && <div style={errStyle}>{err}</div>}
        <button onClick={pair} disabled={busy || !code.trim()} style={{ ...btn, opacity: busy || !code.trim() ? 0.4 : 1 }}>{busy ? 'Pairing…' : 'Pair this tablet'}</button>
      </div>
    </div>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const wrap: React.CSSProperties = { minHeight: '100vh', background: '#052E20', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
const card: React.CSSProperties = { width: 'min(420px, 92vw)', textAlign: 'center', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 16, background: 'rgba(229,212,194,0.03)', padding: '40px 32px' }
const diamond: React.CSSProperties = { width: 10, height: 10, background: '#D4B85A', transform: 'rotate(45deg)', opacity: 0.6, margin: '0 auto 24px' }
const title: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 24, color: '#E5D4C2', letterSpacing: '0.04em' }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }
const hint: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, margin: '20px 0 18px' }
const input: React.CSSProperties = { width: '100%', textAlign: 'center', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 10, color: '#E5D4C2', fontFamily: MONO, fontSize: 28, letterSpacing: '0.3em', padding: '14px 12px', outline: 'none', boxSizing: 'border-box' }
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 12 }
const btn: React.CSSProperties = { marginTop: 18, width: '100%', background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 10, padding: '14px', fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
