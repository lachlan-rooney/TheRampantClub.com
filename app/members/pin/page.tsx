'use client'

import { useCallback, useEffect, useState } from 'react'

// Set your kiosk PIN. Six digits, and nobody at the club ever learns them: this
// page is the only place a PIN is ever set, and it runs as you.

export default function MemberPin() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [setAt, setSetAt] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/members/kiosk-pin', { cache: 'no-store' })
    if (r.ok) { const j = await r.json(); setHasPin(j.has_pin); setSetAt(j.set_at) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setMsg(null)
    if (!/^[0-9]{6}$/.test(pin)) return setMsg({ ok: false, text: 'Six digits, please.' })
    if (pin !== again) return setMsg({ ok: false, text: 'The two entries don’t match.' })
    setBusy(true)
    const r = await fetch('/api/members/kiosk-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
    })
    setBusy(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setMsg({ ok: false, text: j.error || 'Could not set your PIN.' })
    setPin(''); setAgain(''); setMsg({ ok: true, text: 'Your PIN is set.' }); load()
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <h1 style={{ fontFamily: "'Rampant Sans', Georgia, serif", fontSize: 28, marginBottom: 6 }}>Your kiosk PIN</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, opacity: .75, marginBottom: 24 }}>
        Six digits, used only on the tablets in the club. Tap your card, enter these six digits,
        and the tablet becomes yours for a few minutes. Nobody at the club can see or set it —
        if you forget it, we can clear it and you set a new one here.
      </p>

      {hasPin !== null && (
        <div style={{ fontSize: 13, opacity: .6, marginBottom: 20 }}>
          {hasPin
            ? `A PIN is set${setAt ? ` — last changed ${new Date(setAt).toLocaleDateString('en-GB')}` : ''}.`
            : 'No PIN set yet.'}
        </div>
      )}

      <label style={lbl}>{hasPin ? 'New PIN' : 'Choose a PIN'}</label>
      <input value={pin} inputMode="numeric" onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />
      <label style={{ ...lbl, marginTop: 16 }}>Enter it again</label>
      <input value={again} inputMode="numeric" onChange={e => setAgain(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />

      <button onClick={save} disabled={busy} style={btn}>{busy ? 'Saving…' : hasPin ? 'Change PIN' : 'Set PIN'}</button>

      {msg && <div style={{ marginTop: 16, fontSize: 13, color: msg.ok ? '#2E7D52' : '#B4463F' }}>{msg.text}</div>}

      {/* Plain in advance. The dry line is saved for the refusal, where the club
          has just proved the point rather than predicted it. */}
      <p style={{ fontSize: 12, opacity: .55, marginTop: 26, lineHeight: 1.8 }}>
        Steer clear of anything close to you — a birthday, a house number, a year, an anniversary.
        Runs and repeats are refused: 123456, 111111, 121212 and the like.
      </p>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6, marginBottom: 6 }
const field: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 22, letterSpacing: '.4em', border: '1px solid rgba(0,0,0,.18)', borderRadius: 4, outline: 'none' }
const btn: React.CSSProperties = { marginTop: 22, padding: '12px 26px', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', background: '#052E20', color: '#E5D4C2', border: 'none', borderRadius: 4, cursor: 'pointer' }
