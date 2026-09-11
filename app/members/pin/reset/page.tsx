'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/lang'

// Set a new kiosk code from a reset link. The code is chosen HERE, in the portal —
// never on a bar-top tablet, and never by anyone but the member.
// useSearchParams needs a Suspense boundary or the page cannot be prerendered.
export default function ResetKioskPinPage() {
  return <Suspense fallback={<div style={{ maxWidth: 460 }} />}><ResetKioskPin /></Suspense>
}

function ResetKioskPin() {
  const { t } = useLang()
  const token = useSearchParams().get('token') || ''
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setMsg(null)
    if (!/^[0-9]{6}$/.test(pin)) return setMsg({ ok: false, text: t('Six digits, please.', 'Vui lòng nhập sáu chữ số.') })
    if (pin !== again) return setMsg({ ok: false, text: t('The two entries don’t match.', 'Hai lần nhập không khớp.') })
    setBusy(true)
    const r = await fetch('/api/members/kiosk-pin/reset-complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, pin }),
    })
    setBusy(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setMsg({ ok: false, text: j.error || t('Could not set your code.', 'Chưa đặt được mã.') })
    setPin(''); setAgain('')
    setMsg({ ok: true, text: t('Your code is set, and the lockout is cleared. You can use it at the kiosk now.', 'Đã đặt mã và gỡ khoá tạm thời. Bạn có thể dùng mã tại kiosk ngay bây giờ.') })
  }

  if (!token) return (
    <div style={{ maxWidth: 460 }}>
      <h1 style={h1}>{t('Set your kiosk code', 'Đặt mã kiosk của bạn')}</h1>
      <p style={{ fontSize: 14, opacity: .75 }}>{t('This page needs the link from your email. Ask for a new one at the kiosk.', 'Trang này cần đường liên kết trong email của bạn. Hãy yêu cầu liên kết mới tại kiosk.')}</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 460 }}>
      <h1 style={h1}>{t('Set your kiosk code', 'Đặt mã kiosk của bạn')}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, opacity: .75, marginBottom: 24 }}>
        {t('Six digits, used only on the tablets in the club. Nobody at the club can see or set it.', 'Sáu chữ số, chỉ dùng trên các máy tính bảng tại câu lạc bộ. Không ai ở câu lạc bộ có thể xem hay đặt mã này.')}
      </p>
      <label style={lbl}>{t('New code', 'Mã mới')}</label>
      <input value={pin} inputMode="numeric" onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />
      <label style={{ ...lbl, marginTop: 16 }}>{t('Enter it again', 'Nhập lại')}</label>
      <input value={again} inputMode="numeric" onChange={e => setAgain(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />
      <button onClick={save} disabled={busy} style={btn}>{busy ? t('Saving…', 'Đang lưu…') : t('Set code', 'Đặt mã')}</button>
      {msg && <div style={{ marginTop: 16, fontSize: 13, color: msg.ok ? '#2E7D52' : '#B4463F' }}>{msg.text}</div>}
      <p style={{ fontSize: 12, opacity: .5, marginTop: 22, lineHeight: 1.7 }}>
        {t('Steer clear of anything close to you — a birthday, a house number, a year, an anniversary.', 'Tránh những con số gắn với bạn — ngày sinh, số nhà, một năm, một ngày kỷ niệm.')}
      </p>
    </div>
  )
}

const h1: React.CSSProperties = { fontFamily: "'Rampant Sans', Georgia, serif", fontSize: 28, marginBottom: 6 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6, marginBottom: 6 }
const field: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 22, letterSpacing: '.4em', border: '1px solid rgba(0,0,0,.18)', borderRadius: 4, outline: 'none' }
const btn: React.CSSProperties = { marginTop: 22, padding: '12px 26px', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', background: '#052E20', color: '#E5D4C2', border: 'none', borderRadius: 4, cursor: 'pointer' }
