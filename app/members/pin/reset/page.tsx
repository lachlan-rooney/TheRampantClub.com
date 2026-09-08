'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// Set a new kiosk code from a reset link. The code is chosen HERE, in the portal —
// never on a bar-top tablet, and never by anyone but the member.
// useSearchParams needs a Suspense boundary or the page cannot be prerendered.
export default function ResetKioskPinPage() {
  return <Suspense fallback={<div style={{ maxWidth: 460 }} />}><ResetKioskPin /></Suspense>
}

function ResetKioskPin() {
  const token = useSearchParams().get('token') || ''
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setMsg(null)
    if (!/^[0-9]{6}$/.test(pin)) return setMsg({ ok: false, text: 'Six digits, please.' })
    if (pin !== again) return setMsg({ ok: false, text: 'The two entries don’t match.' })
    setBusy(true)
    const r = await fetch('/api/members/kiosk-pin/reset-complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, pin }),
    })
    setBusy(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setMsg({ ok: false, text: j.error || 'Could not set your code.' })
    setPin(''); setAgain('')
    setMsg({ ok: true, text: 'Your code is set, and the lockout is cleared. You can use it at the kiosk now.' })
  }

  if (!token) return (
    <div style={{ maxWidth: 460 }}>
      <h1 style={h1}>Set your kiosk code</h1>
      <p style={{ fontSize: 14, opacity: .75 }}>This page needs the link from your email. Ask for a new one at the kiosk.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 460 }}>
      <h1 style={h1}>Set your kiosk code</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, opacity: .75, marginBottom: 24 }}>
        Six digits, used only on the tablets in the club. Nobody at the club can see or set it.
      </p>
      <label style={lbl}>New code</label>
      <input value={pin} inputMode="numeric" onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />
      <label style={{ ...lbl, marginTop: 16 }}>Enter it again</label>
      <input value={again} inputMode="numeric" onChange={e => setAgain(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />
      <button onClick={save} disabled={busy} style={btn}>{busy ? 'Saving…' : 'Set code'}</button>
      {msg && <div style={{ marginTop: 16, fontSize: 13, color: msg.ok ? '#2E7D52' : '#B4463F' }}>{msg.text}</div>}
      <p style={{ fontSize: 12, opacity: .5, marginTop: 22, lineHeight: 1.7 }}>
        Steer clear of anything close to you — a birthday, a house number, a year, an anniversary.
      </p>
    </div>
  )
}

const h1: React.CSSProperties = { fontFamily: "'Rampant Sans', Georgia, serif", fontSize: 28, marginBottom: 6 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6, marginBottom: 6 }
const field: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 22, letterSpacing: '.4em', border: '1px solid rgba(0,0,0,.18)', borderRadius: 4, outline: 'none' }
const btn: React.CSSProperties = { marginTop: 22, padding: '12px 26px', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', background: '#052E20', color: '#E5D4C2', border: 'none', borderRadius: 4, cursor: 'pointer' }
