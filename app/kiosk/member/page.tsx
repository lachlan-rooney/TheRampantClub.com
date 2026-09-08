'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// MEMBER MODE — the PIN screen, then the member's own view.
//
// The greeting is a FIRST NAME and nothing else. This screen sits open on a bar
// top while six digits are thumbed in, in a room with other people; a full name
// parked there for twenty seconds is the wrong trade for a club that sells
// discretion, and a weaker confirmation of the card→name binding is the point.
// No balance, no visit history, no tier. The API doesn't send them either.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GROUND = '#052E20'

const ABANDON_MS = 15_000   // tap-and-walk-away must not leave a name on the bar
const IDLE_MS = 85_000      // just inside the server's 90s, so the exit is graceful

interface Me { first_name: string | null; palate: string[]; room: string | null; expires_at: string }

const pretty = (slug: string) => slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function KioskMember() {
  const router = useRouter()
  const [tap, setTap] = useState<{ member_no: string; first_name: string | null } | null>(null)
  const [num, setNum] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const abandon = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTouch = useRef(Date.now())

  const toBoard = useCallback(async (reason = 'done') => {
    try { await fetch('/api/kiosk/member/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }) } catch {}
    router.replace('/kiosk/board')
  }, [router])

  // Sign-in now happens ON THE BOARD, so the usual arrival here is with a session
  // already minted. Ask first; only fall back to the PIN screen if there isn't one
  // (someone deep-linking here, or a session that expired on the way).
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
        if (r.ok) setMe((await r.json()).member)
      } catch {}
      setChecked(true)
    })()
    try {
      const raw = sessionStorage.getItem('trc_kiosk_tap')
      if (raw) { const j = JSON.parse(raw); setTap({ member_no: j.member_no, first_name: j.first_name }); setNum(j.member_no || '') }
      sessionStorage.removeItem('trc_kiosk_tap')
    } catch {}
  }, [])

  // ── ABANDON: the PIN screen clears itself. Every keypress resets it, so a real
  //    member thumbing six digits is never cut off; a walk-away clears in 15s.
  const bumpAbandon = useCallback(() => {
    if (me) return
    if (abandon.current) clearTimeout(abandon.current)
    abandon.current = setTimeout(() => router.replace('/kiosk/board'), ABANDON_MS)
  }, [me, router])
  useEffect(() => { bumpAbandon(); return () => { if (abandon.current) clearTimeout(abandon.current) } }, [bumpAbandon, pin, num])

  // ── IDLE, once signed in. Reset on REAL INTERACTION — scroll and touch, not just
  //    navigation. Phase 3 has a scrollable newsletter and comfortable reading
  //    exceeds 90 seconds of no navigation; being logged out mid-read reads as broken.
  useEffect(() => {
    if (!me) return
    const mark = () => { lastTouch.current = Date.now() }
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'touchmove', 'scroll', 'wheel', 'keydown']
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }))
    const beat = setInterval(async () => {
      if (Date.now() - lastTouch.current > IDLE_MS) { toBoard('idle'); return }
      if (Date.now() > +new Date(me.expires_at)) { toBoard('ttl'); return }
      // Touching /me bumps the server-side idle clock — the member is still here.
      const r = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
      if (!r.ok) toBoard('idle')
    }, 30_000)
    return () => { evs.forEach(e => window.removeEventListener(e, mark)); clearInterval(beat) }
  }, [me, toBoard])

  const submit = async () => {
    if (pin.length !== 6 || busy) return
    setBusy(true); setErr(false)
    const r = await fetch('/api/kiosk/member/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_no: num.trim(), pin }),
    })
    setBusy(false)
    if (!r.ok) { setErr(true); setPin(''); return }
    const m = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
    if (!m.ok) { setErr(true); setPin(''); return }
    setMe((await m.json()).member)
  }

  // ── THE MEMBER'S OWN VIEW ───────────────────────────────────────────────
  if (me) return (
    <div style={wrap}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)' }}>
          {me.room} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' })}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 'clamp(34px,5.4vw,62px)', marginTop: 12 }}>
          Good evening, {me.first_name}
        </div>
        {me.palate.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#D4B85A' }}>Your palate</div>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(20px,2.6vw,30px)', color: 'rgba(229,212,194,.9)', marginTop: 10 }}>
              {me.palate.map(pretty).join(' · ')}
            </div>
          </div>
        )}
      </div>
      <button onClick={() => toBoard('done')} style={{ ...ghost, alignSelf: 'flex-start' }}>Done</button>
    </div>
  )

  // Don't flash a PIN screen while the session check is still in flight.
  if (!checked) return <div style={wrap} />

  // ── THE PIN SCREEN (fallback — normal entry is from the board) ───────────
  return (
    <div style={wrap} onPointerDown={bumpAbandon}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 460 }}>
        {tap?.first_name
          ? <div style={{ fontFamily: SERIF, fontSize: 'clamp(28px,4.2vw,46px)' }}>Good evening, {tap.first_name}</div>
          : <div style={{ fontFamily: SERIF, fontSize: 'clamp(24px,3.4vw,38px)' }}>Your surname</div>}

        {!tap && (
          <input
            value={num} onChange={e => { setNum(e.target.value); bumpAbandon() }}
            placeholder="Your surname" autoCapitalize="words" autoComplete="off" spellCheck={false}
            style={{ ...field, marginTop: 18 }}
          />
        )}

        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)', marginTop: 26 }}>
          Enter your six-digit PIN
        </div>
        <input
          value={pin} inputMode="numeric" autoFocus={!!tap}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setErr(false); bumpAbandon() }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          style={{ ...field, marginTop: 12, fontSize: 34, letterSpacing: '.5em' }}
        />

        <button onClick={submit} disabled={pin.length !== 6 || !num.trim() || busy}
          style={{ ...ghost, marginTop: 20, opacity: pin.length === 6 && num.trim() && !busy ? 1 : .35 }}>
          {busy ? 'One moment' : 'Continue'}
        </button>

        {/* ONE generic failure. It never says which membership numbers exist, and the
            set-a-PIN line is shown on EVERY failure so it carries no signal. */}
        {err && (
          <div style={{ fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 16, lineHeight: 1.7 }}>
            That didn’t match. Please try again.<br />
            <span style={{ color: 'rgba(229,212,194,.45)' }}>Not set a PIN yet? You can set one in your member portal.</span>
          </div>
        )}
      </div>
      <button onClick={() => router.replace('/kiosk/board')} style={{ ...ghost, alignSelf: 'flex-start', opacity: .5 }}>Cancel</button>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100vh', background: GROUND, color: INK,
  display: 'flex', flexDirection: 'column', padding: '5vh 6vw',
}
const field: React.CSSProperties = {
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.2)', borderRadius: 4,
  color: INK, fontFamily: MONO, fontSize: 22, padding: '14px 16px', width: '100%', outline: 'none',
}
const ghost: React.CSSProperties = {
  background: 'none', border: '1px solid rgba(229,212,194,.35)', borderRadius: 4, color: INK,
  fontFamily: MONO, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
  padding: '12px 24px', cursor: 'pointer',
}
