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
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {loading ? (
        <div className="pf-skel">
          <SkeletonLines lines={4} />
          <div style={{ height: 12 }} />
          <SkeletonLines lines={3} />
        </div>
      ) : (
        <div className="pf-grid">
          {/* ══ THE RECORD — what the Club holds, read-only ═══════════════ */}
          <div className="pf-record">
            {profile?.member_no ? (
              <div className="pf-no">
                {t('No.', 'Số')} {profile.member_no.replace(/^TRC-M/i, '')}
              </div>
            ) : (
              <p className="pf-quiet">
                {t('Your membership number will be assigned by the Committee.', 'Số thành viên của bạn sẽ do Hội đồng cấp.')}
              </p>
            )}

            <dl className="pf-rows">
              {readOnlyFields.map(f => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            {/* Membership & Receipts */}
            {membership && (membership.status || membership.payments.length > 0) && (
              <div className="pf-section">
                <h2 className="pf-h2">
                  {t('Membership & Receipts', 'Tư cách thành viên & Biên nhận')}
                </h2>

                {membership.status && (() => {
                  const badge = membershipBadge(membership.status, t)
                  return (
                    <div className="pf-status">
                      <div className="pf-badge">
                        <span className="pf-dot" style={{ background: badge.color }} />
                        <span>{badge.label}</span>
                      </div>
                      <div className="pf-paid">
                        <div className="pf-label">{t('Paid through', 'Đã thanh toán đến')}</div>
                        <div className="pf-paid-d">{formatDate(membership.status.paid_through, lang)}</div>
                      </div>
                    </div>
                  )
                })()}

                {membership.payments.length > 0 && (
                  <div className="pf-receipts">
                    <div className="pf-label">{t('Receipts', 'Biên nhận')}</div>
                    {membership.payments.map(p => (
                      <div key={p.id} className="pf-receipt">
                        <div style={{ minWidth: 0 }}>
                          <div className="pf-amt">{fmtVnd(p.amount_vnd)}</div>
                          <div className="pf-meta">
                            {FEE_LABEL[p.fee_kind] ? t(FEE_LABEL[p.fee_kind].en, FEE_LABEL[p.fee_kind].vn) : p.fee_kind} · {formatDate(p.payment_date, lang)} · {p.receipt_no}
                          </div>
                        </div>
                        {p.receipt_available ? (
                          <a href={`/api/members/receipts/${p.id}`} target="_blank" rel="noreferrer" className="pf-pdf">
                            {t('Download PDF', 'Tải PDF')}
                          </a>
                        ) : (
                          <span className="pf-preparing">{t('Preparing…', 'Đang chuẩn bị…')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ WHAT YOU TELL US — the parts you can change ═══════════════ */}
          <div className="pf-form">
            <div className="pf-field">
              <label className="pf-label">{t('Display Name', 'Tên hiển thị')}</label>
              <input className="pf-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="pf-field">
              <label className="pf-label">{t('Preferred Dram', 'Ly whisky ưa thích')}</label>
              <input className="pf-input" value={preferredDram} onChange={e => setPreferredDram(e.target.value)} />
            </div>

            <h2 className="pf-h2 pf-prefs">
              {t('Preferences', 'Tuỳ chọn cá nhân')}
            </h2>

            <div className="pf-field">
              <label className="pf-label">{t('Dietary Requirements', 'Chế độ ăn uống')}</label>
              <input
                className="pf-input"
                placeholder={t('e.g. Vegetarian, Pescatarian, Halal', 'VD: Ăn chay, Ăn cá, Halal')}
                value={prefs.dietary || ''}
                onChange={e => setPrefs(p => ({ ...p, dietary: e.target.value }))}
              />
            </div>

            <div className="pf-field">
              <label className="pf-label">{t('Allergies', 'Dị ứng')}</label>
              <input
                className="pf-input"
                placeholder={t('e.g. Shellfish, nuts', 'VD: Hải sản có vỏ, các loại hạt')}
                value={prefs.allergies || ''}
                onChange={e => setPrefs(p => ({ ...p, allergies: e.target.value }))}
              />
            </div>

            <div className="pf-field">
              <label className="pf-label">{t('Drink Preferences (beyond whisky)', 'Đồ uống ưa thích (ngoài whisky)')}</label>
              <input
                className="pf-input"
                placeholder={t('e.g. Negronis, natural wine, no beer', 'VD: Negroni, vang tự nhiên, không bia')}
                value={prefs.drink_preferences || ''}
                onChange={e => setPrefs(p => ({ ...p, drink_preferences: e.target.value }))}
              />
            </div>

            <div className="pf-field">
              <label className="pf-label">{t('Preferred Contact Method', 'Cách liên hệ ưa thích')}</label>
              <div className="pf-opts">
                {['Email', 'Zalo', 'WhatsApp', 'Phone'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPrefs(p => ({ ...p, contact_method: m }))}
                    className={`pf-opt ${prefs.contact_method === m ? 'is-on' : ''}`}
                    aria-pressed={prefs.contact_method === m}
                  >
                    {t(m, CONTACT_VN[m])}
                  </button>
                ))}
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label">{t('Interests', 'Sở thích')}</label>
              <div className="pf-opts">
                {INTERESTS.map(i => (
                  <button
                    key={i}
                    onClick={() => toggleInterest(i)}
                    className={`pf-opt ${(prefs.interests || []).includes(i) ? 'is-on' : ''}`}
                    aria-pressed={(prefs.interests || []).includes(i)}
                  >
                    {t(i, INTEREST_VN[i])}
                  </button>
                ))}
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label">{t('Preferred Seating', 'Chỗ ngồi ưa thích')}</label>
              <input
                className="pf-input"
                placeholder={t('e.g. Rooftop, Library Bar corner, Rampant Room', 'VD: Sân thượng, góc Library Bar, Rampant Room')}
                value={prefs.seating || ''}
                onChange={e => setPrefs(p => ({ ...p, seating: e.target.value }))}
              />
            </div>

            {/* Save */}
            <div className="pf-save">
              <button onClick={handleSave} disabled={saving} className="pk-cta pf-cta">
                {saving ? t('Saving…', 'Đang lưu…') : <>{t('Save', 'Lưu')} <span className="pk-go">→</span></>}
              </button>
              {saved && <span className="pf-saved">{t('Saved', 'Đã lưu')}</span>}
              {saveErr && <span className="pf-err">{saveErr}</span>}
            </div>
          </div>
        </div>
      )}
    </MemberPage>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const LINE = 'rgba(229,212,194,.18)'

const CSS = `
  .pf-skel { max-width: 420px; display: flex; flex-direction: column; gap: 16px; }
  .pf-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 96px; align-items: start; }

  .pf-no { font-family: ${SERIF}; font-size: clamp(72px, 9vw, 132px); line-height: .88; color: #D4B85A; margin: 0 0 40px; }
  .pf-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .82; max-width: 460px; margin: 0 0 36px; }

  .pf-rows { margin: 0; }
  .pf-rows > div { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 16px; align-items: baseline;
                   padding: 15px 0; border-top: 1px solid ${LINE}; }
  .pf-rows > div:last-child { border-bottom: 1px solid ${LINE}; }
  .pf-rows dt { font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #E5D4C2; opacity: .7; }
  .pf-rows dd { margin: 0; font-family: ${MONO}; font-size: 14px; line-height: 1.6; color: #E5D4C2; overflow-wrap: anywhere; }

  .pf-section { margin-top: 64px; }
  .pf-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 3.4vw, 44px); line-height: 1; color: #E5D4C2; margin: 0 0 24px; }
  .pf-label { display: block; font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #E5D4C2; opacity: .72; }

  .pf-status { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap;
               padding: 18px 0; border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE}; }
  .pf-badge { display: flex; align-items: center; gap: 12px; font-family: ${SERIF}; font-size: 26px; line-height: 1; color: #E5D4C2; }
  .pf-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
  .pf-paid { text-align: right; }
  .pf-paid-d { font-family: ${MONO}; font-size: 14px; color: #E5D4C2; margin-top: 6px; }

  .pf-receipts { margin-top: 36px; }
  .pf-receipts > .pf-label { margin-bottom: 8px; }
  .pf-receipt { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 0; border-top: 1px solid ${LINE}; }
  .pf-receipt:last-child { border-bottom: 1px solid ${LINE}; }
  .pf-amt { font-family: ${SERIF}; font-size: 26px; line-height: 1.05; color: #E5D4C2; }
  .pf-meta { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #E5D4C2; opacity: .75; margin-top: 4px; }
  .pf-pdf { flex: 0 0 auto; white-space: nowrap; color: #D4B85A; text-decoration: none; padding-bottom: 5px; border-bottom: 1px solid #D4B85A;
            font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .pf-preparing { flex: 0 0 auto; font-family: ${MONO}; font-size: 12px; color: #E5D4C2; opacity: .65; }

  .pf-field { margin-bottom: 30px; }
  .pf-input { display: block; width: 100%; box-sizing: border-box; background: transparent; color: #E5D4C2;
              border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0 11px;
              font-family: ${MONO}; font-size: 14px; letter-spacing: .01em; outline: none; transition: border-color .25s ease; }
  .pf-input::placeholder { color: rgba(229,212,194,.5); }
  .pf-input:focus { border-bottom-color: #D4B85A; }
  /* beats the portal's keyboard ring (layout: [class*=member] textarea:focus-visible) — the gold underline is the focus mark */
  .pf-input.pf-input:focus-visible { outline: none; border-radius: 0; }
  .pf-prefs { margin-top: 64px; margin-bottom: 30px; }

  .pf-opts { display: flex; flex-wrap: wrap; gap: 10px 24px; margin-top: 14px; }
  .pf-opt { background: none; border: none; border-bottom: 1px solid rgba(229,212,194,.22); border-radius: 0; padding: 0 0 5px; cursor: pointer;
            font-family: ${MONO}; font-size: 13px; letter-spacing: .02em; color: #E5D4C2; opacity: .72;
            transition: opacity .2s ease, color .2s ease, border-color .2s ease; }
  .pf-opt:hover { opacity: 1; }
  .pf-opt.is-on { color: #D4B85A; opacity: 1; border-bottom-color: #D4B85A; }

  .pf-save { display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap; margin-top: 12px; }
  .pk-cta.pf-cta { margin-top: 0; color: #D4B85A; }
  .pk-cta.pf-cta:disabled { opacity: .5; cursor: default; }
  .pf-saved { font-family: ${MONO}; font-size: 12.5px; color: #D4B85A; }
  .pf-err { font-family: ${MONO}; font-size: 12.5px; color: #E89B9B; }

  @media (max-width: 960px) {
    .pf-grid { grid-template-columns: minmax(0, 1fr); gap: 72px; }
  }
  @media (max-width: 760px) {
    .pf-rows > div { grid-template-columns: 112px minmax(0, 1fr); }
    .pf-input { font-size: 16px; }
    .pf-status { align-items: flex-start; }
    .pf-paid { text-align: left; }
  }
`
