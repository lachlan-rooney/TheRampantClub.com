'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Profile } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import { SkeletonLines } from '@/components/members/Skeleton'
import { useLang, type Lang } from '@/lib/lang'

function formatDate(d: string | null, lang: Lang = 'en'): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 6,
  padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', display: 'block', marginBottom: 4,
}

const INTERESTS = ['Golf', 'Tennis', 'Padel', 'Running', 'Whisky Tastings', 'Private Dinners', 'Art & Exhibitions', 'Cigar Evenings']
// Display only — the English value above is what is stored in preferences.
const INTEREST_VN: Record<string, string> = {
  Golf: 'Golf', Tennis: 'Quần vợt', Padel: 'Padel', Running: 'Chạy bộ',
  'Whisky Tastings': 'Thưởng thức Whisky', 'Private Dinners': 'Tiệc tối riêng',
  'Art & Exhibitions': 'Nghệ thuật & Triển lãm', 'Cigar Evenings': 'Đêm xì gà',
}
// Display only — contact_method stores the English value.
const CONTACT_VN: Record<string, string> = { Email: 'Email', Zalo: 'Zalo', WhatsApp: 'WhatsApp', Phone: 'Điện thoại' }

interface Preferences {
  dietary?: string
  allergies?: string
  drink_preferences?: string
  contact_method?: string
  interests?: string[]
  seating?: string
}

interface MembershipPayment {
  id: string
  receipt_no: string
  amount_vnd: number
  payment_date: string
  fee_kind: string
  receipt_available: boolean
}
interface MembershipData {
  status: { paid_through: string; is_current: boolean; in_grace: boolean; is_expired: boolean } | null
  payments: MembershipPayment[]
}

const fmtVnd = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' ₫'
const FEE_LABEL: Record<string, { en: string; vn: string }> = {
  membership_fee: { en: 'Annual Membership Fee', vn: 'Phí thành viên thường niên' },
  renewal: { en: 'Renewal', vn: 'Gia hạn' },
  joining_fee: { en: 'Joining Fee', vn: 'Phí gia nhập' },
  proration: { en: 'Pro-rata', vn: 'Tính theo tỷ lệ' },
  adjustment: { en: 'Adjustment', vn: 'Điều chỉnh' },
}
function membershipBadge(s: MembershipData['status'], t: (en: string, vn: string) => string): { label: string; color: string } {
  if (!s) return { label: t('No membership on file', 'Chưa có hồ sơ thành viên'), color: '#B2AA98' }
  if (s.is_current) return { label: t('Active', 'Đang hoạt động'), color: '#7AB07A' }
  if (s.in_grace) return { label: t('Renewal due', 'Đến hạn gia hạn'), color: '#C49555' }
  if (s.is_expired) return { label: t('Lapsed', 'Đã hết hạn'), color: '#B45656' }
  return { label: t('Active', 'Đang hoạt động'), color: '#7AB07A' }
}

export default function ProfilePage() {
  const { t, lang } = useLang()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [preferredDram, setPreferredDram] = useState('')
  const [prefs, setPrefs] = useState<Preferences>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipData | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email || '')
      supabase.from('profiles').select('*').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (p) {
            setProfile(p)
            setDisplayName(p.display_name || '')
            setPreferredDram(p.preferred_dram || '')
            setPrefs((p as Record<string, unknown>).preferences as Preferences || {})
          }
          setLoading(false)
        })
    })
  }, [])

  useEffect(() => {
    fetch('/api/members/membership', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMembership(d) })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!profile || saving) return
    setSaving(true); setSaveErr('')
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.from('profiles').update({
      display_name: displayName || null,
      preferred_dram: preferredDram || null,
      preferences: prefs,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) { setSaveErr(t("Couldn't save — please try again.", 'Chưa lưu được — vui lòng thử lại.')); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleInterest = (interest: string) => {
    setPrefs(prev => {
      const current = prev.interests || []
      const next = current.includes(interest)
        ? current.filter(i => i !== interest)
        : [...current, interest]
      return { ...prev, interests: next }
    })
  }

  const readOnlyFields = [
    { label: t('Email', 'Email'), value: email },
    { label: t('Member Number', 'Số thành viên'), value: profile?.member_no ? `${t('No.', 'Số')} ${profile.member_no.replace(/^TRC-M/i, '')}` : '—' },
    { label: t('Admitted', 'Ngày kết nạp'), value: formatDate(profile?.admitted_at || null, lang) },
    { label: t('Locker', 'Tủ khoá'), value: profile?.locker_number || '—' },
  ]

  return (
    <MemberPage title="My Membership" subtitle="Tư Cách Thành Viên">
      {loading ? (
        <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkeletonLines lines={4} />
          <div style={{ height: 12 }} />
          <SkeletonLines lines={3} />
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {profile?.member_no ? (
              <div style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 48, fontWeight: 500,
                color: '#E5D4C2', marginBottom: 8,
              }}>
                {t('No.', 'Số')} {profile.member_no.replace(/^TRC-M/i, '')}
              </div>
            ) : (
              <p style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                fontStyle: 'italic', color: '#B2AA98',
              }}>
                {t('Your membership number will be assigned by the Committee.', 'Số thành viên của bạn sẽ do Hội đồng cấp.')}
              </p>
            )}
          </div>

          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            {readOnlyFields.map(f => (
              <div key={f.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '10px 0', borderBottom: '1px solid rgba(229,212,194,0.1)',
              }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>{f.label}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#E5D4C2', textAlign: 'right' }}>
                  {f.value}
                </span>
              </div>
            ))}

            {/* Membership & Receipts */}
            {membership && (membership.status || membership.payments.length > 0) && (
              <div style={{ marginTop: 36 }}>
                <h3 style={{
                  fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
                  color: '#E5D4C2', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 20,
                }}>
                  {t('Membership & Receipts', 'Tư cách thành viên & Biên nhận')}
                </h3>

                {membership.status && (() => {
                  const badge = membershipBadge(membership.status, t)
                  return (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 16px', marginBottom: 16, borderRadius: 8,
                      background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.1)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: badge.color, display: 'inline-block' }} />
                        <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#E5D4C2' }}>{badge.label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ ...labelStyle, marginBottom: 2 }}>{t('Paid through', 'Đã thanh toán đến')}</div>
                        <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#E5D4C2' }}>
                          {formatDate(membership.status.paid_through, lang)}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {membership.payments.length > 0 && (
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 8 }}>{t('Receipts', 'Biên nhận')}</div>
                    {membership.payments.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                        padding: '10px 0', borderBottom: '1px solid rgba(229,212,194,0.08)',
                      }}>
                        <div>
                          <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#E5D4C2' }}>
                            {fmtVnd(p.amount_vnd)}
                          </div>
                          <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                            {FEE_LABEL[p.fee_kind] ? t(FEE_LABEL[p.fee_kind].en, FEE_LABEL[p.fee_kind].vn) : p.fee_kind} · {formatDate(p.payment_date, lang)} · {p.receipt_no}
                          </div>
                        </div>
                        {p.receipt_available ? (
                          <a
                            href={`/api/members/receipts/${p.id}`} target="_blank" rel="noreferrer"
                            style={{
                              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                              color: '#D4B85A', textDecoration: 'none', border: '1px solid rgba(212,184,90,0.35)',
                              borderRadius: 6, padding: '6px 14px', whiteSpace: 'nowrap',
                            }}
                          >
                            {t('Download PDF', 'Tải PDF')}
                          </a>
                        ) : (
                          <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#7E7864' }}>{t('Preparing…', 'Đang chuẩn bị…')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Editable details */}
            <div style={{ marginTop: 32 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('Display Name', 'Tên hiển thị')}</label>
                <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('Preferred Dram', 'Ly whisky ưa thích')}</label>
                <input style={inputStyle} value={preferredDram} onChange={e => setPreferredDram(e.target.value)} />
              </div>
            </div>

            {/* Preferences */}
            <div style={{
              width: 8, height: 8, background: '#E5D4C2',
              transform: 'rotate(45deg)', opacity: 0.15, margin: '36px auto',
            }} />

            <h3 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
              color: '#E5D4C2', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 24,
            }}>
              {t('Preferences', 'Tuỳ chọn cá nhân')}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('Dietary Requirements', 'Chế độ ăn uống')}</label>
              <input
                style={inputStyle}
                placeholder={t('e.g. Vegetarian, Pescatarian, Halal', 'VD: Ăn chay, Ăn cá, Halal')}
                value={prefs.dietary || ''}
                onChange={e => setPrefs(p => ({ ...p, dietary: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('Allergies', 'Dị ứng')}</label>
              <input
                style={inputStyle}
                placeholder={t('e.g. Shellfish, nuts', 'VD: Hải sản có vỏ, các loại hạt')}
                value={prefs.allergies || ''}
                onChange={e => setPrefs(p => ({ ...p, allergies: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('Drink Preferences (beyond whisky)', 'Đồ uống ưa thích (ngoài whisky)')}</label>
              <input
                style={inputStyle}
                placeholder={t('e.g. Negronis, natural wine, no beer', 'VD: Negroni, vang tự nhiên, không bia')}
                value={prefs.drink_preferences || ''}
                onChange={e => setPrefs(p => ({ ...p, drink_preferences: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('Preferred Contact Method', 'Cách liên hệ ưa thích')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Email', 'Zalo', 'WhatsApp', 'Phone'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPrefs(p => ({ ...p, contact_method: m }))}
                    style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                      border: prefs.contact_method === m ? 'none' : '1px solid rgba(229,212,194,0.15)',
                      background: prefs.contact_method === m ? 'rgba(229,212,194,0.12)' : 'transparent',
                      color: prefs.contact_method === m ? '#E5D4C2' : '#B2AA98',
                    }}
                  >
                    {t(m, CONTACT_VN[m])}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('Interests', 'Sở thích')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {INTERESTS.map(i => (
                  <button
                    key={i}
                    onClick={() => toggleInterest(i)}
                    style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                      border: (prefs.interests || []).includes(i) ? 'none' : '1px solid rgba(229,212,194,0.15)',
                      background: (prefs.interests || []).includes(i) ? 'rgba(229,212,194,0.12)' : 'transparent',
                      color: (prefs.interests || []).includes(i) ? '#E5D4C2' : '#B2AA98',
                    }}
                  >
                    {t(i, INTEREST_VN[i])}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>{t('Preferred Seating', 'Chỗ ngồi ưa thích')}</label>
              <input
                style={inputStyle}
                placeholder={t('e.g. Rooftop, Library Bar corner, Rampant Room', 'VD: Sân thượng, góc Library Bar, Rampant Room')}
                value={prefs.seating || ''}
                onChange={e => setPrefs(p => ({ ...p, seating: e.target.value }))}
              />
            </div>

            {/* Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none', borderRadius: 6,
                  padding: '10px 24px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {saving ? t('Saving…', 'Đang lưu…') : t('Save', 'Lưu')}
              </button>
              {saved && (
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#7AB07A' }}>
                  {t('Saved', 'Đã lưu')}
                </span>
              )}
              {saveErr && (
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#C27070' }}>
                  {saveErr}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </MemberPage>
  )
}
