'use client'

import { useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE SLEEVE STUDIO — put your name on it and see it.
// ───────────────────────────────────────────────────────────────────────────
// A corporate gift is chosen by someone who has to show it to their board. The
// question they are really asking is "what will it look like with our logo on
// it", and no amount of prose answers that. So: pick the colour, drop the logo
// on, write the line underneath, and watch it.
//
// THE PREVIEW IS HONEST ABOUT BEING A PREVIEW. It is a flat rendering of the
// sleeve's front panel — the proportions of the real sleeve, not a photograph
// with something pasted into it. A mock that pretends to be a photograph sets
// an expectation the printer then has to break.
//
// The logo never leaves the browser until an enquiry is actually sent, and then
// only into a private bucket. Nothing here is uploaded as you play.
// ═══════════════════════════════════════════════════════════════════════════

export interface SleeveDesign {
  sleeve_hex: string
  text_hex: string
  company: string
  message: string
  foil: boolean
  /** Object URL for the preview only — never sent anywhere. */
  logo_preview?: string
  /** The file itself, uploaded when the enquiry is sent. */
  logo_file?: File
}

const SWATCHES: { hex: string; en: string; vn: string }[] = [
  { hex: '#052E20', en: 'Club green', vn: 'Xanh câu lạc bộ' },
  { hex: '#7A2E2E', en: 'Oxblood', vn: 'Đỏ mận' },
  { hex: '#14110F', en: 'Ink', vn: 'Đen mực' },
  { hex: '#B8862F', en: 'Old gold', vn: 'Vàng cổ' },
  { hex: '#E5D4C2', en: 'Cream', vn: 'Kem' },
  { hex: '#C8102E', en: 'Tết red', vn: 'Đỏ Tết' },
]

/** Cream on a dark sleeve, ink on a light one — chosen for the buyer rather
 *  than left as another decision they have to get right. */
function readableOn(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#E5D4C2'
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.42 ? '#14110F' : '#E5D4C2'
}

export default function SleeveStudio({ onUse }: { onUse: (d: SleeveDesign) => void }) {
  const { t, lang } = useLang()
  const vn = lang === 'vn'
  const [hex, setHex] = useState('#052E20')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [foil, setFoil] = useState(true)
  const [logo, setLogo] = useState<{ url: string; file: File } | null>(null)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const ink = readableOn(hex)
  const rule = foil ? '#D4B85A' : ink

  const pickLogo = (f: File) => {
    setErr('')
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      setErr(t('PNG, JPEG or WebP, please.', 'Vui lòng dùng PNG, JPEG hoặc WebP.')); return
    }
    // 5MB from 2026-09-21. The file goes browser → storage on a signed URL,
    // so this number is a choice rather than a platform ceiling; the bucket's
    // own file_size_limit enforces the same 5MB on the real upload.
    if (f.size > 5 * 1024 * 1024) {
      setErr(t(`That file is ${(f.size / 1048576).toFixed(1)}MB. The limit is 5MB.`,
               `Tệp ${(f.size / 1048576).toFixed(1)}MB. Giới hạn là 5MB.`)); return
    }
    if (logo?.url) URL.revokeObjectURL(logo.url)
    setLogo({ url: URL.createObjectURL(f), file: f })
  }

  const use = () => onUse({
    sleeve_hex: hex, text_hex: ink, company: company.trim(), message: message.trim(),
    foil, logo_preview: logo?.url, logo_file: logo?.file,
  })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .ss-grid { display: grid; grid-template-columns: minmax(260px, 420px) 1fr; gap: clamp(28px, 5vw, 64px); align-items: start; }
        @media (max-width: 860px) { .ss-grid { grid-template-columns: 1fr; } }
        .ss-sleeve { aspect-ratio: 3 / 4.6; border-radius: 6px; position: relative; overflow: hidden;
                     box-shadow: 0 26px 60px rgba(0,0,0,.42); transition: background .35s ease; }
        .ss-spine { position: absolute; inset: 0 auto 0 0; width: 13%;
                    background: linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,0)); }
        .ss-face { position: absolute; inset: 0; padding: 9% 9% 7% 18%; display: flex; flex-direction: column; }
        .ss-swatch { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(229,212,194,.3); padding: 0; }
        .ss-swatch.is-on { outline: 1px solid #D4B85A; outline-offset: 3px; }
        .ss-input { width: 100%; background: none; border: none; border-bottom: 1px solid rgba(229,212,194,.22);
                    color: #E5D4C2; font-family: 'Google Sans Code', monospace; font-size: 14px;
                    padding: 12px 0; outline: none; border-radius: 0; }
        .ss-input:focus { border-bottom-color: #D4B85A; }
        .ss-input::placeholder { color: rgba(229,212,194,.38); }
        .ss-drop { border: 1px dashed rgba(229,212,194,.28); border-radius: 8px; padding: 18px;
                   text-align: center; cursor: pointer; background: none; width: 100%;
                   font-family: 'Google Sans Code', monospace; font-size: 12px; color: rgba(229,212,194,.7); }
        .ss-drop:hover { border-color: #D4B85A; color: #E5D4C2; }
      ` }} />

      <div className="ss-grid">
        {/* ── The sleeve ───────────────────────────────────────────── */}
        <div>
          <div className="ss-sleeve" style={{ background: hex }}>
            <div className="ss-spine" />
            <div className="ss-face">
              <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 8, letterSpacing: '.24em',
                            textTransform: 'uppercase', color: rule, opacity: .9 }}>
                Duncan Taylor · Tết Đinh Mùi
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8% 0' }}>
                {logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo.url} alt="" style={{ maxWidth: '78%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(18px,2.4vw,26px)',
                                color: ink, opacity: company ? 1 : .35, textAlign: 'center', lineHeight: 1.15 }}>
                    {company || t('Your logo here', 'Logo của quý vị')}
                  </div>
                )}
              </div>

              {foil && <div style={{ height: 1, background: rule, opacity: .75, marginBottom: '6%' }} />}

              {company && logo && (
                <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(13px,1.5vw,17px)', color: ink, lineHeight: 1.2 }}>
                  {company}
                </div>
              )}
              <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 8.5, lineHeight: 1.7,
                            color: ink, opacity: .8, marginTop: 6, minHeight: 20 }}>
                {message || t('Your message — a line of thanks, in either language.', 'Lời nhắn của quý vị — một dòng tri ân.')}
              </div>
            </div>
          </div>
          <p className="pk-meta" style={{ marginTop: 12, opacity: .55 }}>
            {t('A flat preview of the sleeve front, at the real proportions. The printer works from your artwork, not from this.',
               'Bản xem trước mặt trước của hộp, đúng tỷ lệ thật. Nhà in sẽ làm việc với tệp thiết kế của quý vị.')}
          </p>
        </div>

        {/* ── The controls ─────────────────────────────────────────── */}
        <div>
          <div className="pk-eyebrow">{t('Sleeve colour', 'Màu hộp')}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
            {SWATCHES.map(s => (
              <button key={s.hex} onClick={() => setHex(s.hex)}
                      className={`ss-swatch ${hex.toLowerCase() === s.hex.toLowerCase() ? 'is-on' : ''}`}
                      style={{ background: s.hex }} title={vn ? s.vn : s.en} aria-label={vn ? s.vn : s.en} />
            ))}
          </div>

          {/* The hex field sat in the swatch row with no label but its own
              contents — a box reading #052E20 looks like a read-out of the
              swatch you just clicked, not somewhere to type your brand colour.
              Saying so is the whole fix. */}
          <label style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 18 }}>
            <span className="pk-meta" style={{ fontSize: 12.5, opacity: .75 }}>
              {t('Custom Hex Code', 'Mã màu Hex riêng')}
            </span>
            <input value={hex} onChange={e => setHex(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
                   maxLength={7} spellCheck={false} placeholder="#052E20"
                   aria-label={t('Custom Hex Code', 'Mã màu Hex riêng')}
                   className="ss-input" style={{ width: 96, padding: '6px 0', fontSize: 12.5, letterSpacing: '.08em' }} />
          </label>

          <div style={{ marginTop: 30 }}>
            <div className="pk-eyebrow">{t('Your logo', 'Logo của quý vị')}</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
                   onChange={e => { const f = e.target.files?.[0]; if (f) pickLogo(f) }} />
            <div style={{ marginTop: 12 }}>
              {logo ? (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="pk-meta">{logo.file.name} · {(logo.file.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => fileRef.current?.click()} className="pk-cta" style={{ marginTop: 0 }}>
                    {t('Replace', 'Thay')} <span className="pk-go">→</span>
                  </button>
                  <button onClick={() => { if (logo.url) URL.revokeObjectURL(logo.url); setLogo(null) }}
                          className="pk-cta" style={{ marginTop: 0, opacity: .6 }}>
                    {t('Remove', 'Xoá')}
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="ss-drop">
                  {t('Add a PNG, JPEG or WebP — up to 5MB', 'Thêm tệp PNG, JPEG hoặc WebP — tối đa 5MB')}
                </button>
              )}
              {err && <p className="pk-meta" style={{ color: '#C27070', marginTop: 10 }}>{err}</p>}
            </div>
          </div>

          <div style={{ marginTop: 30 }}>
            <div className="pk-eyebrow">{t('The words', 'Nội dung chữ')}</div>
            <input className="ss-input" style={{ marginTop: 10 }} value={company} onChange={e => setCompany(e.target.value.slice(0, 40))}
                   placeholder={t('Your company', 'Tên công ty')} aria-label={t('Your company', 'Tên công ty')} />
            <input className="ss-input" style={{ marginTop: 6 }} value={message} onChange={e => setMessage(e.target.value.slice(0, 90))}
                   placeholder={t('A line of thanks (optional)', 'Lời tri ân (không bắt buộc)')} aria-label={t('Message', 'Lời nhắn')} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, cursor: 'pointer' }}>
            <input type="checkbox" checked={foil} onChange={e => setFoil(e.target.checked)}
                   style={{ width: 17, height: 17, accentColor: '#D4B85A' }} />
            <span className="pk-meta" style={{ fontSize: 12.5 }}>
              {t('Gold foil detailing', 'Chi tiết ép nhũ vàng')}
              <span style={{ display: 'block', opacity: .55, marginTop: 3 }}>
                {t('The header line and the hairline, foiled in gold. Your logo prints as you supply it either way.',
                   'Dòng tiêu đề và đường kẻ mảnh được ép nhũ vàng. Logo của quý vị vẫn in đúng như tệp gốc.')}
              </span>
            </span>
          </label>

          <button onClick={use} className="pk-cta">
            {t('Send this design with an enquiry', 'Gửi thiết kế này kèm yêu cầu')} <span className="pk-go">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
