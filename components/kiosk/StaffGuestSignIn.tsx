'use client'

import { useRef, useState } from 'react'
import SignaturePad, { type SignaturePadHandle } from '@/components/SignaturePad'
import { useLang } from '@/lib/lang'

// SIGNING A GUEST IN FROM THE FLOOR.
//
// Owner, 2026-10-01: there is no spare tablet for the entrance yet, and the shop
// opens on 27 October. The door flow is built and proven; what is missing is a
// device. This is the same flow reached from a floor tablet, so guests can be
// signed in before a door device exists — and after one does, for the guest who
// walks past the entrance while nobody is standing at it.
//
// ── WHY THIS IS NOT THE DOOR PAGE, SHARED ─────────────────────────────────
// They call the SAME three routes (/sign-in, /review, /decide) and therefore
// share every rule that matters: the name matching, the 22:30 cut-off, the rate
// cap, what the response is allowed to say. What differs is the job. /kiosk/door
// is a full-screen flow for a stranger standing alone at an entrance: it resets
// itself, it loops to the next guest, it shows nothing a member of staff would
// need. This is a staff utility inside a screen that is already behind a PIN —
// a panel, not a kiosk. Making one component do both would mean a component
// that is half unmanned-entrance and half staff tool, and the door is not a
// place to be clever.
//
// ── THE PIN, EVERY TIME ───────────────────────────────────────────────────
// The staff member is already PIN'd into this screen, and is asked again here.
// The acting-staff cookie is unsigned (it is attribution on the room tablets),
// and a guest being vouched into the club is not something an unsigned cookie
// should decide. It is four taps, and it puts a named person on the record.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GOLD = '#D4B85A'
const RED = '#C27070'
const MIN_INK = 40   // px of stroke — a tap is not a signature

type Step = 'idle' | 'name' | 'sign' | 'pin' | 'welcome' | 'waiting' | 'review' | 'decided'
interface Review { guest_name: string; reason: string; on_list: boolean | null; host: string | null; signed_in_at: string }

export default function StaffGuestSignIn({ staffId, staffName }: { staffId: string; staffName: string }) {
  const { t } = useLang()
  const [step, setStep] = useState<Step>('idle')
  const [name, setName] = useState('')
  const [ink, setInk] = useState(0)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [visitId, setVisitId] = useState<string | null>(null)
  // THE SIGNATURE IS CAPTURED WHEN THEY LEAVE THE PAD, not read at submit.
  // The PIN step unmounts the pad, so by the time submit() runs pad.current is
  // null and the drawing is gone — which is how this first shipped, and exactly
  // what the walk-through caught: "Please sign." on a screen just signed.
  const [sig, setSig] = useState<string>('')
  const [review, setReview] = useState<Review | null>(null)
  const [outcome, setOutcome] = useState<string>('')
  const pad = useRef<SignaturePadHandle>(null)

  const reset = () => {
    setStep('idle'); setName(''); setInk(0); setPin(''); setErr('')
    setFirstName(''); setVisitId(null); setReview(null); setOutcome(''); setSig('')
  }

  // Name and signature travel together, exactly as at the door: checking the
  // name first would turn this into an oracle for who is on tonight's list.
  const submit = async () => {
    if (!sig) { setErr(t('Please sign.', 'Vui lòng ký.')); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/door/sign-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, signature: sig, team_member_id: staffId, pin }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(r.status === 401 ? t('Wrong PIN, or too many tries — wait a moment.', 'Sai mã PIN hoặc thử quá nhiều lần — vui lòng đợi.')
             : r.status === 429 ? t('Too many sign-ins just now — a moment.', 'Quá nhiều lượt vừa rồi — xin chờ một chút.')
             : t('That did not save.', 'Chưa lưu được.'))
        setPin('')
        return
      }
      if (j.status === 'welcome') { setFirstName(j.first_name || name); setStep('welcome') }
      else { setVisitId(j.visit_id); setStep('waiting') }
    } catch {
      setErr(t('Could not reach the club just now.', 'Không kết nối được lúc này.'))
    } finally { setBusy(false) }
  }

  // The referral, on the same screen. The host's name is never on this page
  // until the PIN has been checked server-side — same rule as the door.
  const openReview = async () => {
    setBusy(true); setErr('')
    const r = await fetch('/api/kiosk/door/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: visitId, team_member_id: staffId, pin }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error || t('Could not open that.', 'Không mở được.')); return }
    setReview(j); setStep('review')
  }

  const decide = async (decision: 'admitted' | 'refused') => {
    setBusy(true)
    const r = await fetch('/api/kiosk/door/decide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: visitId, decision, team_member_id: staffId, pin }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error || t('Could not save that.', 'Chưa lưu được.')); return }
    setOutcome(decision === 'admitted'
      ? t('Admitted.', 'Đã cho vào.')
      : t('Refused — recorded.', 'Đã từ chối — đã ghi nhận.'))
    setStep('decided')
  }

  if (step === 'idle') return (
    <button onClick={() => setStep('name')} style={openBtn}>
      {t('Sign a guest in', 'Ghi nhận khách')}
      <span style={openSub}>
        {t('name, signature and your PIN — the same record the door makes',
           'tên, chữ ký và mã PIN của bạn — cùng loại bản ghi như ở cửa')}
      </span>
    </button>
  )

  return (
    <div style={panel}>
      {step === 'name' && (
        <>
          <div style={head}>{t('The guest’s name', 'Tên của khách')}</div>
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim().length > 1) setStep('sign') }}
            placeholder={t('As they give it', 'Theo cách khách xưng')}
            style={input}
          />
          <Row>
            <button onClick={reset} style={ghost}>{t('Cancel', 'Hủy')}</button>
            <button onClick={() => setStep('sign')} disabled={name.trim().length < 2}
                    style={{ ...primary, opacity: name.trim().length < 2 ? .4 : 1 }}>
              {t('Next', 'Tiếp')}
            </button>
          </Row>
        </>
      )}

      {step === 'sign' && (
        <>
          <div style={head}>{t('Ask them to sign', 'Mời khách ký')}</div>
          {/* Cream pad, house-green ink — the same signature the door takes, so
              the two look alike in the attendance record rather than one dark
              and one light depending on where the guest happened to sign. */}
          <div style={{ border: '1px solid rgba(229,212,194,0.2)', borderRadius: 10, overflow: 'hidden', background: INK }}>
            <SignaturePad ref={pad} ink="#052E20" height={170}
                          onInk={n => { setInk(n); if (err) setErr('') }} ariaLabel="Signature pad" />
          </div>
          <div style={fine}>
            {t('Their signature is kept for seven days, then deleted.',
               'Chữ ký được lưu bảy ngày, sau đó sẽ bị xoá.')}
          </div>
          {err && <div style={errStyle}>{err}</div>}
          <Row>
            <button onClick={() => { pad.current?.clear(); setInk(0); setSig('') }} style={ghost}>{t('Clear', 'Xoá')}</button>
            <button
              onClick={() => {
                const drawn = pad.current?.toDataURL()
                if (!drawn) { setErr(t('Please sign.', 'Vui lòng ký.')); return }
                setSig(drawn); setErr(''); setStep('pin')
              }}
              disabled={ink < MIN_INK}
              style={{ ...primary, opacity: ink < MIN_INK ? .4 : 1 }}>
              {t('Next', 'Tiếp')}
            </button>
          </Row>
        </>
      )}

      {step === 'pin' && (
        <>
          <div style={head}>{t('Your PIN', 'Mã PIN của bạn')}</div>
          <div style={{ ...fine, marginTop: 0, marginBottom: 10 }}>
            {staffName} — {t('you are signing for this guest.', 'bạn đang ký nhận cho khách này.')}
          </div>
          <div style={dots}>
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) =>
              <span key={i} style={{ ...dot, background: i < pin.length ? GOLD : 'transparent' }} />)}
          </div>
          {err && <div style={errStyle}>{err}</div>}
          <div style={padGrid}>
            {['1','2','3','4','5','6','7','8','9'].map(d =>
              <button key={d} onClick={() => { setErr(''); setPin(p => (p + d).slice(0, 8)) }} style={key}>{d}</button>)}
            <button onClick={() => setPin(p => p.slice(0, -1))} style={key}>←</button>
            <button onClick={() => { setErr(''); setPin(p => (p + '0').slice(0, 8)) }} style={key}>0</button>
            <button onClick={submit} disabled={pin.length < 4 || busy}
                    style={{ ...key, ...keyGo, opacity: pin.length < 4 || busy ? .4 : 1 }}>→</button>
          </div>
          <Row><button onClick={reset} style={ghost}>{t('Cancel', 'Hủy')}</button></Row>
        </>
      )}

      {step === 'welcome' && (
        <>
          <div style={{ ...head, color: GOLD }}>{t('On the list', 'Có trong danh sách')}</div>
          <div style={big}>{t('Welcome,', 'Chào mừng,')} {firstName}.</div>
          <div style={fine}>{t('They can go in.', 'Khách có thể vào.')}</div>
          <Row><button onClick={reset} style={primary}>{t('Next guest', 'Khách tiếp theo')}</button></Row>
        </>
      )}

      {step === 'waiting' && (
        <>
          <div style={{ ...head, color: RED }}>{t('Needs a decision', 'Cần quyết định')}</div>
          <div style={fine}>
            {t('Their name was not on tonight’s list, or it is past 22:30. The signature is saved either way.',
               'Tên khách không có trong danh sách tối nay, hoặc đã quá 22:30. Chữ ký vẫn được lưu.')}
          </div>
          {err && <div style={errStyle}>{err}</div>}
          <Row>
            <button onClick={reset} style={ghost}>{t('Leave it for now', 'Để sau')}</button>
            <button onClick={openReview} disabled={busy} style={primary}>{t('Decide now', 'Quyết định ngay')}</button>
          </Row>
        </>
      )}

      {step === 'review' && review && (
        <>
          <div style={head}>{review.guest_name}</div>
          <div style={kv}><b>{t('Why', 'Lý do')}</b> {
            review.reason === 'not_on_list' ? t('Their name was not given in advance.', 'Tên khách không được báo trước.')
            : review.reason === 'after_last_entry' ? t('It is past 22:30.', 'Đã quá 22:30.')
            : t('They are already signed in tonight.', 'Khách đã ghi nhận tối nay rồi.')}</div>
          <div style={kv}><b>{t('Guest of', 'Khách của')}</b> {review.host || t('Not on any booking tonight', 'Không thuộc đặt chỗ nào tối nay')}</div>
          {err && <div style={errStyle}>{err}</div>}
          <Row>
            <button onClick={() => decide('refused')} disabled={busy} style={{ ...ghost, color: RED, borderColor: 'rgba(194,112,112,0.45)' }}>
              {t('Refuse', 'Từ chối')}
            </button>
            <button onClick={() => decide('admitted')} disabled={busy} style={primary}>{t('Admit', 'Cho vào')}</button>
          </Row>
        </>
      )}

      {step === 'decided' && (
        <>
          <div style={{ ...head, color: GOLD }}>{outcome}</div>
          <Row><button onClick={reset} style={primary}>{t('Next guest', 'Khách tiếp theo')}</button></Row>
        </>
      )}
    </div>
  )
}

const Row = ({ children }: { children: React.ReactNode }) =>
  <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>{children}</div>

const panel: React.CSSProperties = {
  border: '1px solid rgba(212,184,90,0.3)', borderRadius: 12, padding: '18px 18px 20px',
  background: 'rgba(212,184,90,0.04)', marginTop: 10,
}
const openBtn: React.CSSProperties = {
  width: '100%', textAlign: 'left', background: 'rgba(229,212,194,0.05)',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 12, padding: '16px 18px',
  color: INK, fontFamily: SERIF, fontSize: 19, cursor: 'pointer', marginTop: 10,
}
const openSub: React.CSSProperties = {
  display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em',
  color: '#B2AA98', marginTop: 6, lineHeight: 1.6,
}
const head: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase',
  color: '#B2AA98', marginBottom: 10,
}
const big: React.CSSProperties = { fontFamily: SERIF, fontSize: 26, color: INK, margin: '2px 0 6px' }
const kv: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: INK, lineHeight: 1.9 }
const fine: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', lineHeight: 1.8, marginTop: 10 }
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(229,212,194,0.06)',
  border: '1px solid rgba(229,212,194,0.2)', borderRadius: 8, color: INK,
  fontFamily: SERIF, fontSize: 20, padding: '12px 14px', outline: 'none',
}
const primary: React.CSSProperties = {
  background: GOLD, color: '#052E20', border: 'none', borderRadius: 8,
  padding: '12px 22px', fontFamily: MONO, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const ghost: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(178,170,152,0.35)', borderRadius: 8,
  padding: '12px 20px', fontFamily: MONO, fontSize: 13, color: '#B2AA98', cursor: 'pointer',
}
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: RED, marginTop: 10 }
const dots: React.CSSProperties = { display: 'flex', gap: 10, margin: '4px 0 12px' }
const dot: React.CSSProperties = { width: 12, height: 12, borderRadius: 6, border: `1px solid ${GOLD}` }
const padGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 300,
}
const key: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)',
  borderRadius: 10, color: INK, fontFamily: MONO, fontSize: 20, padding: '14px 0', cursor: 'pointer',
}
const keyGo: React.CSSProperties = { background: GOLD, color: '#052E20', borderColor: GOLD }
