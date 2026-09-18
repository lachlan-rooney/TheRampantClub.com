'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// THE FORM, IN THE SITE'S LANGUAGE.
//
// It was a bordered panel floating on a dim backdrop — the admin portal's
// furniture again, on the one screen where a buyer actually commits to
// something. Now it is the page's own ground, its own display type, and
// hairline fields: a rule under the words, nothing boxed.
//
// Five fields, three required. A corporate buyer filling this in on a phone
// between meetings will not finish a longer one, and the tax code, the
// personalisation and the split delivery are a conversation that happens after
// somebody replies.
//
// The 18+ confirmation is not asked again: it was given at the door, and asking
// twice reads as a form that was not paying attention.

export interface EnquiryTarget {
  kind: 'cask' | 'blend'
  cask_ref?: string
  title: string
  target_abv?: number | null
}

export default function TetEnquiry({
  target, provisional, onClose,
}: {
  target: EnquiryTarget
  provisional: boolean
  onClose: () => void
}) {
  const { t, lang } = useLang()
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ reference: string; mode: string } | null>(null)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => { first.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // The page behind must not scroll under the form.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const ready = form.company_name.trim() && form.contact_name.trim() && form.contact_email.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/tet/reserve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, kind: target.kind, cask_ref: target.cask_ref ?? null,
          target_abv: target.target_abv ?? null, locale: lang, source: 'tet-page',
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.message || t('That did not send.', 'Không gửi được.')); return }
      setDone({ reference: j.reference, mode: j.mode })
    } catch {
      setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.'))
    } finally { setBusy(false) }
  }

  return (
    <div style={sheet} role="dialog" aria-modal="true">
      <style dangerouslySetInnerHTML={{ __html: `
        .tq-field {
          width: 100%; background: none; border: none; border-radius: 0;
          border-bottom: 1px solid rgba(229,212,194,.22);
          color: #E5D4C2; font-family: 'Google Sans Code','DM Mono',monospace;
          font-size: 15px; line-height: 1.6; padding: 14px 0; outline: none;
        }
        .tq-field::placeholder { color: rgba(229,212,194,.38); }
        .tq-field:focus { border-bottom-color: #D4B85A; }
        .tq-close {
          background: none; border: none; cursor: pointer; padding: 6px;
          color: rgba(229,212,194,.6); font-family: 'Google Sans Code',monospace;
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
        }
        .tq-close:hover { color: #E5D4C2; }
      ` }} />

      <div style={{ position: 'absolute', top: 18, right: 20 }}>
        <button onClick={onClose} className="tq-close">{t('Close', 'Đóng')} ✕</button>
      </div>

      <div style={inner}>
        {done ? (
          <>
            <div className="pk-eyebrow">
              {done.mode === 'reservation' ? t('Reserved', 'Đã giữ chỗ') : t('Thank you', 'Cảm ơn quý vị')}
            </div>
            <h2 className="pk-h2" style={{ marginTop: 14 }}>{done.reference}</h2>
            <p className="pk-lede">
              {done.mode === 'reservation'
                ? t('That cask is held for you while we prepare the invoice. We will be in touch to confirm.',
                    'Thùng rượu được giữ cho quý vị trong khi chúng tôi chuẩn bị hóa đơn. Chúng tôi sẽ liên hệ để xác nhận.')
                : t('We have your details, and we will come to you first with the cask list and prices as soon as they are confirmed.',
                    'Chúng tôi đã nhận thông tin, và sẽ liên hệ với quý vị đầu tiên khi có danh sách thùng và bảng giá.')}
            </p>
            <p className="pk-meta" style={{ marginTop: 18 }}>
              {t('Keep this reference — it is how we will find you.', 'Vui lòng giữ mã này — chúng tôi sẽ dùng để tra cứu.')}
            </p>
            <button onClick={onClose} className="pk-cta">{t('Close', 'Đóng')} <span className="pk-go">→</span></button>
          </>
        ) : (
          <>
            <div className="pk-eyebrow">
              {provisional ? t('Register interest', 'Đăng ký quan tâm') : t('Reserve', 'Giữ chỗ')}
            </div>
            <h2 className="pk-h2" style={{ marginTop: 14 }}>{target.title}</h2>
            <p className="pk-lede">
              {provisional
                ? t('The cask list and prices are still being confirmed. Leave your details and we will come to you first.',
                    'Danh sách thùng và bảng giá đang được xác nhận. Hãy để lại thông tin, chúng tôi sẽ liên hệ với quý vị trước tiên.')
                : t('This holds it while we prepare your invoice. Nothing is charged here.',
                    'Thao tác này giữ chỗ trong khi chúng tôi chuẩn bị hóa đơn. Không có khoản thanh toán nào tại đây.')}
            </p>

            <form onSubmit={submit} style={{ marginTop: 34 }}>
              <input ref={first} className="tq-field" value={form.company_name} onChange={set('company_name')}
                     placeholder={t('Company', 'Công ty')} aria-label={t('Company', 'Công ty')} />
              <input className="tq-field" value={form.contact_name} onChange={set('contact_name')}
                     placeholder={t('Your name', 'Tên của quý vị')} aria-label={t('Your name', 'Tên của quý vị')} />
              <input className="tq-field" type="email" value={form.contact_email} onChange={set('contact_email')}
                     placeholder={t('Email', 'Email')} aria-label={t('Email', 'Email')} />
              <input className="tq-field" value={form.contact_phone} onChange={set('contact_phone')}
                     placeholder={t('Phone or Zalo (optional)', 'Điện thoại hoặc Zalo (không bắt buộc)')} aria-label={t('Phone', 'Điện thoại')} />
              <textarea className="tq-field" rows={2} value={form.message} onChange={set('message')}
                        style={{ resize: 'vertical' }}
                        placeholder={t('Anything we should know (optional)', 'Điều gì chúng tôi nên biết (không bắt buộc)')} />

              {err && <p className="pk-meta" style={{ color: '#C27070', marginTop: 16 }}>{err}</p>}

              <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <button type="submit" disabled={busy || !ready} className="pk-cta"
                        style={{ opacity: busy || !ready ? .4 : 1, cursor: busy || !ready ? 'not-allowed' : 'pointer' }}>
                  {busy ? t('Sending', 'Đang gửi') : provisional ? t('Send', 'Gửi') : t('Reserve', 'Giữ chỗ')} <span className="pk-go">→</span>
                </button>
                <button type="button" onClick={onClose} className="tq-close" style={{ padding: 0 }}>
                  {t('Cancel', 'Huỷ')}
                </button>
              </div>
            </form>

            <p className="pk-meta" style={{ marginTop: 40, maxWidth: 520, lineHeight: 1.9 }}>
              {t('You confirmed you are 18 or over when you entered. Nothing here is an offer for sale; any order is completed on invoice.',
                 'Quý vị đã xác nhận từ 18 tuổi trở lên khi vào trang. Nội dung này không phải lời chào bán; đơn hàng hoàn tất bằng hóa đơn.')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// The page's own ground, edge to edge — not a card floating on a dimmed copy
// of the page behind it.
const sheet: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: '#052E20', color: '#E5D4C2',
  overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
}
const inner: React.CSSProperties = {
  width: 'min(620px, 100%)', padding: 'clamp(64px, 12vh, 140px) 24px 80px',
}
