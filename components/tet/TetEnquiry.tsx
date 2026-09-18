'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// THE ONE FORM. It takes an enquiry while the programme is provisional and a
// reservation once it is not — the page never asks the buyer which, because the
// buyer cannot know and should not have to.
//
// Five fields, three of them required. A corporate buyer filling this in on a
// phone between meetings will not finish a longer one, and everything else
// (personalisation, split delivery, the tax code for the invoice) is a
// conversation that happens after somebody replies.
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
  const firstField = useRef<HTMLInputElement>(null)

  useEffect(() => { firstField.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {done ? (
          <>
            <div style={eyebrow}>{done.mode === 'reservation' ? t('Reserved', 'Đã giữ chỗ') : t('Thank you', 'Cảm ơn quý vị')}</div>
            <h2 style={heading}>{done.reference}</h2>
            <p style={body}>
              {done.mode === 'reservation'
                ? t('That cask is held for you while we prepare the invoice. We will be in touch to confirm.',
                    'Thùng rượu được giữ cho quý vị trong khi chúng tôi chuẩn bị hóa đơn. Chúng tôi sẽ liên hệ để xác nhận.')
                : t('We have your details and will come back to you with the cask list and prices as soon as they are confirmed.',
                    'Chúng tôi đã nhận thông tin và sẽ liên hệ lại với danh sách thùng và bảng giá ngay khi được xác nhận.')}
            </p>
            <p style={{ ...fine, marginTop: 14 }}>
              {t('Keep this reference — it is how we will find you.', 'Vui lòng giữ mã này — chúng tôi sẽ dùng để tra cứu.')}
            </p>
            <button onClick={onClose} style={primary}>{t('Close', 'Đóng')}</button>
          </>
        ) : (
          <>
            <div style={eyebrow}>
              {provisional ? t('Register interest', 'Đăng ký quan tâm') : t('Reserve', 'Giữ chỗ')}
            </div>
            <h2 style={heading}>{target.title}</h2>
            <p style={body}>
              {provisional
                ? t('The cask list and prices are still being confirmed. Leave your details and we will come to you first, before it goes any wider.',
                    'Danh sách thùng và bảng giá đang được xác nhận. Hãy để lại thông tin, chúng tôi sẽ liên hệ với quý vị trước tiên.')
                : t('This holds it while we prepare your invoice. Nothing is charged here.',
                    'Thao tác này giữ chỗ trong khi chúng tôi chuẩn bị hóa đơn. Không có khoản thanh toán nào tại đây.')}
            </p>

            <form onSubmit={submit} style={{ marginTop: 18 }}>
              <input ref={firstField} value={form.company_name} onChange={set('company_name')} style={field}
                     placeholder={t('Company', 'Công ty')} aria-label={t('Company', 'Công ty')} />
              <input value={form.contact_name} onChange={set('contact_name')} style={field}
                     placeholder={t('Your name', 'Tên của quý vị')} aria-label={t('Your name', 'Tên của quý vị')} />
              <input value={form.contact_email} onChange={set('contact_email')} style={field} type="email"
                     placeholder={t('Email', 'Email')} aria-label={t('Email', 'Email')} />
              <input value={form.contact_phone} onChange={set('contact_phone')} style={field}
                     placeholder={t('Phone or Zalo (optional)', 'Điện thoại hoặc Zalo (không bắt buộc)')} aria-label={t('Phone', 'Điện thoại')} />
              <textarea value={form.message} onChange={set('message')} rows={3} style={{ ...field, resize: 'vertical', paddingTop: 12 }}
                        placeholder={t('Anything we should know (optional)', 'Điều gì chúng tôi nên biết (không bắt buộc)')} />

              {err && <div style={error}>{err}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={busy || !ready} style={{ ...primary, opacity: busy || !ready ? 0.45 : 1, marginTop: 0 }}>
                  {busy ? t('Sending…', 'Đang gửi…') : provisional ? t('Send', 'Gửi') : t('Reserve', 'Giữ chỗ')}
                </button>
                <button type="button" onClick={onClose} style={ghost}>{t('Cancel', 'Huỷ')}</button>
              </div>
            </form>

            <p style={fine}>
              {t('You confirmed you are 18 or over when you entered. Nothing here is an offer for sale; any order is completed on invoice.',
                 'Quý vị đã xác nhận từ 18 tuổi trở lên khi vào trang. Nội dung này không phải lời chào bán; đơn hàng hoàn tất bằng hóa đơn.')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(3,20,14,.72)', backdropFilter: 'blur(3px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9000,
}
const panel: React.CSSProperties = {
  width: 'min(460px, 100%)', maxHeight: '90dvh', overflowY: 'auto',
  background: '#052E20', border: '1px solid rgba(212,184,90,.3)', borderRadius: 14,
  padding: '24px 26px', color: '#E5D4C2',
}
const eyebrow: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#D4B85A',
}
const heading: React.CSSProperties = {
  fontFamily: SERIF, fontSize: 26, fontWeight: 500, margin: '10px 0 0', lineHeight: 1.15,
}
const body: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12.5, lineHeight: 1.9, color: 'rgba(229,212,194,.75)', marginTop: 10,
}
const field: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '0 14px', marginBottom: 10, borderRadius: 8, boxSizing: 'border-box',
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.22)',
  color: '#E5D4C2', fontFamily: MONO, fontSize: 15, outline: 'none',
}
const primary: React.CSSProperties = {
  flex: 1, minHeight: 48, marginTop: 14, borderRadius: 8, cursor: 'pointer',
  background: '#E5D4C2', color: '#052E20', border: 'none',
  fontFamily: MONO, fontSize: 12.5, letterSpacing: '.1em', textTransform: 'uppercase',
}
const ghost: React.CSSProperties = {
  minHeight: 48, padding: '0 18px', borderRadius: 8, cursor: 'pointer',
  background: 'none', color: '#E5D4C2', border: '1px solid rgba(229,212,194,.28)',
  fontFamily: MONO, fontSize: 12.5, letterSpacing: '.1em', textTransform: 'uppercase',
}
const error: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 4, lineHeight: 1.7,
}
const fine: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, color: 'rgba(229,212,194,.4)', lineHeight: 1.8, marginTop: 18,
}
