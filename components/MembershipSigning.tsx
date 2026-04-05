'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import agreementData from '@/data/membership-agreement-content.json'

interface PrefillData {
  fullName: string
  email: string
  mobile: string
  referredBy: string
  profession: string
  category: string
  dateOfBirth: string
  nationality: string
  homeAddress: string
  companyName: string
}

interface Props {
  token: string
  prefill: PrefillData
}

const FONTS = [
  { name: 'Dancing Script', family: "'Dancing Script', cursive" },
  { name: 'Great Vibes', family: "'Great Vibes', cursive" },
  { name: 'Caveat', family: "'Caveat', cursive" },
]

const GREEN = '#052E20'
const CREAM = '#E5D4C2'
const GOLD = '#C9A84C'
const MUTED = '#B2AA98'

export default function MembershipSigning({ token, prefill }: Props) {
  const [lang, setLang] = useState<'en' | 'vi'>('en')
  const [form, setForm] = useState({
    ...prefill,
    dateOfBirth: prefill.dateOfBirth || '',
    nationality: prefill.nationality || '',
    homeAddress: prefill.homeAddress || '',
    companyName: prefill.companyName || '',
  })
  const [declarations, setDeclarations] = useState([false, false, false])
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false)
  const [hasAcceptedTCs, setHasAcceptedTCs] = useState(false)
  const [sigMode, setSigMode] = useState<'type' | 'draw'>('type')
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const typedCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  // Track scroll to bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setHasScrolledToEnd(true)
    }
  }, [])


  // Draw canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = GREEN
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const touch = 'touches' in e ? e.touches[0] : e
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    isDrawing.current = true
    const pos = getCanvasPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getCanvasPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = () => { isDrawing.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Render typed name to hidden canvas
  const renderTypedSignature = (): string => {
    const canvas = typedCanvasRef.current
    if (!canvas || !typedName) return ''
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    canvas.width = 400
    canvas.height = 100
    ctx.clearRect(0, 0, 400, 100)
    ctx.fillStyle = GREEN
    ctx.font = `36px ${FONTS[selectedFont].family}`
    ctx.textBaseline = 'middle'
    ctx.fillText(typedName, 10, 50)
    return canvas.toDataURL('image/png')
  }

  const getSignatureDataUrl = (): string => {
    if (sigMode === 'type') return renderTypedSignature()
    return canvasRef.current?.toDataURL('image/png') || ''
  }

  const isCanvasBlank = (): boolean => {
    const canvas = canvasRef.current
    if (!canvas) return true
    const ctx = canvas.getContext('2d')
    if (!ctx) return true
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false
    }
    return true
  }

  const hasSignature = sigMode === 'type' ? typedName.length > 0 : !isCanvasBlank()
  const allDeclared = declarations.every(Boolean)
  const requiredFilled = form.fullName && form.email && form.mobile && form.category && form.dateOfBirth && form.homeAddress
  const canSubmit = hasScrolledToEnd && hasAcceptedTCs && allDeclared && requiredFilled && hasSignature && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fullName: form.fullName,
          email: form.email,
          mobile: form.mobile,
          profession: form.profession,
          referredBy: form.referredBy,
          category: form.category,
          dateOfBirth: form.dateOfBirth,
          nationality: form.nationality,
          homeAddress: form.homeAddress,
          companyName: form.companyName,
          signatureDataUrl: getSignatureDataUrl(),
          signatureMethod: sigMode,
          typedName: sigMode === 'type' ? typedName : null,
          declarations: declarations.map((d, i) => ({ index: i, accepted: d })),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      alert('Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  const t = (en: string, vi: string) => lang === 'en' ? en : vi

  // Success screen
  if (submitted) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script&family=Great+Vibes&family=Caveat&display=swap" rel="stylesheet" />
        <div style={{
          minHeight: '100vh', background: GREEN, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 40,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Lion.%20Drink.svg" alt="" style={{
              display: 'block', width: 200, height: 'auto', margin: '0 auto 32px',
            }} />
            <h1 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 300,
              color: CREAM, letterSpacing: '0.06em', marginBottom: 16,
            }}>
              {t('Agreement Submitted', 'Thỏa Thuận Đã Được Nộp')}
            </h1>
            <p style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 16, color: MUTED,
              lineHeight: 1.7,
            }}>
              {t(
                'Thank you. Your signed membership agreement has been received. The Committee will be in touch shortly.',
                'Cảm ơn bạn. Thỏa thuận thành viên đã ký của bạn đã được nhận. Hội đồng sẽ liên hệ với bạn trong thời gian sớm nhất.'
              )}
            </p>
          </div>
        </div>
      </>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '12px 16px',
    background: 'rgba(229,212,194,0.06)', color: CREAM,
    border: `1px solid rgba(229,212,194,0.12)`, borderRadius: 6,
    fontFamily: "'Rampant Sans', serif", fontSize: 15,
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Rampant Sans', serif", fontSize: 12,
    color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script&family=Great+Vibes&family=Caveat&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        input[type="checkbox"]:checked {
          background: #C9A84C !important;
        }
        input[type="checkbox"]:checked::after {
          content: '✓';
          color: #052E20;
          font-size: 13px;
          font-weight: bold;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
        }
      `}} />
      <div style={{ minHeight: '100vh', background: GREEN, padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Lion-Signature.svg" alt="" style={{
              display: 'block', width: 100, height: 'auto', margin: '0 auto 24px',
            }} />
            <h1 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 300,
              color: CREAM, letterSpacing: '0.08em', marginBottom: 4,
            }}>
              {t(agreementData.meta.title.en, agreementData.meta.title.vi)}
            </h1>
            <p style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 13, color: MUTED,
              letterSpacing: '0.06em',
            }}>
              {t(agreementData.meta.subtitle.en, agreementData.meta.subtitle.vi)}
            </p>
          </div>

          {/* Language toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
            {(['en', 'vi'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 13,
                letterSpacing: '0.08em', padding: '8px 20px', cursor: 'pointer',
                background: lang === l ? 'rgba(229,212,194,0.1)' : 'transparent',
                color: lang === l ? CREAM : MUTED,
                border: `1px solid rgba(229,212,194,0.12)`,
                borderRadius: l === 'en' ? '4px 0 0 4px' : '0 4px 4px 0',
                borderLeft: l === 'vi' ? 'none' : undefined,
                textTransform: 'uppercase',
              }}>
                {l === 'en' ? 'English' : 'Tiếng Việt'}
              </button>
            ))}
          </div>

          {/* Scrollable agreement */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              maxHeight: 400, overflowY: 'auto', padding: '32px 28px',
              background: 'rgba(229,212,194,0.03)', borderRadius: 8,
              border: '1px solid rgba(229,212,194,0.06)', marginBottom: 32,
            }}
          >
            {agreementData.sections.map(section => (
              <div key={section.id} style={{ marginBottom: 28 }}>
                {(lang === 'en' ? section.titleEn : section.titleVi) && (
                  <h3 style={{
                    fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
                    color: CREAM, letterSpacing: '0.04em', marginBottom: 12,
                  }}>
                    {lang === 'en' ? section.titleEn : section.titleVi}
                  </h3>
                )}
                <div style={{
                  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: MUTED,
                  lineHeight: 1.8, whiteSpace: 'pre-line',
                }}>
                  {lang === 'en' ? section.en : section.vi}
                </div>
              </div>
            ))}

            {!hasScrolledToEnd && (
              <div style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 12,
                color: GOLD, textAlign: 'center', opacity: 0.7, marginTop: 16,
              }}>
                {t('↓ Please scroll to read the full agreement', '↓ Vui lòng cuộn xuống để đọc toàn bộ thỏa thuận')}
              </div>
            )}
          </div>

          {/* Terms & Conditions */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              cursor: 'pointer', minHeight: 44,
            }}>
              <input
                type="checkbox"
                checked={hasAcceptedTCs}
                onChange={() => setHasAcceptedTCs(!hasAcceptedTCs)}
                style={{ marginTop: 4, accentColor: GOLD, width: 18, height: 18, flexShrink: 0, appearance: 'none', WebkitAppearance: 'none', background: 'rgba(45,106,79,0.25)', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 3, cursor: 'pointer', position: 'relative' } as React.CSSProperties}
              />
              <span style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 13, color: MUTED, lineHeight: 1.6,
              }}>
                {t(
                  'I have read and accept the ',
                  'Tôi đã đọc và chấp nhận '
                )}
                <a
                  href="/documents/The%20Rampant%20Club%20TC%20V5%2024.03.26.docx%20(1).pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: GOLD, textDecoration: 'underline' }}
                  onClick={e => e.stopPropagation()}
                >
                  {t('Terms and Conditions of Membership', 'Quy Chế Thành Viên')}
                </a>
              </span>
            </label>
          </div>

          {/* Declarations */}
          <div style={{ marginBottom: 36 }}>
            <h3 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
              color: CREAM, marginBottom: 16,
            }}>
              {t(agreementData.declaration.preface.en, agreementData.declaration.preface.vi)}
            </h3>
            {agreementData.declaration.items.map((item, i) => (
              <label key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14,
                cursor: 'pointer', minHeight: 44,
              }}>
                <input
                  type="checkbox"
                  checked={declarations[i]}
                  onChange={() => setDeclarations(d => d.map((v, j) => j === i ? !v : v))}
                  style={{ marginTop: 4, accentColor: GOLD, width: 18, height: 18, flexShrink: 0, appearance: 'none', WebkitAppearance: 'none', background: 'rgba(45,106,79,0.25)', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 3, cursor: 'pointer', position: 'relative' } as React.CSSProperties}
                />
                <span style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: MUTED, lineHeight: 1.7,
                }}>
                  {lang === 'en' ? item.en : item.vi}
                </span>
              </label>
            ))}
          </div>

          {/* Form fields */}
          <div style={{ marginBottom: 36 }}>
            <h3 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
              color: CREAM, marginBottom: 20,
            }}>
              {t('Your Details', 'Thông Tin Của Bạn')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{t('Full Name *', 'Họ và Tên *')}</label>
                <input style={inputStyle} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('Email *', 'Email *')}</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{t('Mobile *', 'Điện Thoại *')}</label>
                <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('Profession', 'Nghề Nghiệp')}</label>
                <input style={inputStyle} value={form.profession} onChange={e => setForm(f => ({ ...f, profession: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{t('Date of Birth *', 'Ngày Sinh *')}</label>
                <input style={inputStyle} type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('Nationality', 'Quốc Tịch')}</label>
                <input style={inputStyle} value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('Home Address *', 'Địa Chỉ Nhà *')}</label>
              <input style={inputStyle} value={form.homeAddress} onChange={e => setForm(f => ({ ...f, homeAddress: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{t('Company Name', 'Tên Công Ty')}</label>
                <input style={inputStyle} value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('Referred By', 'Người Giới Thiệu')}</label>
                <input style={inputStyle} value={form.referredBy} onChange={e => setForm(f => ({ ...f, referredBy: e.target.value }))} />
              </div>
            </div>

            {/* Category selector */}
            <div>
              <label style={labelStyle}>{t('Membership Category *', 'Loại Thành Viên *')}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {agreementData.categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                    style={{
                      flex: 1, padding: '14px 12px', cursor: 'pointer',
                      fontFamily: "'Rampant Sans', serif", fontSize: 14,
                      background: form.category === cat.id ? 'rgba(201,168,76,0.15)' : 'rgba(229,212,194,0.04)',
                      color: form.category === cat.id ? GOLD : MUTED,
                      border: `1px solid ${form.category === cat.id ? 'rgba(201,168,76,0.3)' : 'rgba(229,212,194,0.1)'}`,
                      borderRadius: 6, textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{lang === 'en' ? cat.labelEn : cat.labelVi}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{cat.price}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Signature */}
          <div style={{ marginBottom: 36 }}>
            <h3 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
              color: CREAM, marginBottom: 16,
            }}>
              {t('Signature', 'Chữ Ký')}
            </h3>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
              {(['type', 'draw'] as const).map(m => (
                <button key={m} onClick={() => setSigMode(m)} style={{
                  fontFamily: "'Rampant Sans', serif", fontSize: 13,
                  padding: '8px 20px', cursor: 'pointer', textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: sigMode === m ? 'rgba(229,212,194,0.1)' : 'transparent',
                  color: sigMode === m ? CREAM : MUTED,
                  border: '1px solid rgba(229,212,194,0.12)',
                  borderRadius: m === 'type' ? '4px 0 0 4px' : '0 4px 4px 0',
                  borderLeft: m === 'draw' ? 'none' : undefined,
                }}>
                  {m === 'type' ? t('Type Name', 'Nhập Tên') : t('Draw', 'Vẽ')}
                </button>
              ))}
            </div>

            {sigMode === 'type' ? (
              <div>
                <input
                  style={{ ...inputStyle, marginBottom: 12 }}
                  placeholder={t('Type your full name', 'Nhập họ tên đầy đủ')}
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                />
                {/* Font options */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {FONTS.map((f, i) => (
                    <button key={f.name} onClick={() => setSelectedFont(i)} style={{
                      flex: 1, padding: '10px 8px', cursor: 'pointer',
                      fontFamily: f.family, fontSize: 16, textAlign: 'center',
                      background: selectedFont === i ? 'rgba(229,212,194,0.1)' : 'transparent',
                      color: selectedFont === i ? CREAM : MUTED,
                      border: `1px solid ${selectedFont === i ? 'rgba(201,168,76,0.3)' : 'rgba(229,212,194,0.1)'}`,
                      borderRadius: 6,
                    }}>
                      {typedName || f.name}
                    </button>
                  ))}
                </div>
                {/* Live preview */}
                {typedName && (
                  <div style={{
                    padding: '20px 24px', background: 'rgba(229,212,194,0.04)',
                    borderRadius: 6, border: '1px solid rgba(229,212,194,0.06)',
                    textAlign: 'center',
                  }}>
                    <span style={{
                      fontFamily: FONTS[selectedFont].family, fontSize: 36, color: CREAM,
                    }}>
                      {typedName}
                    </span>
                  </div>
                )}
                <canvas ref={typedCanvasRef} style={{ display: 'none' }} width={400} height={100} />
              </div>
            ) : (
              <div>
                <div style={{
                  background: 'rgba(229,212,194,0.04)', borderRadius: 6,
                  border: '1px solid rgba(229,212,194,0.1)', overflow: 'hidden',
                }}>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={180}
                    style={{ width: '100%', height: 180, cursor: 'crosshair', touchAction: 'none' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <button onClick={clearCanvas} style={{
                  marginTop: 8, fontFamily: "'Rampant Sans', serif", fontSize: 12,
                  color: MUTED, background: 'none', border: 'none', cursor: 'pointer',
                  letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6,
                }}>
                  {t('Clear', 'Xóa')}
                </button>
              </div>
            )}
          </div>

          {/* Validation hints */}
          {!canSubmit && (
            <div style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 12, color: MUTED,
              opacity: 0.5, marginBottom: 16, textAlign: 'center',
            }}>
              {!hasScrolledToEnd && t('• Read the full agreement ', '• Đọc toàn bộ thỏa thuận ')}
              {!hasAcceptedTCs && t('• Accept the terms & conditions ', '• Chấp nhận điều khoản ')}
              {!allDeclared && t('• Accept all declarations ', '• Chấp nhận tất cả tuyên bố ')}
              {!requiredFilled && t('• Complete required fields ', '• Hoàn thành các trường bắt buộc ')}
              {!hasSignature && t('• Provide your signature', '• Cung cấp chữ ký của bạn')}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '16px 24px', cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: canSubmit ? GOLD : 'rgba(229,212,194,0.06)',
              color: canSubmit ? GREEN : MUTED,
              border: 'none', borderRadius: 6,
              opacity: canSubmit ? 1 : 0.4,
              transition: 'all 0.3s',
            }}
          >
            {submitting
              ? t('Submitting...', 'Đang nộp...')
              : t('Submit Agreement', 'Nộp Thỏa Thuận')}
          </button>

          {/* Contact info */}
          <div style={{
            textAlign: 'center', marginTop: 48,
            fontFamily: "'Rampant Sans', serif", fontSize: 12, color: MUTED, opacity: 0.4,
            lineHeight: 1.8,
          }}>
            {agreementData.contact.address}<br />
            {agreementData.contact.email}<br />
            {t(agreementData.contact.note.en, agreementData.contact.note.vi)}
          </div>
        </div>
      </div>
    </>
  )
}
