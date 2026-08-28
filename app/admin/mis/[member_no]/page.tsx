'use client'

import { use, useEffect, useState, useMemo, useCallback } from 'react'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FormulaExplainer from '../FormulaExplainer'
import VisitsPanel from '../VisitsPanel'
import SuggestAPour from '@/components/whisky/SuggestAPour'
import GiftingPanel from '../GiftingPanel'
import ActivityTimeline from '../ActivityTimeline'
import MemberLoginPanel from '@/components/admin/MemberLoginPanel'
import { useLang } from '@/lib/admin-lang'

interface Member {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  join_date: string | null
  birthday: string | null
  email: string | null
  phone: string | null
  referred_by: string | null
}

interface Preference {
  preference_id: string
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  last_validated: string
  validation_count: number
  days_since: number
  ps_t: number
  score_health_pct: number
  needs_revalidation: string
  source: string | null
  contradiction: boolean
  logged_by: string | null
  created_date: string | null
  status?: string | null
}

interface EditDraft {
  s0: number
  confidence: number
  lambda: number
  frequency: number
  status: string
  notes: string
}

const ALLOWED_C = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_L = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_F = [0.8, 1.0, 1.2, 1.5]
const ALLOWED_STATUS = ['active', 'invalidated', 'archived']

// Plain-English explanations shown in hover tooltips next to each control.
// Kept short so the popover stays compact; the full doc lives in the
// FormulaExplainer at the top of the page.
const TIPS = {
  s0:        'How much this preference matters. 5 = absolute (allergy / identity), 1 = barely an opinion. Raising it amplifies PS(t) proportionally; the cap at 5 limits how high any score can go.',
  confidence:'How certain we are the preference is real. 1.00 = stated explicitly. 0.75 = pattern seen repeatedly. 0.25 = inferred from one instance. Acts as a multiplier — drags PS(t) down when low.',
  lambda:    'How quickly the preference goes stale. 0 = never decays (medical, identity). 0.020 = halves every ~35 days. Doesn’t affect today’s score; only matters as time passes since last validation.',
  frequency: 'How often the preference comes into play in practice. 1.0 = monthly default. 1.5 = daily / every visit, amplifies. 0.8 = rare, tones down.',
  status:    'Active = appears in live PS(t) view. Invalidated = hidden from live view but kept for audit history. Archived = soft-deleted.',
} as const

// Predict the PS(t) the row will have right after a save.
// At save time:  t = 0 (last_validated refreshes), vc → vc+1, M = 1.0 while visits is empty.
function predictPs(draft: EditDraft, currentValidationCount: number): { ps: number; health: number } {
  if (draft.status !== 'active') return { ps: 0, health: 0 }
  const newVc = currentValidationCount + 1
  const r = Math.min(1.3, 1.0 + 0.075 * (newVc - 1))
  const m = 1.0  // visits is empty for now; will reflect real M once Pass 2 Harmony Log lands
  const raw = draft.s0 * draft.confidence * draft.frequency * r * m
  const ps = Math.min(5, raw)
  const health = Math.round((ps / Math.max(draft.s0, 1)) * 100)
  return { ps, health }
}

const CATEGORIES = [
  'All categories',
  'Personal & Lifestyle',
  'Food & Beverage',
  'Whisky & Beverage',
  'Social & Networking',
  'Business & Productivity',
  'Wellness & Comfort',
  'Cultural & Intellectual',
  'Family & Personal',
  'Travel & Global',
]

function InfoDot({ tip }: { tip: string }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        role="button"
        aria-label={t('More info', 'Thêm thông tin')}
        style={infoDotStyle}
      >
        i
      </span>
      {open && <span style={tooltipStyle}>{tip}</span>}
    </span>
  )
}

export default function MisMemberProfile({ params }: { params: Promise<{ member_no: string }> }) {
  const { t } = useLang()
  const { member_no } = use(params)
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All categories')
  const [revalOnly, setRevalOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [startingVisit, setStartingVisit] = useState(false)
  const [tierSaving, setTierSaving] = useState(false)
  const { showToast, toastNode } = useToast()
  // Confirm modal — invalidate a preference.
  const [confirmInvalidate, setConfirmInvalidate] = useState<Preference | null>(null)

  // Correct the member record after conversion — tier, status (e.g. flip a
  // Provisional allocation to Active), and join date. Optimistic + reverts.
  const patchMember = useCallback(async (fields: Record<string, unknown>, label: string) => {
    if (!member || tierSaving) return
    const prev = { tier: member.tier, status: member.status, join_date: member.join_date }
    setTierSaving(true)
    setMember(m => m ? { ...m, ...fields } as typeof m : m)
    try {
      const r = await fetch(`/api/admin/mis/members/${member_no}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'failed') }
      showToast(label, 'success')
    } catch {
      setMember(m => m ? { ...m, ...prev } as typeof m : m)
      showToast(t('Could not save.', 'Không thể lưu.'), 'error')
    } finally { setTierSaving(false) }
  }, [member, member_no, tierSaving, showToast, t])
  const changeTier = (tier: string) => { if (member && tier !== member.tier) patchMember({ tier }, `${t('Tier changed to', 'Đổi hạng thành')} ${tier}`) }
  const changeStatus = (status: string) => {
    if (!member || status === member.status) return
    // Activating with no join date on file → stamp today (VN).
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    const extra = status === 'Active' && !member.join_date ? { join_date: today } : {}
    patchMember({ status, ...extra }, `${t('Status changed to', 'Đổi trạng thái thành')} ${status}`)
  }
  const changeJoin = (join_date: string) => { patchMember({ join_date: join_date || null }, t('Join date updated.', 'Đã cập nhật ngày gia nhập.')) }

  const startVisit = useCallback(async () => {
    if (startingVisit) return
    setStartingVisit(true)
    try {
      const r = await fetch('/api/admin/mis/visits/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Could not start visit', 'Không thể bắt đầu lượt ghé thăm'))
      router.push(`/admin/mis/visits/${j.visit.visit_id}`)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setStartingVisit(false)
    }
  }, [member_no, router, startingVisit])

  const draftFor = (p: Preference): EditDraft => drafts[p.preference_id] || {
    s0: p.s0, confidence: p.confidence, lambda: p.lambda, frequency: p.frequency,
    status: p.status || 'active', notes: '',
  }
  const setDraft = (preference_id: string, patch: Partial<EditDraft>) => {
    setDrafts(prev => ({ ...prev, [preference_id]: { ...draftFor(preferences.find(x => x.preference_id === preference_id)!), ...prev[preference_id], ...patch } }))
  }
  const isDirty = (p: Preference) => {
    const d = drafts[p.preference_id]
    if (!d) return false
    return d.s0 !== p.s0 || d.confidence !== p.confidence || d.lambda !== p.lambda || d.frequency !== p.frequency || d.status !== (p.status || 'active')
  }

  const submit = async (p: Preference, eventType: 'confirmed' | 'revised' | 'invalidated') => {
    const d = draftFor(p)
    setSaving(p.preference_id)
    setErrors(e => ({ ...e, [p.preference_id]: '' }))
    const body: Record<string, unknown> = {
      preference_id: p.preference_id,
      event_type: eventType,
      notes: d.notes || null,
    }
    if (eventType === 'revised') {
      body.s0 = d.s0
      body.confidence = d.confidence
      body.lambda = d.lambda
      body.frequency = d.frequency
      body.status = d.status
    } else if (eventType === 'invalidated') {
      body.status = 'invalidated'
    }
    try {
      const r = await fetch('/api/admin/mis/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Save failed', 'Lưu thất bại'))
      // Merge the refreshed preference back into state
      if (j.preference) {
        setPreferences(prev => prev.map(x => x.preference_id === p.preference_id ? { ...x, ...j.preference } : x))
      }
      // Clear the draft + notes after a successful save
      setDrafts(prev => { const n = { ...prev }; delete n[p.preference_id]; return n })
    } catch (e) {
      setErrors(prev => ({ ...prev, [p.preference_id]: (e as Error).message }))
    } finally {
      setSaving(null)
    }
  }

  const loadPreferences = useCallback(() => {
    fetch(`/api/admin/mis/preferences?member_no=${encodeURIComponent(member_no)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.member) setMember(d.member)
        if (d.preferences) setPreferences(d.preferences)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [member_no])

  useEffect(() => { loadPreferences() }, [loadPreferences])

  const score5s = useMemo(() => preferences.filter(p => p.s0 === 5), [preferences])

  const filtered = useMemo(() => {
    return preferences.filter(p => {
      if (category !== 'All categories' && p.category !== category) return false
      if (revalOnly && !p.needs_revalidation.includes('REVALIDATE')) return false
      return true
    })
  }, [preferences, category, revalOnly])

  if (loading) return <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
  if (!member) return <div style={emptyText}>{t('Member not found.', 'Không tìm thấy hội viên.')}</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <Link href="/admin/mis" style={{ ...backLink, marginBottom: 0 }}>← {t('Back to members', 'Quay lại danh sách hội viên')}</Link>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={startVisit}
            disabled={startingVisit}
            style={{
              background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
              border: '1px solid rgba(122,176,122,0.40)', borderRadius: 6,
              padding: '8px 14px', fontFamily: "'Google Sans Code', monospace",
              fontSize: 11, letterSpacing: '0.08em', cursor: startingVisit ? 'wait' : 'pointer',
              opacity: startingVisit ? 0.6 : 1,
            }}
          >
            {startingVisit ? t('Starting…', 'Đang bắt đầu…') : `◉ ${t("Start tonight's visit", 'Bắt đầu lượt ghé thăm tối nay')} →`}
          </button>
          <Link href={`/admin/mis/${member.member_no}/intake`} style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A', textDecoration: 'none', letterSpacing: '0.06em', borderBottom: '1px solid rgba(212,184,90,0.35)' }}>
            ◆ {t('Process interview transcript', 'Xử lý biên bản phỏng vấn')} →
          </Link>
        </div>
      </div>

      <div style={profileHeader}>
        <div>
          <div style={memberNoBadge}>{member.member_no}</div>
          <h1 style={pageTitle}>{member.full_name}</h1>
          {member.nickname && <div style={nicknameText}>“{member.nickname}”</div>}
        </div>
        <div style={metaPanel}>
          <div style={metaItem}><span style={metaLabel}>{t('Tier', 'Hạng')}</span>
            <select value={member.tier} onChange={e => changeTier(e.target.value)} disabled={tierSaving}
              style={{ ...metaValue, background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', outline: 'none' }}>
              {!['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary'].includes(member.tier) && <option value={member.tier}>{member.tier}</option>}
              {['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary'].map(tr => <option key={tr} value={tr}>{tr}</option>)}
            </select>
          </div>
          <div style={metaItem}><span style={metaLabel}>{t('Status', 'Trạng thái')}</span>
            <select value={member.status} onChange={e => changeStatus(e.target.value)} disabled={tierSaving}
              style={{ ...metaValue, background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', outline: 'none' }}>
              {!['Active', 'Provisional', 'Lapsed', 'Pending Signature'].includes(member.status) && <option value={member.status}>{member.status}</option>}
              {['Active', 'Provisional', 'Lapsed', 'Pending Signature'].map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div style={metaItem}><span style={metaLabel}>{t('Joined', 'Ngày gia nhập')}</span>
            <input type="date" value={member.join_date || ''} onChange={e => changeJoin(e.target.value)} disabled={tierSaving}
              style={{ ...metaValue, background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 5, padding: '2px 7px', outline: 'none' }} />
          </div>
          {member.birthday && <div style={metaItem}><span style={metaLabel}>{t('Birthday', 'Sinh nhật')}</span><span style={metaValue}>{fmtDate(member.birthday)}</span></div>}
          {member.referred_by && <div style={metaItem}><span style={metaLabel}>{t('Referred by', 'Người giới thiệu')}</span><span style={metaValue}>{member.referred_by}</span></div>}
        </div>
      </div>

      {score5s.length > 0 && (
        <div style={score5Panel}>
          <div style={panelLabel}>{t('The non-negotiables', 'Những điều bất di bất dịch')} · S₀ = 5</div>
          <div style={score5Grid}>
            {score5s.map(p => (
              <div key={p.preference_id} style={score5Card}>
                <div style={score5Category}>{p.category}</div>
                <div style={score5Name}>{p.preference_name}</div>
                {p.detail && <div style={score5Detail}>{p.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <MemberLoginPanel memberNo={member.member_no} defaultEmail={member.email} />

      <VisitsPanel memberNo={member.member_no} onAfterChange={loadPreferences} />

      <SuggestAPour memberNo={member.member_no} />

      <GiftingPanel memberNo={member.member_no} memberName={member.full_name} />

      <ActivityTimeline memberNo={member.member_no} />

      <FormulaExplainer variant="full" />

      <div style={filterRow}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setRevalOnly(v => !v)}
          style={{ ...inputStyle, cursor: 'pointer', background: revalOnly ? 'rgba(212,184,90,0.18)' : 'rgba(229,212,194,0.06)' }}
        >
          {revalOnly ? `✓ ${t('Needs revalidation only', 'Chỉ mục cần xác thực lại')}` : t('Filter: needs revalidation', 'Lọc: cần xác thực lại')}
        </button>
        <div style={{ marginLeft: 'auto', alignSelf: 'center', fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.7 }}>
          {filtered.length} {t('of', 'trên')} {preferences.length}
        </div>
      </div>

      <div>
        <div style={prefListHeader}>
          <span style={{ ...prefColCategory, color: '#B2AA98' }}>{t('Category', 'Danh mục')}</span>
          <span style={{ ...prefColName, color: '#B2AA98' }}>{t('Preference', 'Sở thích')}</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>S₀</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>C</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>λ</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>F</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>{t('Days', 'Ngày')}</span>
          <span style={{ ...prefColScoreWide, color: '#B2AA98' }}>PS(t)</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>{t('Health', 'Độ khỏe')}</span>
          <span style={{ ...prefColFlag, color: '#B2AA98' }}>{t('Flag', 'Cờ')}</span>
        </div>

        {filtered.length === 0 ? (
          <div style={emptyText}>{t('No preferences match.', 'Không có sở thích nào phù hợp.')}</div>
        ) : filtered.map(p => {
          const expanded = expandedId === p.preference_id
          const flag = p.needs_revalidation.includes('REVALIDATE')
          return (
            <div key={p.preference_id} style={{ borderBottom: '1px solid rgba(229,212,194,0.08)' }}>
              <div onClick={() => setExpandedId(expanded ? null : p.preference_id)} style={{ ...prefRow, cursor: 'pointer' }}>
                <span style={prefColCategory}>{p.category}</span>
                <span style={prefColName}>
                  <div style={{ color: '#E5D4C2', fontFamily: "'Rampant Sans', serif", fontSize: 14 }}>{p.preference_name}</div>
                  {p.subcategory && <div style={{ color: '#B2AA98', fontFamily: "'Google Sans Code', monospace", fontSize: 10, opacity: 0.7, marginTop: 2 }}>{p.subcategory}</div>}
                </span>
                <span style={{ ...prefColScore, color: p.s0 === 5 ? '#D4B85A' : '#E5D4C2' }}>{p.s0}</span>
                <span style={prefColScore}>{p.confidence.toFixed(2)}</span>
                <span style={prefColScore}>{p.lambda.toFixed(3)}</span>
                <span style={prefColScore}>{p.frequency.toFixed(1)}</span>
                <span style={prefColScore}>{p.days_since}</span>
                <span style={{ ...prefColScoreWide, color: '#E5D4C2', fontWeight: 600 }}>{Number(p.ps_t).toFixed(2)}</span>
                <span style={{ ...prefColScore, color: p.score_health_pct >= 100 ? '#D4B85A' : p.score_health_pct >= 70 ? '#E5D4C2' : '#C27070' }}>
                  {p.score_health_pct}%
                </span>
                <span style={{ ...prefColFlag, color: flag ? '#D4B85A' : '#7AB07A' }}>{flag ? '⚠' : '✓'}</span>
              </div>
              {expanded && (
                <div style={prefExpanded}>
                  {p.detail && (
                    <div style={prefSection}>
                      <div style={prefSectionLabel}>{t('Detail', 'Chi tiết')}</div>
                      <div style={prefSectionBody}>{p.detail}</div>
                    </div>
                  )}
                  {p.verbatim_quote && (
                    <div style={prefSection}>
                      <div style={prefSectionLabel}>{t('Verbatim', 'Nguyên văn')}</div>
                      <div style={{ ...prefSectionBody, fontStyle: 'italic' }}>“{p.verbatim_quote}”</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>{t('Last validated', 'Xác thực lần cuối')}</span>{fmtDate(p.last_validated)}</div>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>{t('Validations', 'Số lần xác thực')}</span>{p.validation_count}</div>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>{t('Source', 'Nguồn')}</span>{p.source || '—'}</div>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>{t('Logged by', 'Người ghi nhận')}</span>{p.logged_by || '—'}</div>
                    {p.contradiction && <div style={prefMetaItem}><span style={prefMetaLabel}>{t('Contradiction', 'Mâu thuẫn')}</span>{t('YES', 'CÓ')}</div>}
                  </div>

                  {/* Validate / revise controls */}
                  <div style={editBlock}>
                    <div style={prefSectionLabel}>{t('Validate or revise', 'Xác thực hoặc chỉnh sửa')}</div>
                    <div style={editGrid}>
                      <div>
                        <div style={editLabel}>S₀ <InfoDot tip={t(TIPS.s0, 'Mức độ quan trọng của sở thích này. 5 = tuyệt đối (dị ứng / bản sắc), 1 = gần như không phải là quan điểm. Tăng giá trị này khuếch đại PS(t) theo tỷ lệ; giới hạn ở mức 5 hạn chế điểm số tối đa mà bất kỳ mục nào có thể đạt được.')} /></div>
                        <select
                          value={draftFor(p).s0}
                          onChange={e => setDraft(p.preference_id, { s0: Number(e.target.value) })}
                          style={editInput}
                        >
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>{t('Confidence', 'Độ tin cậy')} <InfoDot tip={t(TIPS.confidence, 'Mức độ chắc chắn rằng sở thích này là thật. 1.00 = được nêu rõ ràng. 0.75 = mẫu hình lặp lại nhiều lần. 0.25 = suy ra từ một trường hợp. Đóng vai trò như một hệ số nhân — kéo PS(t) xuống khi thấp.')} /></div>
                        <select
                          value={draftFor(p).confidence}
                          onChange={e => setDraft(p.preference_id, { confidence: Number(e.target.value) })}
                          style={editInput}
                        >
                          {ALLOWED_C.map(v => <option key={v} value={v}>{v.toFixed(2)}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>{t('Lambda', 'Lambda')} <InfoDot tip={t(TIPS.lambda, 'Tốc độ sở thích này trở nên lỗi thời. 0 = không bao giờ suy giảm (y tế, bản sắc). 0.020 = giảm một nửa sau mỗi ~35 ngày. Không ảnh hưởng đến điểm số hôm nay; chỉ có ý nghĩa khi thời gian trôi qua kể từ lần xác thực cuối.')} /></div>
                        <select
                          value={draftFor(p).lambda}
                          onChange={e => setDraft(p.preference_id, { lambda: Number(e.target.value) })}
                          style={editInput}
                        >
                          {ALLOWED_L.map(v => <option key={v} value={v}>{v.toFixed(3)}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>{t('Frequency', 'Tần suất')} <InfoDot tip={t(TIPS.frequency, 'Tần suất sở thích này xuất hiện trong thực tế. 1.0 = mặc định hàng tháng. 1.5 = hàng ngày / mỗi lần ghé thăm, khuếch đại. 0.8 = hiếm khi, giảm nhẹ.')} /></div>
                        <select
                          value={draftFor(p).frequency}
                          onChange={e => setDraft(p.preference_id, { frequency: Number(e.target.value) })}
                          style={editInput}
                        >
                          {ALLOWED_F.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>{t('Status', 'Trạng thái')} <InfoDot tip={t(TIPS.status, 'Active = hiển thị trong chế độ xem PS(t) trực tiếp. Invalidated = ẩn khỏi chế độ xem trực tiếp nhưng giữ lại cho lịch sử kiểm toán. Archived = xóa mềm.')} /></div>
                        <select
                          value={draftFor(p).status}
                          onChange={e => setDraft(p.preference_id, { status: e.target.value })}
                          style={editInput}
                        >
                          {ALLOWED_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Live preview of post-save PS(t) */}
                    {(() => {
                      const d = draftFor(p)
                      const pred = predictPs(d, p.validation_count)
                      const delta = pred.ps - p.ps_t
                      const isHidden = d.status !== 'active'
                      return (
                        <div style={previewRow}>
                          <div style={previewItem}>
                            <span style={previewLabel}>{t('Current', 'Hiện tại')}</span>
                            <span style={previewValue}>
                              {Number(p.ps_t).toFixed(2)}
                              <span style={{ ...previewSub, color: '#B2AA98' }}> · {p.score_health_pct}%</span>
                            </span>
                          </div>
                          <span style={previewArrow}>→</span>
                          <div style={previewItem}>
                            <span style={previewLabel}>{t('After save', 'Sau khi lưu')}</span>
                            {isHidden ? (
                              <span style={{ ...previewValue, color: '#C27070', fontSize: 12 }}>{t('(hidden from live view)', '(ẩn khỏi chế độ xem trực tiếp)')}</span>
                            ) : (
                              <span style={previewValue}>
                                {pred.ps.toFixed(2)}
                                <span style={{ ...previewSub, color: pred.health >= 100 ? '#D4B85A' : '#B2AA98' }}> · {pred.health}%</span>
                              </span>
                            )}
                          </div>
                          {!isHidden && Math.abs(delta) > 0.005 && (
                            <span style={{ ...previewDelta, color: delta > 0 ? '#7AB07A' : '#C27070' }}>
                              {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    <div style={{ marginTop: 12 }}>
                      <div style={editLabel}>{t('Notes', 'Ghi chú')} <span style={{ opacity: 0.5 }}>({t('saved to', 'lưu vào')} validation_events)</span></div>
                      <textarea
                        value={draftFor(p).notes}
                        onChange={e => setDraft(p.preference_id, { notes: e.target.value })}
                        placeholder={t("Optional context — e.g. 'Confirmed in conversation with Lachlan, 13 May.'", "Bối cảnh tùy chọn — ví dụ: 'Đã xác nhận trong cuộc trò chuyện với Lachlan, 13 tháng 5.'")}
                        rows={2}
                        style={{ ...editInput, width: '100%', resize: 'vertical', fontFamily: "'Google Sans Code', monospace" }}
                      />
                    </div>

                    {errors[p.preference_id] && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)', borderRadius: 6, color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 11 }}>
                        {errors[p.preference_id]}
                      </div>
                    )}

                    <div style={editActions}>
                      <button
                        onClick={() => submit(p, isDirty(p) ? 'revised' : 'confirmed')}
                        disabled={saving === p.preference_id}
                        style={isDirty(p) ? btnPrimary : btnGhost}
                      >
                        {saving === p.preference_id ? '…' : isDirty(p) ? t('Save revision', 'Lưu chỉnh sửa') : t('Confirm — still accurate', 'Xác nhận — vẫn chính xác')}
                      </button>
                      <button
                        onClick={() => setConfirmInvalidate(p)}
                        disabled={saving === p.preference_id}
                        style={btnDanger}
                      >
                        {t('Invalidate', 'Vô hiệu hóa')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmModal
        open={!!confirmInvalidate}
        eyebrow={`⚠ ${t('INVALIDATE PREFERENCE', 'VÔ HIỆU HÓA SỞ THÍCH')}`}
        title={t('Invalidate this preference?', 'Vô hiệu hóa sở thích này?')}
        subject={confirmInvalidate ? `${confirmInvalidate.preference_name} · ${confirmInvalidate.category}` : undefined}
        body={t('Hides it from the live PS(t) view and stops it scoring. The row stays for history and the validation event is logged. Cannot be confirmed back from here — re-add via interview if needed.', 'Ẩn khỏi chế độ xem PS(t) trực tiếp và ngừng tính điểm. Dòng này vẫn được giữ lại để lưu lịch sử và sự kiện xác thực được ghi lại. Không thể khôi phục lại từ đây — thêm lại qua phỏng vấn nếu cần.')}
        confirmLabel={t('Invalidate', 'Vô hiệu hóa')}
        busyLabel={t('Invalidating…', 'Đang vô hiệu hóa…')}
        busy={!!confirmInvalidate && saving === confirmInvalidate.preference_id}
        onCancel={() => setConfirmInvalidate(null)}
        onConfirm={() => { const p = confirmInvalidate; if (p) { setConfirmInvalidate(null); submit(p, 'invalidated') } }}
      />

      {toastNode}
    </>
  )
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 24, textDecoration: 'none',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '8px 0 0',
}
const profileHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  marginBottom: 32, gap: 32, flexWrap: 'wrap',
}
const memberNoBadge: React.CSSProperties = {
  display: 'inline-block', padding: '4px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.10em',
  background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 4,
}
const nicknameText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.7, marginTop: 6, letterSpacing: '0.04em',
}
const metaPanel: React.CSSProperties = {
  display: 'flex', gap: 24, flexWrap: 'wrap',
  padding: '14px 20px',
  background: 'rgba(229,212,194,0.04)', borderRadius: 8,
}
const metaItem: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const metaLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
}
const metaValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2',
}
const score5Panel: React.CSSProperties = {
  marginBottom: 28, padding: 20,
  background: 'rgba(212,184,90,0.06)',
  border: '1px solid rgba(212,184,90,0.20)', borderRadius: 10,
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 14,
}
const score5Grid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
}
const score5Card: React.CSSProperties = {
  padding: 14,
  background: 'rgba(5,46,32,0.4)', borderRadius: 6,
  border: '1px solid rgba(212,184,90,0.10)',
}
const score5Category: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const score5Name: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2',
  marginBottom: 6,
}
const score5Detail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.5,
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, boxSizing: 'border-box', outline: 'none',
}
const prefListHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '12px 0 8px',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  letterSpacing: '0.10em', textTransform: 'uppercase',
}
const prefRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '14px 0',
}
const prefColCategory: React.CSSProperties = {
  flex: '0 0 150px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98',
}
const prefColName: React.CSSProperties = { flex: 1, minWidth: 180, color: '#E5D4C2', paddingRight: 12 }
const prefColScore: React.CSSProperties = {
  flex: '0 0 50px', textAlign: 'right',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2',
}
const prefColScoreWide: React.CSSProperties = {
  flex: '0 0 60px', textAlign: 'right',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2',
}
const prefColFlag: React.CSSProperties = {
  flex: '0 0 36px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 14,
}
const prefExpanded: React.CSSProperties = {
  padding: '0 0 18px 150px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2',
}
const prefSection: React.CSSProperties = { marginBottom: 10 }
const prefSectionLabel: React.CSSProperties = {
  fontSize: 10, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const prefSectionBody: React.CSSProperties = {
  color: '#E5D4C2', lineHeight: 1.6,
}
const prefMetaItem: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  fontSize: 11, color: '#E5D4C2',
}
const prefMetaLabel: React.CSSProperties = {
  fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const editBlock: React.CSSProperties = {
  marginTop: 18, padding: '14px 16px',
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 8,
}
const editGrid: React.CSSProperties = {
  display: 'grid', gap: 12, marginTop: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const editInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.5)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const editActions: React.CSSProperties = {
  display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap',
}
const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '10px 18px',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer', color: '#E5D4C2',
}
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#5E6650' }
const btnGhost:   React.CSSProperties = { ...btnBase, background: 'rgba(229,212,194,0.10)' }
const btnDanger:  React.CSSProperties = { ...btnBase, background: 'rgba(180,70,70,0.20)' }

const infoDotStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 14, height: 14, marginLeft: 4,
  borderRadius: '50%',
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 600, fontStyle: 'italic',
  cursor: 'help', userSelect: 'none', textTransform: 'none', letterSpacing: 0,
  outline: 'none',
}
const tooltipStyle: React.CSSProperties = {
  position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)',
  transform: 'translateX(-50%)',
  width: 260, padding: '10px 12px',
  background: '#0A3D2B', color: '#E5D4C2',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: 0, textTransform: 'none', lineHeight: 1.55,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  zIndex: 50, pointerEvents: 'none',
}
const previewRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
  marginTop: 14, padding: '12px 14px',
  background: 'rgba(5,46,32,0.5)',
  border: '1px solid rgba(212,184,90,0.18)', borderRadius: 6,
}
const previewItem: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110,
}
const previewLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const previewValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 600,
  color: '#E5D4C2', letterSpacing: '0.02em',
}
const previewSub: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 400,
  marginLeft: 4,
}
const previewArrow: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#D4B85A', opacity: 0.6,
}
const previewDelta: React.CSSProperties = {
  marginLeft: 'auto',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12, fontWeight: 600,
  letterSpacing: '0.04em',
}
