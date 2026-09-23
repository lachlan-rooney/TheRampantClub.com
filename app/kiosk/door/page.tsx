'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SignaturePad, { type SignaturePadHandle } from '@/components/SignaturePad'
import ArrivalsRow from '@/components/admin/ArrivalsRow'
import OpenOrders from '@/components/menus/OpenOrders'

// ═══════════════════════════════════════════════════════════════════════════
// THE DOOR.  Guest sign-in on the entrance iPad.  (Decided 2026-09-14.)
// ───────────────────────────────────────────────────────────────────────────
// Every guest types their name and draws a signature. If their name was given in
// advance and it is before 22:30, they are welcomed and walk in. Otherwise the
// signature is still taken and they are asked to wait: the duty manager picks
// their name, enters their PIN on this same iPad, sees who the guest is and why
// they were referred, and admits or refuses.
//
// WHAT THIS SCREEN MUST NEVER DO: show a list of tonight's guests or hosts. It is
// never sent one. The server answers a sign-in with "welcome" or "please wait"
// and nothing else; the host's name reaches this page only after a staff PIN, and
// is dropped the moment the decision is made or the screen goes idle.
//
// Client-rendered, like every member-adjacent kiosk surface (app/kiosk/layout.tsx).
// Device-gated in middleware to purpose = 'door'. Built for iPad Safari: pointer
// events on the signature pad, 16px+ inputs so Safari does not zoom, and a layout
// that reads in portrait and landscape alike.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GROUND = '#052E20'
const GOLD = '#D4B85A'
const RED = '#C27070'

const IDLE_MS = 60_000          // a half-typed name does not sit on the door
const WAIT_MS = 10 * 60_000     // but a guest waiting for the manager is not hurried off
const DONE_MS = 8_000
const MIN_INK = 40              // px of stroke — a tap is not a signature

type Step = 'welcome' | 'name' | 'sign' | 'done' | 'waiting' | 'staff' | 'pin' | 'decide' | 'decided' | 'arrivals'
interface Staff { id: string; display_name: string; role_title?: string | null }
interface Review { staff_name: string; guest_name: string; reason: string; on_list: boolean | null; host: string | null; signed_in_at: string }

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })

export default function KioskDoor() {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [ink, setInk] = useState(0)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [visitId, setVisitId] = useState<string | null>(null)
  const [roster, setRoster] = useState<Staff[]>([])
  const [picking, setPicking] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<{ decision: 'admitted' | 'refused'; first_name: string | null } | null>(null)
  const pad = useRef<SignaturePadHandle>(null)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Everything about a guest goes at once — name, signature, visit, PIN, host.
  const reset = useCallback(() => {
    setStep('welcome'); setName(''); setInk(0); setErr(''); setBusy(false); setFirstName('')
    setVisitId(null); setPicking(null); setPin(''); setReview(null); setReason(''); setOutcome(null)
  }, [])

  // Staff stepping away mid-decision drops back to "please wait", not to the
  // welcome: the guest is still standing there. The PIN and the host go.
  const backToWaiting = useCallback(() => {
    setStep('waiting'); setPicking(null); setPin(''); setReview(null); setReason(''); setErr(''); setBusy(false)
  }, [])

  useEffect(() => {
    const arm = () => {
      if (idle.current) clearTimeout(idle.current)
      if (step === 'welcome') return
      const ms = step === 'done' || step === 'decided' ? DONE_MS : step === 'waiting' ? WAIT_MS : IDLE_MS
      idle.current = setTimeout(() => {
        if (step === 'staff' || step === 'pin' || step === 'decide') backToWaiting()
        else reset()
      }, ms)
    }
    arm()
    // A finished screen times out on its own clock; touching it does not hold it open.
    const evs: (keyof WindowEventMap)[] = step === 'done' || step === 'decided' ? [] : ['pointerdown', 'keydown', 'input']
    evs.forEach(e => window.addEventListener(e, arm, { passive: true }))
    return () => { if (idle.current) clearTimeout(idle.current); evs.forEach(e => window.removeEventListener(e, arm)) }
  }, [step, reset, backToWaiting])

  useEffect(() => {
    if (step !== 'staff') return
    fetch('/api/kiosk/staff/roster', { cache: 'no-store' }).then(r => r.ok ? r.json() : { staff: [] })
      .then(j => setRoster(j.staff || [])).catch(() => setRoster([]))
  }, [step])

  const toSign = () => {
    if (name.replace(/\s+/g, ' ').trim().length < 2) { setErr('name'); return }
    setErr(''); setInk(0); setStep('sign')
  }

  const submit = async () => {
    if (busy) return
    if ((pad.current?.inkLength() || 0) < MIN_INK) { setErr('sign'); return }
    const signature = pad.current?.toDataURL(600) || ''
    if (!signature) { setErr('sign'); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/door/sign-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.replace(/\s+/g, ' ').trim(), signature }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.status === 'welcome') { setName(''); setFirstName(j.first_name || ''); setStep('done'); return }
      if (r.ok && j.status === 'awaiting') { setName(''); setVisitId(j.visit_id); setStep('waiting'); return }
      setErr(r.status === 429 ? 'busy' : r.status === 403 ? 'device' : j.error === 'signature' ? 'sign' : 'failed')
    } catch { setErr('failed') } finally { setBusy(false) }
  }

  const checkPin = async (code: string) => {
    if (!picking || !visitId || code.length < 4 || busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/door/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_id: visitId, team_member_id: picking.id, pin: code }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setReview(j); setStep('decide'); return }
      if (r.status === 409) { setErr('gone'); return }
      setErr('pin'); setPin('')
    } catch { setErr('failed') } finally { setBusy(false) }
  }

  const decide = async (decision: 'admitted' | 'refused') => {
    if (!picking || !visitId || busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/door/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_id: visitId, team_member_id: picking.id, pin, decision, reason }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        // The host and the PIN leave the page before the result is shown.
        setReview(null); setPin(''); setPicking(null); setReason(''); setVisitId(null)
        setOutcome({ decision, first_name: j.first_name || null }); setStep('decided'); return
      }
      setErr(r.status === 409 ? 'gone' : r.status === 401 ? 'pin' : 'failed')
    } catch { setErr('failed') } finally { setBusy(false) }
  }

  // ── screens ──────────────────────────────────────────────────────────────
  let body: React.ReactNode

  if (step === 'welcome') body = (
    <div style={{ textAlign: 'center' }} onClick={() => setStep('name')}>
      <div style={diamond} />
      <div style={kicker}>The Rampant Club</div>
      <h1 style={{ ...display, marginTop: 18 }}>Welcome</h1>
      <div style={vn}>Chào mừng quý khách</div>
      <p style={{ ...lede, marginTop: 28 }}>Guests, please sign in.<br /><span style={{ opacity: 0.75 }}>Khách mời, vui lòng đăng ký vào cửa.</span></p>
      <button style={{ ...primary, marginTop: 34 }} onClick={e => { e.stopPropagation(); setStep('name') }}>Begin · Bắt đầu</button>
      <div style={{ ...fine, marginTop: 30 }}>Members need not sign in here · Hội viên không cần đăng ký tại đây</div>
      {/* THE STAFF WAY IN. Tonight's list carries member names, so it lives one
          tap behind the greeting rather than on a screen a guest is reading over
          (2026-09-17). The idle timer returns this tablet to Welcome by itself. */}
      <button style={{ ...fine, marginTop: 26, background: 'none', border: 'none', cursor: 'pointer', opacity: .45, textDecoration: 'underline' }}
              onClick={e => { e.stopPropagation(); setStep('arrivals') }}>
        Staff · who’s in tonight
      </button>
    </div>
  )

  else if (step === 'name') body = (
    <div>
      <div style={kicker}>Step 1 of 2 · Bước 1/2</div>
      <h2 style={heading}>Your full name</h2>
      <div style={vn}>Họ và tên đầy đủ của quý khách</div>
      <input
        autoFocus value={name} maxLength={120}
        onChange={e => { setName(e.target.value); if (err) setErr('') }}
        onKeyDown={e => { if (e.key === 'Enter') toSign() }}
        name="door-guest-name" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false} enterKeyHint="next"
        style={nameInput} aria-label="Your full name"
      />
      <div style={{ ...fine, marginTop: 10 }}>As your host gave it to the Club · Như hội viên mời quý khách đã báo với Câu lạc bộ</div>
      {err === 'name' && <div style={errText}>Please type your name · Vui lòng nhập tên</div>}
      <div style={row}>
        <button style={ghost} onClick={reset}>← Back · Quay lại</button>
        <button style={{ ...primary, opacity: name.trim().length >= 2 ? 1 : 0.45 }} onClick={toSign}>Continue · Tiếp tục</button>
      </div>
    </div>
  )

  else if (step === 'sign') body = (
    <div>
      <div style={kicker}>Step 2 of 2 · Bước 2/2</div>
      <h2 style={heading}>Please sign below</h2>
      <div style={vn}>Vui lòng ký vào ô bên dưới</div>
      <div style={{ position: 'relative', marginTop: 22, background: INK, borderRadius: 14, overflow: 'hidden' }}>
        {/* The signing line sits BEHIND the canvas, so it is never part of the image. */}
        <div style={{ position: 'absolute', left: '7%', right: '7%', bottom: '24%', borderBottom: '1px solid rgba(5,46,32,0.35)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '7%', bottom: 'calc(24% + 6px)', fontFamily: SERIF, fontSize: 26, color: 'rgba(5,46,32,0.35)', pointerEvents: 'none' }}>×</div>
        <SignaturePad ref={pad} ink={GROUND} height="min(40vh, 340px)" onInk={n => { setInk(n); if (err === 'sign') setErr('') }} ariaLabel="Signature pad" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={fine}>Your signature is kept for seven days, then deleted · Chữ ký được lưu bảy ngày, sau đó sẽ bị xoá</div>
        <button style={{ ...ghost, padding: '10px 18px', minHeight: 0 }} onClick={() => { pad.current?.clear(); setInk(0) }}>Clear · Xoá</button>
      </div>
      {err === 'sign' && <div style={errText}>Please sign in the box · Vui lòng ký vào ô</div>}
      {err === 'busy' && <div style={errText}>Please ask a member of staff · Vui lòng gặp nhân viên</div>}
      {err === 'device' && <div style={errText}>This iPad is not set up as the door · iPad này chưa được cài đặt cho cửa ra vào</div>}
      {err === 'failed' && <div style={errText}>Something went wrong — please ask a member of staff · Đã có lỗi — vui lòng gặp nhân viên</div>}
      <div style={row}>
        <button style={ghost} onClick={() => { setErr(''); setStep('name') }}>← Back · Quay lại</button>
        <button style={{ ...primary, opacity: busy || ink < MIN_INK ? 0.45 : 1 }} onClick={submit} disabled={busy}>
          {busy ? '…' : 'Sign in · Xác nhận'}
        </button>
      </div>
    </div>
  )

  else if (step === 'done') body = (
    <div style={{ textAlign: 'center' }}>
      <div style={diamond} />
      <h1 style={display}>Welcome{firstName ? `, ${firstName}` : ''}.</h1>
      <div style={vn}>Chào mừng quý khách{firstName ? `, ${firstName}` : ''}.</div>
      <p style={{ ...lede, marginTop: 24 }}>Please come in.<br /><span style={{ opacity: 0.75 }}>Mời quý khách vào.</span></p>
      {/* It clears itself, but the NEXT guest should not have to wait for a timer
          they cannot see. (2026-09-16 — every screen gets a way onward.) */}
      <button style={{ ...ghost, marginTop: 40 }} onClick={reset}>Next guest · Khách tiếp theo</button>
    </div>
  )

  else if (step === 'waiting') body = (
    <div style={{ textAlign: 'center' }}>
      <div style={diamond} />
      <h1 style={{ ...display, fontSize: 'clamp(34px, 5.4vw, 54px)' }}>Thank you.</h1>
      <div style={vn}>Cảm ơn quý khách.</div>
      <p style={{ ...lede, marginTop: 24 }}>Please wait — the duty manager will be with you.<br />
        <span style={{ opacity: 0.75 }}>Vui lòng chờ — quản lý ca trực sẽ đến ngay.</span></p>
      <button style={{ ...ghost, marginTop: 60 }} onClick={() => { setErr(''); setStep('staff') }}>Duty manager · Quản lý ca trực</button>
      {/* The only step that led forward and never back. The guest's entry is already
          recorded and waiting for the duty manager; this just returns the screen. */}
      <button style={{ ...ghost, marginTop: 14, border: 'none' }} onClick={reset}>← Back · Quay lại</button>
    </div>
  )

  else if (step === 'staff') body = (
    <div style={{ textAlign: 'center' }}>
      <div style={kicker}>Duty manager · Quản lý ca trực</div>
      <h2 style={{ ...heading, marginBottom: 22 }}>Who are you?</h2>
      {roster.length === 0
        ? <div style={fine}>No staff PINs are set. An admin sets them in the portal.</div>
        : <div style={grid}>{roster.map(s => (
            <button key={s.id} style={nameBtn} onClick={() => { setPicking(s); setPin(''); setErr(''); setStep('pin') }}>
              <div style={{ fontFamily: SERIF, fontSize: 20, color: INK }}>{s.display_name}</div>
              {s.role_title && <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginTop: 4 }}>{s.role_title}</div>}
            </button>
          ))}</div>}
      <button style={{ ...ghost, marginTop: 28 }} onClick={backToWaiting}>← Back · Quay lại</button>
    </div>
  )

  else if (step === 'pin' && picking) body = (
    <div style={{ textAlign: 'center', width: 'min(400px, 100%)', margin: '0 auto' }}>
      <div style={kicker}>Duty manager · Quản lý ca trực</div>
      <h2 style={heading}>{picking.display_name}</h2>
      <div style={fine}>Enter your PIN</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '20px 0' }}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) =>
          <span key={i} style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${GOLD}`, background: i < pin.length ? GOLD : 'transparent' }} />)}
      </div>
      {err === 'pin' && <div style={errText}>Wrong PIN, or too many tries — wait a moment.</div>}
      {err === 'gone' && <div style={errText}>This sign-in is no longer waiting.</div>}
      {err === 'failed' && <div style={errText}>Something went wrong. Try again.</div>}
      <div style={keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d =>
          <button key={d} style={key} onClick={() => { setErr(''); setPin(p => (p + d).slice(0, 8)) }}>{d}</button>)}
        <button style={key} onClick={() => setPin(p => p.slice(0, -1))}>←</button>
        <button style={key} onClick={() => { setErr(''); setPin(p => (p + '0').slice(0, 8)) }}>0</button>
        <button style={{ ...key, background: 'rgba(212,184,90,0.18)', borderColor: GOLD, color: GOLD, opacity: pin.length < 4 || busy ? 0.4 : 1 }}
          disabled={pin.length < 4 || busy} onClick={() => checkPin(pin)}>→</button>
      </div>
      <button style={{ ...ghost, marginTop: 22 }} onClick={() => err === 'gone' ? reset() : setStep('staff')}>
        {err === 'gone' ? 'Done' : '← Not you?'}
      </button>
    </div>
  )

  else if (step === 'decide' && review) body = (
    <div>
      <div style={kicker}>Duty manager · {review.staff_name}</div>
      <h2 style={{ ...heading, marginTop: 14 }}>{review.guest_name}</h2>
      <div style={{ ...fine, marginTop: 6 }}>Signed in at {hhmm(review.signed_in_at)}</div>
      <div style={{ borderTop: '1px solid rgba(229,212,194,0.16)', borderBottom: '1px solid rgba(229,212,194,0.16)', padding: '16px 0', margin: '20px 0', display: 'grid', gap: 10 }}>
        <Fact label="Why you were called">
          {review.reason === 'after_last_entry'
            ? `After 10:30pm — House Rules: no guest signed in after last entry.${review.on_list ? ' Their name was given.' : ' Their name was not given.'}`
            : review.reason === 'already_signed_in' ? 'This name has already signed in tonight.'
            : 'Their name was not given in advance.'}
        </Fact>
        <Fact label="Guest of">{review.host || (review.on_list ? '—' : 'Not on any booking tonight')}</Fact>
      </div>
      <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Reason (optional)"
        autoComplete="off" autoCorrect="off" style={{ ...nameInput, fontSize: 18, padding: '14px 16px' }} />
      {err === 'gone' && <div style={errText}>Someone has already decided, or this sign-in expired.</div>}
      {err === 'pin' && <div style={errText}>Your PIN is no longer accepted — pick your name again.</div>}
      {err === 'failed' && <div style={errText}>Could not record the decision. Try again.</div>}
      <div style={row}>
        <button style={{ ...ghost, color: RED, borderColor: 'rgba(194,112,112,0.5)' }} disabled={busy} onClick={() => decide('refused')}>Refuse</button>
        <button style={{ ...primary, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => decide('admitted')}>Admit</button>
      </div>
      <button style={{ ...ghost, marginTop: 14, border: 'none' }} onClick={err === 'gone' ? reset : backToWaiting}>{err === 'gone' ? 'Done' : 'Cancel'}</button>
    </div>
  )

  else if (step === 'decided' && outcome) body = outcome.decision === 'admitted' ? (
    <div style={{ textAlign: 'center' }}>
      <div style={diamond} />
      <h1 style={display}>Welcome{outcome.first_name ? `, ${outcome.first_name}` : ''}.</h1>
      <div style={vn}>Chào mừng quý khách{outcome.first_name ? `, ${outcome.first_name}` : ''}.</div>
      <button style={{ ...ghost, marginTop: 40 }} onClick={reset}>Next guest · Khách tiếp theo</button>
    </div>
  ) : (
    <div style={{ textAlign: 'center' }}>
      <div style={diamond} />
      <h1 style={{ ...display, fontSize: 'clamp(34px, 5.4vw, 54px)' }}>Thank you.</h1>
      <div style={vn}>Cảm ơn quý khách.</div>
      <button style={{ ...ghost, marginTop: 40 }} onClick={reset}>Next guest · Khách tiếp theo</button>
    </div>
  )

  else if (step === 'arrivals') body = (
    <div>
      <div style={kicker}>Staff · Nhân viên</div>
      <h2 style={{ ...heading, marginBottom: 14 }}>Who’s in tonight</h2>
      <ArrivalsRow endpoint="/api/kiosk/door/arrivals" compact />

      {/* The rooms' orders, rolled up: the door is not where they are answered,
          but whoever stands here is often the one who can see the floor. Tap a
          room to read its dishes. */}
      <div style={{ marginTop: 26 }}>
        <OpenOrders source="kiosk" compact />
      </div>
      <button style={{ ...ghost, marginTop: 18 }} onClick={reset}>← Back · Quay lại</button>
    </div>
  )

  else body = null

  return (
    <div style={wrap}>
      <div style={{ width: 'min(760px, 100%)' }}>{body}</div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, opacity: 0.85 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: INK, marginTop: 4, lineHeight: 1.35 }}>{children}</div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100dvh', background: GROUND, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
  boxSizing: 'border-box', WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none',
} as React.CSSProperties
const diamond: React.CSSProperties = { width: 12, height: 12, background: GOLD, transform: 'rotate(45deg)', opacity: 0.65, margin: '0 auto 26px' }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase' }
const display: React.CSSProperties = { fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(44px, 7vw, 76px)', lineHeight: 1.02, color: INK, margin: 0 }
const heading: React.CSSProperties = { fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(32px, 4.6vw, 46px)', lineHeight: 1.08, color: INK, margin: '12px 0 0' }
const vn: React.CSSProperties = { fontFamily: MONO, fontSize: 'clamp(15px, 2vw, 18px)', color: INK, opacity: 0.72, marginTop: 8, letterSpacing: '0.02em' }
const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.7, color: INK, margin: 0 }
const fine: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', lineHeight: 1.6 }
const errText: React.CSSProperties = { fontFamily: MONO, fontSize: 15, color: RED, marginTop: 14 }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 28, flexWrap: 'wrap' }
const primary: React.CSSProperties = {
  minHeight: 68, minWidth: 200, padding: '0 34px', background: GOLD, color: GROUND, border: 'none', borderRadius: 14,
  fontFamily: MONO, fontSize: 19, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer', touchAction: 'manipulation',
}
const ghost: React.CSSProperties = {
  minHeight: 68, padding: '0 26px', background: 'transparent', color: INK, border: '1px solid rgba(229,212,194,0.3)', borderRadius: 14,
  fontFamily: MONO, fontSize: 17, letterSpacing: '0.04em', cursor: 'pointer', touchAction: 'manipulation',
}
const nameInput: React.CSSProperties = {
  width: '100%', marginTop: 24, boxSizing: 'border-box', background: 'rgba(229,212,194,0.06)', color: INK,
  border: '1px solid rgba(212,184,90,0.4)', borderRadius: 14, padding: '20px 20px', outline: 'none',
  fontFamily: SERIF, fontSize: 'clamp(26px, 3.6vw, 34px)', userSelect: 'text', WebkitUserSelect: 'text',
} as React.CSSProperties
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }
const nameBtn: React.CSSProperties = { minHeight: 88, padding: '18px 14px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(212,184,90,0.25)', borderRadius: 14, cursor: 'pointer', touchAction: 'manipulation' }
const keypad: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }
const key: React.CSSProperties = { minHeight: 72, background: 'rgba(229,212,194,0.05)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 14, fontFamily: MONO, fontSize: 28, color: INK, cursor: 'pointer', touchAction: 'manipulation' }
