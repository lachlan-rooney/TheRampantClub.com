'use client'

import { useState } from 'react'
import { useLang } from '@/lib/lang'
import { GOLD, GROUND, CREAM } from './palette'

// THE MAILING LIST — the kiosk's second tab.
//
// Owner, 2026-10-27, for the launch: tickboxes for what people are interested
// in, a name, an email, and agreement to receive email marketing.
//
// ── WHAT A FORM ON A SHARED TABLET HAS TO GET RIGHT ───────────────────────
// It is filled in standing up, by a stranger, with somebody waiting behind
// them, on a device the last person just used. So:
//   · the consent box starts UNTICKED and the form refuses without it
//   · every field clears after a save — the next guest must never see the
//     last guest's name and email sitting on the screen
//   · the whole thing resets itself a few seconds after "thank you"
//   · touch targets are 48px+; the interests are buttons, not 20px checkboxes
//   · no autofocus, which on Android throws the keyboard up over the form
//
// ── THE CONSENT WORDING TRAVELS WITH THE CONSENT ──────────────────────────
// The exact sentence shown is posted with the form and stored on the row. A
// consent record that cannot say what was on the screen proves nothing, so
// the server refuses a signup that does not carry it.

const INTERESTS = [
  { k: 'shop_discount', en: 'Shop discounts',       vn: 'Ưu đãi tại cửa hàng' },
  { k: 'events',        en: 'Events',               vn: 'Sự kiện' },
  { k: 'whisky_club',   en: 'Whisky club',          vn: 'Câu lạc bộ whisky' },
  { k: 'tastings',      en: 'Tasting events',       vn: 'Buổi nếm thử' },
  { k: 'b2b',           en: 'Trade & corporate',    vn: 'Doanh nghiệp & đối tác' },
] as const

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function EmbassySignup() {
  const { t, lang } = useLang()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [consent, setConsent] = useState(false)   // UNTICKED. Always.
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | { returning: boolean }>(null)
  const [err, setErr] = useState('')

  const CONSENT_TEXT = t(
    'I agree to receive marketing emails from The Spirits Embassy about products, offers and events. I can unsubscribe at any time.',
    'Tôi đồng ý nhận email tiếp thị từ The Spirits Embassy về sản phẩm, ưu đãi và sự kiện. Tôi có thể hủy đăng ký bất cứ lúc nào.',
  )

  const toggle = (k: string) =>
    setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]))

  const reset = () => { setName(''); setEmail(''); setPicked([]); setConsent(false); setErr('') }

  const submit = async () => {
    if (busy) return
    setErr('')
    if (!name.trim()) { setErr(t('Please add a name.', 'Vui lòng nhập tên.')); return }
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErr(t('That email does not look right.', 'Địa chỉ email chưa đúng.')); return
    }
    if (!consent) { setErr(t('Please tick the box to agree.', 'Vui lòng tích vào ô đồng ý.')); return }

    setBusy(true)
    try {
      const r = await fetch('/api/embassy/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name, email, interests: picked,
          marketing_consent: true, consent_text: CONSENT_TEXT, locale: lang,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(j.error === 'busy'
          ? t('Too many sign-ups at once. Try again in a moment.', 'Quá nhiều lượt đăng ký. Vui lòng thử lại sau giây lát.')
          : t('Could not save that. Please tell a member of staff.', 'Không lưu được. Vui lòng báo nhân viên.'))
        return
      }
      setDone({ returning: !!j.returning })
      // THE SCREEN MUST NOT HOLD THE LAST GUEST'S DETAILS.
      reset()
      setTimeout(() => setDone(null), 6000)
    } catch {
      setErr(t('Could not save that. Please tell a member of staff.', 'Không lưu được. Vui lòng báo nhân viên.'))
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="es-wrap">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="es-done">
          <div className="es-done-t">{t('Thank you.', 'Cảm ơn bạn.')}</div>
          <p className="es-done-s">
            {done.returning
              ? t('You were already on the list — we have added your new interests.',
                  'Bạn đã có trong danh sách — chúng tôi đã thêm các mục bạn vừa chọn.')
              : t('You are on the list. We will be in touch.',
                  'Bạn đã có trong danh sách. Chúng tôi sẽ liên hệ.')}
          </p>
          <button className="es-again" onClick={() => setDone(null)}>
            {t('Add someone else', 'Thêm người khác')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="es-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <h2 className="es-h">{t('Keep in touch', 'Giữ liên lạc')}</h2>
      <p className="es-lede">
        {t('Tell us what interests you and we will send only that.',
           'Hãy cho chúng tôi biết bạn quan tâm điều gì — chúng tôi chỉ gửi đúng những nội dung đó.')}
      </p>

      <div className="es-field">
        <label className="es-label" htmlFor="es-name">{t('Name', 'Họ và tên')}</label>
        <input id="es-name" className="es-input" value={name} maxLength={120}
               onChange={e => setName(e.target.value)} autoComplete="off" />
      </div>

      <div className="es-field">
        <label className="es-label" htmlFor="es-email">{t('Email', 'Email')}</label>
        <input id="es-email" className="es-input" value={email} maxLength={254}
               onChange={e => setEmail(e.target.value)} type="email"
               inputMode="email" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </div>

      <div className="es-field">
        <div className="es-label">{t('I am interested in', 'Tôi quan tâm đến')}</div>
        {/* Buttons, not checkboxes: a 20px tick box is a poor target on a
            tablet, and aria-pressed carries the same meaning to a screen
            reader as a checked box. */}
        <div className="es-chips">
          {INTERESTS.map(i => (
            <button key={i.k} type="button" onClick={() => toggle(i.k)}
                    aria-pressed={picked.includes(i.k)}
                    className={`es-chip ${picked.includes(i.k) ? 'is-on' : ''}`}>
              {lang === 'vn' ? i.vn : i.en}
            </button>
          ))}
        </div>
      </div>

      {/* THE CONSENT. Unticked, and the form refuses without it. */}
      <label className="es-consent">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>{CONSENT_TEXT}</span>
      </label>

      {err && <div className="es-err">{err}</div>}

      <button className="es-go" onClick={submit} disabled={busy}>
        {busy ? t('Saving…', 'Đang lưu…') : t('Join the list', 'Đăng ký')}
      </button>

      <p className="es-fine">
        {t('We keep your name and email to send what you ticked. Nothing else, and never passed on.',
           'Chúng tôi lưu tên và email của bạn để gửi đúng những mục bạn đã chọn. Không dùng cho mục đích khác và không chia sẻ cho bên thứ ba.')}
      </p>
    </div>
  )
}

const CSS = `
  .es-wrap { max-width: 760px; margin: 0 auto; padding: clamp(20px,3vw,40px) clamp(18px,4vw,48px) clamp(40px,6vh,80px); }
  .es-h { font-family: ${SERIF}; font-size: clamp(30px,4.4vw,52px); color: ${CREAM};
          margin: 0; font-weight: 400; line-height: 1.05; }
  .es-lede { font-family: ${SERIF}; font-size: clamp(15px,1.5vw,19px); line-height: 1.6;
             color: ${CREAM}; opacity: .78; margin: 12px 0 clamp(22px,3vh,36px); max-width: 48ch; }

  .es-field { margin-bottom: clamp(18px,2.6vh,28px); }
  .es-label { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: .16em;
              text-transform: uppercase; color: rgba(229,212,194,.55); margin-bottom: 8px; }
  .es-input { width: 100%; box-sizing: border-box; min-height: 52px;
              background: rgba(229,212,194,.07); border: 1px solid rgba(210,179,127,.34);
              border-radius: 6px; color: ${CREAM}; font-family: ${SERIF}; font-size: 19px;
              padding: 12px 15px; outline: none; }
  .es-input:focus { border-color: ${GOLD}; background: rgba(229,212,194,.11); }

  .es-chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .es-chip { min-height: 52px; padding: 13px 20px; cursor: pointer; color: ${CREAM};
             background: rgba(229,212,194,.06); border: 1px solid rgba(210,179,127,.34);
             border-radius: 999px; font-family: ${MONO}; font-size: 13px; letter-spacing: .04em;
             -webkit-tap-highlight-color: transparent; }
  .es-chip.is-on { background: ${GOLD}; border-color: ${GOLD}; color: ${GROUND}; font-weight: 600; }

  .es-consent { display: flex; gap: 14px; align-items: center; cursor: pointer;
                margin: clamp(18px,2.6vh,28px) 0 0; padding: 14px;
                border: 1px solid rgba(210,179,127,.22); border-radius: 8px;
                background: rgba(229,212,194,.04); }
  /* 26px measured on every iPad size in WebKit — under a finger's 40px. The
     whole label is tappable, so it was never broken, but a guest aims at the
     BOX. */
  .es-consent input { width: 40px; height: 40px; flex: 0 0 auto; margin: 0; accent-color: ${GOLD}; cursor: pointer; }
  .es-consent span { font-family: ${MONO}; font-size: 12.5px; line-height: 1.75; color: ${CREAM}; opacity: .88; }

  .es-go { width: 100%; min-height: 60px; margin-top: clamp(18px,2.6vh,28px); cursor: pointer;
           background: ${GOLD}; border: none; border-radius: 8px; color: ${GROUND};
           font-family: ${MONO}; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; }
  .es-go:disabled { opacity: .55; cursor: default; }

  .es-err { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #E39A9A; margin-top: 14px; }
  .es-fine { font-family: ${MONO}; font-size: 10.5px; line-height: 1.8;
             color: rgba(229,212,194,.45); margin: 18px 0 0; max-width: 56ch; }

  .es-done { padding: clamp(40px,8vh,90px) 0; text-align: left; }
  .es-done-t { font-family: ${SERIF}; font-size: clamp(32px,5vw,58px); color: ${GOLD}; line-height: 1.05; }
  .es-done-s { font-family: ${SERIF}; font-size: clamp(16px,1.7vw,21px); line-height: 1.6;
               color: ${CREAM}; opacity: .82; margin: 14px 0 0; max-width: 42ch; }
  .es-again { margin-top: 26px; min-height: 52px; padding: 13px 22px; cursor: pointer;
              background: none; border: 1px solid rgba(210,179,127,.4); border-radius: 999px;
              color: ${GOLD}; font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }

  @media (pointer: coarse) { .es-chip, .es-input, .es-go { font-size: 15px; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`
