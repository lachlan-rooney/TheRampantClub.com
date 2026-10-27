'use client'

import { useState, useEffect, useRef } from 'react'

// Tablet enrolment entry (public). An admin issues a pairing code in the portal;
// typed here, the tablet exchanges it for a device token (the security boundary)
// and becomes a trusted kiosk. No PII here — just the handshake.

export default function KioskPair() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [auto, setAuto] = useState(false)
  const fired = useRef(false)

  // ── PAIR FROM THE URL: /kiosk/pair?code=1234 ─────────────────────────────
  // Typing a code on a tablet is the part that goes wrong. The keyboard may
  // not appear, autofocus may not take, the soft keyboard can bury the button,
  // and the button stays DISABLED until the field has content — so a member of
  // staff with the right code can be left with nothing to press and no idea
  // why. A link removes all of it: open it and the tablet is paired.
  //
  // It is no weaker than typing the same code into the same box. The code is
  // one-use, expires, and is useless without it.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code')
    if (!fromUrl || fired.current) return
    fired.current = true
    setAuto(true)
    setCode(fromUrl.toUpperCase())
    void pairWith(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pair = () => pairWith(code)

  const pairWith = async (raw: string) => {
    if (!raw.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: raw }) })
      if (r.ok) {
        // Land on this tablet's own floor. Falls back to the board when the device
        // has no room set yet — never onto the staff sign-in.
        const j = await r.json().catch(() => ({}))
        window.location.href = j.next || '/kiosk/board'
        return
      }
      else {
        setErr((await r.json().catch(() => ({})))?.error || 'Could not pair.')
        setAuto(false)   // fall back to the manual form so staff can retry
      }
    } finally { setBusy(false) }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={diamond} />
        <div style={title}>The Rampant Club</div>
        <div style={sub}>Kiosk enrolment</div>
        <p style={hint}>{auto && busy
          ? 'Pairing this tablet…'
          : 'Enter the pairing code from the admin portal to make this tablet a trusted kiosk.'}</p>
        {/* A REAL FORM. The Enter handler alone was not enough on an iPad: iOS
            shows a plain "return" key outside a form and the submit never
            fired, so staff had a code typed in and no visible way in once the
            keyboard covered the button. A form plus enterKeyHint puts a GO key
            on the keyboard that submits. */}
        <form onSubmit={e => { e.preventDefault(); pair() }}>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pair() } }}
            placeholder="CODE" maxLength={8} autoFocus
            enterKeyHint="go" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            style={input} />
          {err && <div style={errStyle}>{err}</div>}
          <button type="submit" disabled={busy || !code.trim()} style={{ ...btn, opacity: busy || !code.trim() ? 0.4 : 1 }}>{busy ? 'Pairing…' : 'Pair this tablet'}</button>
        </form>
      </div>
    </div>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
// 100vh does NOT shrink when the iOS keyboard opens, so a vertically centred
// card keeps its position in the full height and the button ends up under the
// keyboard. 100dvh follows the visible viewport, and starting at the top with
// generous bottom padding means the button stays reachable even when dvh is
// unsupported.
const wrap: React.CSSProperties = { minHeight: '100dvh', background: '#052E20', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 24px 50vh' }
const card: React.CSSProperties = { width: 'min(420px, 92vw)', textAlign: 'center', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 16, background: 'rgba(229,212,194,0.03)', padding: '40px 32px' }
const diamond: React.CSSProperties = { width: 10, height: 10, background: '#D4B85A', transform: 'rotate(45deg)', opacity: 0.6, margin: '0 auto 24px' }
const title: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 24, color: '#E5D4C2', letterSpacing: '0.04em' }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }
const hint: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, margin: '20px 0 18px' }
const input: React.CSSProperties = { width: '100%', textAlign: 'center', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 10, color: '#E5D4C2', fontFamily: MONO, fontSize: 28, letterSpacing: '0.3em', padding: '14px 12px', outline: 'none', boxSizing: 'border-box' }
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 12 }
const btn: React.CSSProperties = { marginTop: 18, width: '100%', background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 10, padding: '14px', fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
