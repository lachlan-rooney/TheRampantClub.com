'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'

// Set your kiosk PIN. Six digits, and nobody at the club ever learns them: this
// page is the only place a PIN is ever set, and it runs as you.

export default function MemberPin() {
  const { t, lang } = useLang()
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
    if (!/^[0-9]{6}$/.test(pin)) return setMsg({ ok: false, text: t('Six digits, please.', 'Vui lòng nhập sáu chữ số.') })
    if (pin !== again) return setMsg({ ok: false, text: t('The two entries don’t match.', 'Hai lần nhập không khớp.') })
    setBusy(true)
    const r = await fetch('/api/members/kiosk-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
    })
    setBusy(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setMsg({ ok: false, text: j.error || t('Could not set your PIN.', 'Chưa đặt được mã PIN.') })
    setPin(''); setAgain(''); setMsg({ ok: true, text: t('Your PIN is set.', 'Đã đặt mã PIN của bạn.') }); load()
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <h1 style={{ fontFamily: "'Rampant Sans', Georgia, serif", fontSize: 28, marginBottom: 6 }}>{t('Your kiosk PIN', 'Mã PIN kiosk của bạn')}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, opacity: .75, marginBottom: 24 }}>
        {t('Six digits, used only on the tablets in the club. Tap your card, enter these six digits, and the tablet becomes yours for a few minutes. Nobody at the club can see or set it — if you forget it, we can clear it and you set a new one here.',
          'Sáu chữ số, chỉ dùng trên các máy tính bảng tại câu lạc bộ. Chạm thẻ, nhập sáu chữ số này, và máy tính bảng sẽ dành riêng cho bạn trong vài phút. Không ai ở câu lạc bộ có thể xem hay đặt mã này — nếu bạn quên, chúng tôi có thể xoá mã cũ để bạn đặt mã mới tại đây.')}
      </p>

      {hasPin !== null && (
        <div style={{ fontSize: 13, opacity: .6, marginBottom: 20 }}>
          {hasPin
            ? `${t('A PIN is set', 'Đã đặt mã PIN')}${setAt ? ` — ${t('last changed', 'lần đổi gần nhất')} ${new Date(setAt).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB')}` : ''}.`
            : t('No PIN set yet.', 'Chưa đặt mã PIN.')}
        </div>
      )}

      <label style={lbl}>{hasPin ? t('New PIN', 'Mã PIN mới') : t('Choose a PIN', 'Chọn mã PIN')}</label>
      <input value={pin} inputMode="numeric" onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />
      <label style={{ ...lbl, marginTop: 16 }}>{t('Enter it again', 'Nhập lại')}</label>
      <input value={again} inputMode="numeric" onChange={e => setAgain(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field} />

      <button onClick={save} disabled={busy} style={btn}>{busy ? t('Saving…', 'Đang lưu…') : hasPin ? t('Change PIN', 'Đổi mã PIN') : t('Set PIN', 'Đặt mã PIN')}</button>

      {msg && <div style={{ marginTop: 16, fontSize: 13, color: msg.ok ? '#2E7D52' : '#B4463F' }}>{msg.text}</div>}

      {/* Plain in advance. The dry line is saved for the refusal, where the club
          has just proved the point rather than predicted it. */}
      <p style={{ fontSize: 12, opacity: .55, marginTop: 26, lineHeight: 1.8 }}>
        {t('Steer clear of anything close to you — a birthday, a house number, a year, an anniversary. Runs and repeats are refused: 123456, 111111, 121212 and the like.',
          'Tránh những con số gắn với bạn — ngày sinh, số nhà, một năm, một ngày kỷ niệm. Dãy liên tiếp và lặp lại sẽ bị từ chối: 123456, 111111, 121212 và tương tự.')}
      </p>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6, marginBottom: 6 }
const field: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 22, letterSpacing: '.4em', border: '1px solid rgba(0,0,0,.18)', borderRadius: 4, outline: 'none' }
const btn: React.CSSProperties = { marginTop: 22, padding: '12px 26px', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', background: '#052E20', color: '#E5D4C2', border: 'none', borderRadius: 4, cursor: 'pointer' }
