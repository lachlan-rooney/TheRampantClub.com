'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// The gated kiosk shell (device session already verified by middleware). Layer 2:
// the staff picker (attribution). Tap your name → PIN → you're the acting staff.
// Auto-logout on inactivity drops back to the picker so a tablet left on the bar
// never sits on member data. Phase 1 ships the secure shell; the Ritual floor
// surfaces (Overture brief, Accord capture) land in Phase 2.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const IDLE_MS = 180_000   // 3 min idle → back to the picker

interface Staff { id: string; display_name: string; role_title?: string | null }

export default function KioskStaff() {
  const [me, setMe] = useState<Staff | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [roster, setRoster] = useState<Staff[]>([])
  const [picking, setPicking] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadMe = useCallback(async () => {
    const r = await fetch('/api/kiosk/staff/me')
    if (r.ok) { const j = await r.json(); setMe(j.staff || null); if (!j.staff) loadRoster() }
    setLoaded(true)
  }, [])
  const loadRoster = async () => { const r = await fetch('/api/kiosk/staff/roster'); if (r.ok) setRoster((await r.json()).staff || []) }

  const logout = useCallback(async () => {
    await fetch('/api/kiosk/staff/logout', { method: 'POST' })
    setMe(null); setPicking(null); setPin(''); loadRoster()
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  // Inactivity auto-logout (only while acting).
  useEffect(() => {
    if (!me) return
    const reset = () => { if (idle.current) clearTimeout(idle.current); idle.current = setTimeout(logout, IDLE_MS) }
    reset()
    const evs = ['pointerdown', 'keydown', 'touchstart']
    evs.forEach(e => window.addEventListener(e, reset))
    return () => { if (idle.current) clearTimeout(idle.current); evs.forEach(e => window.removeEventListener(e, reset)) }
  }, [me, logout])

  const submitPin = async () => {
    if (!picking || pin.length < 4) return
    const r = await fetch('/api/kiosk/staff/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: picking.id, pin }) })
    if (r.ok) { const j = await r.json(); setMe({ id: picking.id, display_name: j.name }); setPicking(null); setPin('') }
    else { setErr((await r.json().catch(() => ({})))?.error || 'Wrong PIN.'); setPin('') }
  }

  if (!loaded) return <Center><div style={muted}>…</div></Center>

  // ── Acting: the (empty, secure) shell ──
  if (me) return (
    <Center>
      <div style={{ textAlign: 'center' }}>
        <div style={kicker}>The Rampant Club · Floor</div>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 30, color: '#E5D4C2', margin: '12px 0 4px' }}>Good evening, {me.display_name}.</div>
        <div style={muted}>The floor is yours. The briefing, the Accord and the Continuum arrive here next.</div>
        <div style={shellNote}>Phase 1 · secure shell · the Ritual surfaces land in Phase 2</div>
        <button onClick={logout} style={switchBtn}>I’m done · switch user</button>
      </div>
    </Center>
  )

  // ── PIN pad ──
  if (picking) return (
    <Center>
      <div style={{ textAlign: 'center', width: 'min(360px, 92vw)' }}>
        <button onClick={() => { setPicking(null); setPin(''); setErr('') }} style={backBtn}>← Not you?</button>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, color: '#E5D4C2', margin: '8px 0 4px' }}>{picking.display_name}</div>
        <div style={muted}>Enter your PIN</div>
        <div style={pinDots}>{[0, 1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(4, pin.length)).map(i => <span key={i} style={{ ...pinDot, background: i < pin.length ? '#D4B85A' : 'transparent' }} />)}</div>
        {err && <div style={errStyle}>{err}</div>}
        <div style={pad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => { setErr(''); setPin(p => (p + d).slice(0, 8)) }} style={key}>{d}</button>)}
          <button onClick={() => setPin(p => p.slice(0, -1))} style={key}>←</button>
          <button onClick={() => { setErr(''); setPin(p => (p + '0').slice(0, 8)) }} style={key}>0</button>
          <button onClick={submitPin} disabled={pin.length < 4} style={{ ...key, ...keyGo, opacity: pin.length < 4 ? 0.4 : 1 }}>→</button>
        </div>
      </div>
    </Center>
  )

  // ── Staff picker ──
  return (
    <Center>
      <div style={{ textAlign: 'center', width: 'min(640px, 94vw)' }}>
        <div style={kicker}>The Rampant Club · Floor</div>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', margin: '10px 0 22px' }}>Who’s on the floor?</div>
        {roster.length === 0 ? (
          <div style={muted}>No staff PINs set yet. An admin sets them in the portal.</div>
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
    </Center>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</div>
}

const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.8, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }
const shellNote: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#7E7864', letterSpacing: '0.06em', marginTop: 24 }
const switchBtn: React.CSSProperties = { marginTop: 28, background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 24, padding: '12px 28px', fontFamily: MONO, fontSize: 13, color: '#B2AA98', cursor: 'pointer' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }
const nameBtn: React.CSSProperties = { padding: '24px 16px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(212,184,90,0.25)', borderRadius: 14, cursor: 'pointer' }
const backBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#B2AA98', fontFamily: MONO, fontSize: 12, cursor: 'pointer', marginBottom: 8 }
const pinDots: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 12, margin: '18px 0' }
const pinDot: React.CSSProperties = { width: 14, height: 14, borderRadius: '50%', border: '1px solid #D4B85A' }
const pad: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }
const key: React.CSSProperties = { padding: '20px 0', background: 'rgba(229,212,194,0.05)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 12, fontFamily: MONO, fontSize: 24, color: '#E5D4C2', cursor: 'pointer' }
const keyGo: React.CSSProperties = { background: 'rgba(212,184,90,0.18)', border: '1px solid #D4B85A', color: '#D4B85A' }
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 4 }
