'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

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

/** What the sleeve studio hands over. The file is uploaded here, at the moment
 *  the buyer actually sends something — never while they are still playing. */
export interface EnquiryDesign {
  sleeve_hex: string
  text_hex: string
  company: string
  message: string
  foil: boolean
  logo_preview?: string
  logo_file?: File
}


export default function TetEnquiry({
  target, provisional, design, onClose,
}: {
  target: EnquiryTarget
  provisional: boolean
  design?: EnquiryDesign
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
      // The logo goes up first, and only now. If it fails the enquiry still
      // goes — losing a whole enquiry over an image would be the wrong trade,
      // and the design is recorded either way so we know to ask for the file.
      let logo_path: string | null = null
      if (design?.logo_file) {
        try {
          // TWO STEPS, AND THE BYTES SKIP OUR SERVER. We ask for a one-shot
          // signed URL, then PUT the file straight to storage. It used to be
          // base64 in a JSON body, which is 4/3 the size — a 5MB logo is
          // ~6.7MB on the wire and Vercel refuses a request body over 4.5MB
          // before the route runs. That failure would have appeared in
          // production only; `next dev` has no such limit.
          const up = await fetch('/api/tet/artwork', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content_type: design.logo_file.type, size: design.logo_file.size }),
          })
          const uj = await up.json().catch(() => ({}))
          if (up.ok && uj.signed_url) {
            const put = await fetch(uj.signed_url, {
              method: 'PUT',
              headers: { 'Content-Type': design.logo_file.type },
              body: design.logo_file,
            })
            // Only claim the path if storage actually took it. The bucket
            // enforces the 5MB ceiling itself, so a file that lies about its
            // size is refused here rather than trusted upstream.
            if (put.ok) logo_path = uj.path
          }
        } catch { /* the enquiry is worth more than the file */ }
      }

      const personalisation = design ? {
        sleeve_hex: design.sleeve_hex, text_hex: design.text_hex,
        company: design.company, message: design.message, foil: design.foil,
        logo_path, logo_filename: design.logo_file?.name ?? null,
      } : undefined

      const r = await fetch('/api/tet/reserve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, kind: target.kind, cask_ref: target.cask_ref ?? null,
          target_abv: target.target_abv ?? null, locale: lang, source: 'tet-page',
          ...(personalisation ? { personalisation } : {}),
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

      {/* The sheet covers the page, and the switch with it — so it carries its
          own, or a buyer who wants the other language has to abandon the form. */}
      <div style={{ position: 'absolute', top: 16, right: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
        <LangToggle compact />
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

            {/* What they designed, so they can see it is coming with them. */}
            {design && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 26 }}>
                <div style={{
                  width: 54, height: 82, borderRadius: 4, background: design.sleeve_hex,
                  border: '1px solid rgba(229,212,194,.18)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                }}>
                  {design.logo_preview
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={design.logo_preview} alt="" style={{ maxWidth: '78%', maxHeight: '70%', objectFit: 'contain' }} />
                    : <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 10, color: design.text_hex, opacity: .8, padding: 4, textAlign: 'center' }}>
                        {design.company || '—'}
                      </span>}
                </div>
                <div className="pk-meta" style={{ lineHeight: 1.8 }}>
                  {t('Your sleeve comes with this enquiry', 'Thiết kế hộp sẽ được gửi kèm')}
                  <br />
                  <span style={{ opacity: .6 }}>
                    {design.sleeve_hex}{design.logo_file ? ` · ${design.logo_file.name}` : ` · ${t('no logo yet', 'chưa có logo')}`}
                  </span>
                </div>
              </div>
            )}

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
