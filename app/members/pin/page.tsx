'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import { PublicPage } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

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
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <CreamInkDefs />
      <div className="pn-wrap">
        <div className="pn-grid">
          <div>
            <h1 className="pn-h1 pn-rise">{t('Your kiosk PIN', 'Mã PIN kiosk của bạn')}</h1>
            <p className="pn-lede pn-rise" style={{ animationDelay: '.08s' }}>
              {t('Six digits, used only on the tablets in the club. Tap your card, enter these six digits, and the tablet becomes yours for a few minutes. Nobody at the club can see or set it — if you forget it, we can clear it and you set a new one here.',
                'Sáu chữ số, chỉ dùng trên các máy tính bảng tại câu lạc bộ. Chạm thẻ, nhập sáu chữ số này, và máy tính bảng sẽ dành riêng cho bạn trong vài phút. Không ai ở câu lạc bộ có thể xem hay đặt mã này — nếu bạn quên, chúng tôi có thể xoá mã cũ để bạn đặt mã mới tại đây.')}
            </p>

            {hasPin !== null && (
              <div className="pn-status">
                {hasPin
                  ? `${t('A PIN is set', 'Đã đặt mã PIN')}${setAt ? ` — ${t('last changed', 'lần đổi gần nhất')} ${new Date(setAt).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB')}` : ''}.`
                  : t('No PIN set yet.', 'Chưa đặt mã PIN.')}
              </div>
            )}

            <div className="pn-form pn-rise" style={{ animationDelay: '.14s' }}>
              <label className="pn-lbl">{hasPin ? t('New PIN', 'Mã PIN mới') : t('Choose a PIN', 'Chọn mã PIN')}</label>
              <input value={pin} inputMode="numeric" onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="pn-field" />
              <label className="pn-lbl">{t('Enter it again', 'Nhập lại')}</label>
              <input value={again} inputMode="numeric" onChange={e => setAgain(e.target.value.replace(/\D/g, '').slice(0, 6))} className="pn-field" />

              <button onClick={save} disabled={busy} className="pk-cta pn-cta">
                {busy ? t('Saving…', 'Đang lưu…') : <>{hasPin ? t('Change PIN', 'Đổi mã PIN') : t('Set PIN', 'Đặt mã PIN')} <span className="pk-go">→</span></>}
              </button>

              {msg && <div className={`pn-msg ${msg.ok ? 'is-ok' : 'is-err'}`}>{msg.text}</div>}
            </div>

            {/* Plain in advance. The dry line is saved for the refusal, where the club
                has just proved the point rather than predicted it. */}
            <p className="pn-advice">
              {t('Steer clear of anything close to you — a birthday, a house number, a year, an anniversary. Runs and repeats are refused: 123456, 111111, 121212 and the like.',
                'Tránh những con số gắn với bạn — ngày sinh, số nhà, một năm, một ngày kỷ niệm. Dãy liên tiếp và lặp lại sẽ bị từ chối: 123456, 111111, 121212 và tương tự.')}
            </p>
          </div>
          <div className="pn-art pn-rise" style={{ animationDelay: '.2s' }}>
            <CreamInk name="key" width="100%" rot={-10} dur={9} />
          </div>
        </div>
      </div>
    </PublicPage>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

const CSS = `
  /* the fixed lion (NavOverlay) sits at the right edge, mid-height, on a desk
     wider than 1024 — keep the column clear of it at any width */
  .pn-wrap { max-width: 1180px; margin: 0 auto; box-sizing: border-box; color: #E5D4C2;
             padding: 140px max(24px, calc(150px - (100vw - 1180px) / 2)) 120px 24px; }
  .pn-grid { display: grid; grid-template-columns: minmax(0, 1fr) clamp(170px, 20vw, 280px); gap: 48px; align-items: start; }
  .pn-rise { opacity: 0; transform: translateY(22px); animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }
  .pn-h1 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(48px, 6.6vw, 96px); line-height: .92; margin: 0; text-wrap: balance; }
  .pn-lede { font-family: ${MONO}; font-size: 14px; line-height: 1.95; opacity: .9; max-width: 540px; margin: 26px 0 0; }
  .pn-status { font-family: ${MONO}; font-size: 13.5px; line-height: 1.8; color: #D4B85A; margin: 26px 0 0; }
  .pn-form { max-width: 420px; margin-top: 44px; }
  .pn-lbl { display: block; font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; opacity: .75; }
  .pn-lbl + .pn-field { margin-top: 4px; }
  .pn-field { display: block; width: 100%; box-sizing: border-box; background: transparent; color: #E5D4C2;
              border: none; border-bottom: 1px solid rgba(229,212,194,.35); border-radius: 0; padding: 12px 0 10px;
              font-family: ${MONO}; font-size: 28px; letter-spacing: .5em; outline: none; transition: border-color .25s ease; }
  .pn-field:focus { border-bottom-color: #D4B85A; }
  /* beats the portal's keyboard ring (layout: [class*=member] textarea:focus-visible) — the gold underline is the focus mark */
  .pn-field.pn-field:focus-visible { outline: none; border-radius: 0; }
  .pn-field + .pn-lbl { margin-top: 30px; }
  .pk-cta.pn-cta { margin-top: 36px; color: #D4B85A; }
  .pk-cta.pn-cta:disabled { opacity: .5; cursor: default; }
  .pn-msg { margin-top: 20px; font-family: ${MONO}; font-size: 13.5px; line-height: 1.8; }
  .pn-msg.is-ok { color: #D4B85A; }
  .pn-msg.is-err { color: #E89B9B; }
  .pn-advice { font-family: ${MONO}; font-size: 13px; line-height: 1.9; opacity: .78; max-width: 460px; margin: 40px 0 0; }
  .pn-art { width: 100%; margin-top: 24px; }

  @media (max-width: 1024px) { .pn-wrap { padding-right: 24px; } }
  @media (max-width: 860px) {
    .pn-wrap { padding: 118px 20px 96px; }
    .pn-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .pn-art { display: none; }
    .pn-h1 { font-size: clamp(44px, 12.5vw, 64px); }
    .pn-lede { font-size: 13.5px; line-height: 1.9; }
    .pn-form { margin-top: 36px; }
  }
  @media (prefers-reduced-motion: reduce) { .pn-rise { opacity: 1; transform: none; animation: none; } }
`
