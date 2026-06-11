'use client'

import { useCallback, useEffect, useState } from 'react'

// Admin kiosk management: enrol/revoke tablets (the device boundary) and set staff
// PINs (the picker attribution). Two clearly-separated layers.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Device { id: string; label: string; status: string; enrolled_at: string | null; last_seen_at: string | null; pair_code: string | null }
interface Staff { id: string; display_name: string; role_title: string | null; active: boolean; has_pin: boolean }

export default function AdminKiosk() {
  const [devices, setDevices] = useState<Device[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [label, setLabel] = useState('')
  const [pinFor, setPinFor] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([fetch('/api/admin/kiosk-devices'), fetch('/api/admin/kiosk-devices/pin')])
    if (d.ok) setDevices((await d.json()).devices || [])
    if (s.ok) setStaff((await s.json()).staff || [])
  }, [])
  useEffect(() => { load() }, [load])

  const addDevice = async () => {
    if (!label.trim()) return
    const r = await fetch('/api/admin/kiosk-devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) })
    if (r.ok) { const j = await r.json(); setMsg(`Pairing code for “${label}”: ${j.pair_code} (valid ${j.expires_in_min} min — enter it on the tablet at /kiosk/pair)`); setLabel(''); load() }
  }
  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this device? The tablet loses access immediately.')) return
    await fetch(`/api/admin/kiosk-devices/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke' }) })
    load()
  }
  const savePin = async () => {
    if (!pinFor || !/^[0-9]{4,8}$/.test(pin)) return
    const r = await fetch('/api/admin/kiosk-devices/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: pinFor.id, pin }) })
    if (r.ok) { setMsg(`PIN set for ${pinFor.display_name}.`); setPinFor(null); setPin(''); load() }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>Kiosk</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 24 }}>Enrol tablets (the device session is the security boundary) · set staff PINs (attribution)</p>
      {msg && <div style={banner}>{msg}</div>}

      <div style={sectionLabel}>Enrolled devices</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Device name (e.g. Floor 4 bar)" style={input} />
        <button onClick={addDevice} disabled={!label.trim()} style={{ ...btn, opacity: label.trim() ? 1 : 0.4 }}>Add device</button>
      </div>
      {devices.map(d => (
        <div key={d.id} style={row}>
          <div>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{d.label}</span>
            <span style={{ ...pill, ...(d.status === 'enrolled' ? pillOk : d.status === 'revoked' ? pillBad : pillPend) }}>{d.status}</span>
            {d.pair_code && <span style={{ fontFamily: MONO, fontSize: 13, color: '#D4B85A', marginLeft: 10 }}>code: {d.pair_code}</span>}
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', marginTop: 3 }}>{d.last_seen_at ? `last seen ${new Date(d.last_seen_at).toLocaleString('en-GB')}` : 'never connected'}</div>
          </div>
          {d.status !== 'revoked' && <button onClick={() => revoke(d.id)} style={revokeBtn}>Revoke</button>}
        </div>
      ))}
      {devices.length === 0 && <div style={muted}>No devices enrolled.</div>}

      <div style={{ ...sectionLabel, marginTop: 32 }}>Staff PINs</div>
      {staff.map(s => (
        <div key={s.id} style={row}>
          <div>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{s.display_name}</span>
            {s.role_title && <span style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', marginLeft: 8 }}>{s.role_title}</span>}
            <span style={{ ...pill, ...(s.has_pin ? pillOk : pillPend) }}>{s.has_pin ? 'PIN set' : 'no PIN'}</span>
          </div>
          <button onClick={() => { setPinFor(s); setPin('') }} style={smallBtn}>{s.has_pin ? 'Reset PIN' : 'Set PIN'}</button>
        </div>
      ))}

      {pinFor && (
        <div style={modalBack} onClick={() => setPinFor(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginBottom: 12 }}>PIN for {pinFor.display_name}</div>
            <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4–8 digits" style={{ ...input, width: '100%' }} autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setPinFor(null)} style={smallBtn}>Cancel</button>
              <button onClick={savePin} disabled={!/^[0-9]{4,8}$/.test(pin)} style={{ ...btn, opacity: /^[0-9]{4,8}$/.test(pin) ? 1 : 0.4 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4B85A', opacity: 0.8, marginBottom: 12 }
const banner: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.4)', borderRadius: 10, background: 'rgba(212,184,90,0.1)', padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: '#E5D4C2', marginBottom: 20, lineHeight: 1.6 }
const input: React.CSSProperties = { flex: 1, background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const smallBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontSize: 11, color: '#B2AA98', cursor: 'pointer' }
const revokeBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(194,112,112,0.4)', borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontSize: 11, color: '#C27070', cursor: 'pointer' }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, padding: '2px 8px', borderRadius: 8, marginLeft: 10, letterSpacing: '0.04em' }
const pillOk: React.CSSProperties = { color: '#7AB07A', border: '1px solid rgba(122,176,122,0.4)' }
const pillPend: React.CSSProperties = { color: '#D4B85A', border: '1px solid rgba(212,184,90,0.4)' }
const pillBad: React.CSSProperties = { color: '#C27070', border: '1px solid rgba(194,112,112,0.4)' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
const modalBack: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(5,46,32,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modal: React.CSSProperties = { width: 'min(360px, 92vw)', background: '#0A3526', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 14, padding: 22 }
