'use client'

import { use, useEffect, useState, useCallback, useMemo } from 'react'
import { ConfirmModal } from '@/components/admin/dialogs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/admin-lang'

// MIS Pipeline — prospect detail page.
//
// Full-fat CRM record with editable sections, scoring rubric, stage progress
// bar, activity timeline, and the action sidebar (process transcript,
// convert to member, archive). Every update PATCHes and refreshes inline.

interface Prospect {
  prospect_id: string
  stage: string
  full_name: string
  nickname: string | null
  referred_by_name: string | null
  referred_by_member_no: string | null
  referral_relationship: string | null
  source_channel: string | null
  contact_info: string | null
  first_contact_date: string | null
  last_contact_date: string | null
  contact_count: number | null
  next_action: string | null
  next_action_date: string | null
  assigned_to: string | null
  notes: string | null
  interview_date: string | null
  interviewer: string | null
  interview_location: string | null
  interview_duration: string | null
  interview_notes: string | null
  red_flags: string | null
  profession: string | null
  cultural_fit: number | null
  social_compatibility: number | null
  commercial_potential: number | null
  whisky_interest: number | null
  brand_alignment: number | null
  community_value: number | null
  diversity_contribution: string | null
  committee_notes: string | null
  decision: string | null
  decision_date: string | null
  converted_member_no: string | null
  letter_sent: boolean
  days_in_pipeline: number | null
  overall_score: number | null
  archived_at: string | null
}

interface Activity {
  id: string
  prospect_id: string
  actor: string | null
  event_type: string
  from_value: string | null
  to_value: string | null
  note: string | null
  created_at: string
}

interface Invitation {
  id: string
  token: string
  full_name: string | null
  email: string | null
  status: string
  member_no: string | null
  created_at: string
  viewed_at: string | null
  view_count: number | null
  last_reminded_at: string | null
  reminder_count: number | null
  revoked_at: string | null
}

const ACTIVE_STAGES = [
  'Lead',
  'Initial Contact',
  'Interview Scheduled',
  'Interview Complete',
  'Application Received',
  'Onboarded',
] as const
const OFFRAMP_STAGES = ['Declined', 'Withdrawn', 'On Hold'] as const
const ALL_STAGES = [...ACTIVE_STAGES, ...OFFRAMP_STAGES] as const
const SOURCES = ['Referral', 'Direct Approach', 'Event']
const DECISIONS = ['Approved', 'Declined', 'Pending', 'Deferred']
const TIERS = ['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']

const SCORE_FIELDS = [
  { key: 'cultural_fit',         label: 'Cultural Fit',         labelVi: 'Sự phù hợp văn hóa',      tip: 'Does the prospect align with the club\'s values and style?',                  tipVi: 'Ứng viên có phù hợp với giá trị và phong cách của câu lạc bộ không?' },
  { key: 'social_compatibility', label: 'Social Compatibility', labelVi: 'Sự hòa hợp xã hội',        tip: 'Will they get on with existing members? Will they enhance the room?',         tipVi: 'Họ có hòa hợp với các hội viên hiện tại không? Họ có làm không gian thêm đặc sắc không?' },
  { key: 'commercial_potential', label: 'Commercial Potential', labelVi: 'Tiềm năng thương mại',     tip: 'How much will they contribute to revenue (bottle pours, events, hosting)?',    tipVi: 'Họ sẽ đóng góp bao nhiêu vào doanh thu (rượu, sự kiện, tổ chức tiếp đón)?' },
  { key: 'whisky_interest',      label: 'Whisky Interest',      labelVi: 'Đam mê whisky',            tip: 'Genuine connoisseur, casual enthusiast, or here for the room only?',           tipVi: 'Người sành sỏi thực thụ, người yêu thích bình thường, hay chỉ đến vì không gian?' },
  { key: 'brand_alignment',      label: 'Brand Alignment',      labelVi: 'Sự phù hợp thương hiệu',   tip: 'Does the prospect uplift the club\'s reputation?',                             tipVi: 'Ứng viên có nâng tầm uy tín của câu lạc bộ không?' },
  { key: 'community_value',      label: 'Community Value',      labelVi: 'Giá trị cộng đồng',        tip: 'What unique relationships or perspective do they bring?',                      tipVi: 'Họ mang lại những mối quan hệ hay góc nhìn độc đáo nào?' },
] as const

export default function ProspectDetail({ params }: { params: Promise<{ prospect_id: string }> }) {
  const { t } = useLang()
  const { prospect_id } = use(params)
  const router = useRouter()
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [activity, setActivity] = useState<Activity[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [conversionTier, setConversionTier] = useState('Pioneer')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMobile, setInviteMobile] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showOverride, setShowOverride] = useState(false)
  const [converting, setConverting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/mis/prospects/${prospect_id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.prospect) setProspect(d.prospect)
        if (d.activity) setActivity(d.activity)
        if (d.invitations) setInvitations(d.invitations)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [prospect_id])
  useEffect(() => { load() }, [load])

  const patch = useCallback(async (patchBody: Record<string, unknown>) => {
    const key = Object.keys(patchBody).join(',')
    setSavingMap(m => ({ ...m, [key]: true }))
    setError(null)
    try {
      const r = await fetch(`/api/admin/mis/prospects/${prospect_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Save failed', 'Lưu thất bại'))
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingMap(m => ({ ...m, [key]: false }))
    }
  }, [prospect_id, load])

  const allocateMember = useCallback(async (): Promise<string | null> => {
    if (prospect?.converted_member_no) return prospect.converted_member_no
    try {
      const r = await fetch(`/api/admin/mis/prospects/${prospect_id}/allocate-member`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Failed to allocate', 'Không thể cấp số hội viên'))
      load()
      return j.member_no as string
    } catch (e) {
      setError((e as Error).message)
      return null
    }
  }, [prospect, prospect_id, load])

  const processTranscript = useCallback(async () => {
    const mn = await allocateMember()
    if (mn) router.push(`/admin/mis/${mn}/intake`)
  }, [allocateMember, router])

  const sendInvitation = useCallback(async (opts: { resend?: boolean } = {}) => {
    if (!inviteEmail.trim()) { setError(t('Email required for invitation.', 'Cần có email để gửi lời mời.')); return }
    setSending(true); setError(null); setSendResult(null)
    try {
      const r = await fetch(`/api/admin/mis/prospects/${prospect_id}/send-invitation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: conversionTier,
          email: inviteEmail.trim(),
          mobile: inviteMobile.trim() || null,
          resend: !!opts.resend,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Send failed', 'Gửi thất bại'))
      setSendResult({
        ok: j.email_sent,
        msg: j.email_sent
          ? `${t('Invitation sent to', 'Đã gửi lời mời đến')} ${inviteEmail.trim()}. ${t('Member', 'Hội viên')} ${j.member_no} ${t('created with status Pending Signature.', 'đã được tạo với trạng thái Chờ ký.')}`
          : `${t('Invitation row created but email failed:', 'Đã tạo bản ghi lời mời nhưng gửi email thất bại:')} ${j.email_error}. ${t('Link:', 'Liên kết:')} ${j.link}`,
      })
      setShowInvite(false)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }, [prospect_id, conversionTier, inviteEmail, inviteMobile, load])

  const forceConvert = useCallback(async () => {
    setConverting(true); setError(null)
    try {
      const r = await fetch(`/api/admin/mis/prospects/${prospect_id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: conversionTier }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Convert failed', 'Chuyển đổi thất bại'))
      setShowOverride(false)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setConverting(false)
    }
  }, [prospect_id, conversionTier, load])

  const revokeInvitation = useCallback(async (invitation_id: string) => {
    setError(null)
    try {
      const r = await fetch('/api/admin/agreements/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || t('Revoke failed', 'Thu hồi thất bại'))
      }
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }, [load])

  const copyLink = useCallback((token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(`${base}/sign/${token}`)
  }, [])

  const archive = useCallback(async () => {
    await fetch(`/api/admin/mis/prospects/${prospect_id}`, { method: 'DELETE' })
    router.push('/admin/mis/pipeline')
  }, [prospect_id, router])

  // Un-convert — the atomic inverse: deletes the provisional member, nulls the
  // link, returns the prospect to Lead. The route + DB guard refuse on a real
  // Active member, so this can only ever clear a provisional.
  const unconvert = useCallback(async () => {
    setConverting(true); setError(null)
    try {
      const r = await fetch(`/api/admin/mis/prospects/${prospect_id}/unconvert`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Un-convert failed', 'Hoàn tác chuyển đổi thất bại'))
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setConverting(false)
    }
  }, [prospect_id, load])

  // Branded confirm modal — one state covers all destructive paths.
  type Pending =
    | { kind: 'force_convert' }
    | { kind: 'archive' }
    | { kind: 'revoke'; invitation_id: string }
    | { kind: 'unconvert' }
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const closeConfirm = () => { if (!confirmBusy) setPending(null) }
  const runPending = async () => {
    if (!pending) return
    setConfirmBusy(true)
    try {
      if (pending.kind === 'force_convert') await forceConvert()
      else if (pending.kind === 'revoke') await revokeInvitation(pending.invitation_id)
      else if (pending.kind === 'unconvert') await unconvert()
      else if (pending.kind === 'archive') await archive()
      setPending(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  const stageIdx = useMemo(() => prospect ? ACTIVE_STAGES.indexOf(prospect.stage as typeof ACTIVE_STAGES[number]) : -1, [prospect])
  const isOfframp = useMemo(() => prospect ? (OFFRAMP_STAGES as readonly string[]).includes(prospect.stage) : false, [prospect])

  const latestInvitation = useMemo(() => invitations[0] || null, [invitations])
  const activeInvitation = useMemo(
    () => invitations.find(i => i.status === 'pending' && !i.revoked_at) || null,
    [invitations]
  )

  // Pre-fill invite email from latest invitation or by sniffing contact_info.
  useEffect(() => {
    if (inviteEmail) return
    const fromInv = invitations.find(i => i.email)?.email
    if (fromInv) { setInviteEmail(fromInv); return }
    const m = prospect?.contact_info?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (m) setInviteEmail(m[0])
  }, [prospect, invitations, inviteEmail])

  if (loading) return <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
  if (!prospect) return <div style={emptyText}>{t('Prospect not found.', 'Không tìm thấy ứng viên.')}</div>

  const scoreVals = SCORE_FIELDS.map(f => prospect[f.key as keyof Prospect] as number | null).filter(v => v != null) as number[]

  return (
    <>
      <Link href="/admin/mis/pipeline" style={backLink}>← {t('Pipeline', 'Quy trình')}</Link>

      {/* Hero */}
      <div style={heroGrid}>
        <div>
          <div style={prospectIdBadge}>{prospect.prospect_id}</div>
          <h1 style={pageTitle}>{prospect.full_name}</h1>
          {prospect.nickname && <div style={nicknameText}>{prospect.nickname}</div>}
        </div>
        <div style={heroStats}>
          {prospect.days_in_pipeline != null && (
            <div style={heroStat}>
              <div style={heroStatLabel}>{t('Days in pipeline', 'Số ngày trong quy trình')}</div>
              <div style={heroStatValue}>{prospect.days_in_pipeline}</div>
            </div>
          )}
          {prospect.overall_score != null && (
            <div style={heroStat}>
              <div style={heroStatLabel}>{t('Overall score', 'Điểm tổng')}</div>
              <div style={{ ...heroStatValue, color: '#D4B85A' }}>{Number(prospect.overall_score).toFixed(2)}</div>
            </div>
          )}
          {prospect.converted_member_no && (
            <Link href={`/admin/mis/${prospect.converted_member_no}`} style={heroStat}>
              <div style={heroStatLabel}>{t('Member no.', 'Số hội viên')}</div>
              <div style={{ ...heroStatValue, color: '#7AB07A' }}>{prospect.converted_member_no}</div>
            </Link>
          )}
        </div>
      </div>

      {/* Stage progress */}
      {!isOfframp ? (
        <div style={stageProgress}>
          {ACTIVE_STAGES.map((s, i) => {
            const active = i <= stageIdx
            const done = i < stageIdx
            return (
              <div key={s} style={{ flex: 1, position: 'relative' }}>
                <button
                  onClick={() => patch({ stage: s })}
                  disabled={savingMap['stage']}
                  style={{
                    ...stageStep,
                    background: done ? 'rgba(122,176,122,0.20)' : active ? 'rgba(212,184,90,0.18)' : 'rgba(229,212,194,0.04)',
                    border: '1px solid ' + (done ? 'rgba(122,176,122,0.50)' : active ? 'rgba(212,184,90,0.50)' : 'rgba(229,212,194,0.10)'),
                    color: done ? '#7AB07A' : active ? '#D4B85A' : '#B2AA98',
                    cursor: savingMap['stage'] ? 'wait' : 'pointer',
                  }}
                >
                  <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {done ? '✓ ' : ''}{s}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={offrampBanner}>
          ◆ {t('Off-ramp', 'Rời quy trình')} · {prospect.stage} — <button onClick={() => patch({ stage: 'Lead' })} style={inlineBtn}>{t('return to pipeline', 'quay lại quy trình')}</button>
        </div>
      )}

      {/* Stage transition (also covers off-ramps) */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          {t('Move to', 'Chuyển đến')}
        </span>
        <select value={prospect.stage} onChange={e => patch({ stage: e.target.value })} style={inputStyle}>
          {ALL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', marginLeft: 'auto', cursor: 'pointer' }}>
          <input type="checkbox" checked={prospect.letter_sent} onChange={e => patch({ letter_sent: e.target.checked })} />
          {t('Letter sent', 'Đã gửi thư')}
        </label>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={twoCol}>
        {/* MAIN COLUMN */}
        <div style={mainCol}>
          {/* Identity & Referral */}
          <Section title={t('Identity & referral', 'Thông tin & người giới thiệu')}>
            <Field label={t('Profession / sector', 'Nghề nghiệp / lĩnh vực')} value={prospect.profession} onSave={v => patch({ profession: v })} />
            <Field label={t('Position / title', 'Chức vụ / chức danh')} value={prospect.nickname} onSave={v => patch({ nickname: v })} />
            <Field label={t('Referred by', 'Người giới thiệu')} value={prospect.referred_by_name} onSave={v => patch({ referred_by_name: v })} />
            <Field label={t('Relationship', 'Mối quan hệ')} value={prospect.referral_relationship} onSave={v => patch({ referral_relationship: v })} />
            <SelectField label={t('Source channel', 'Kênh nguồn')} value={prospect.source_channel} options={['', ...SOURCES]} onSave={v => patch({ source_channel: v })} />
            <Field label={t('Contact info', 'Thông tin liên hệ')} value={prospect.contact_info} onSave={v => patch({ contact_info: v })} textarea />
          </Section>

          {/* Engagement */}
          <Section title={t('Engagement', 'Tương tác')}>
            <DateField label={t('First contact date', 'Ngày liên hệ đầu tiên')} value={prospect.first_contact_date} onSave={v => patch({ first_contact_date: v })} />
            <DateField label={t('Last contact date', 'Ngày liên hệ gần nhất')} value={prospect.last_contact_date} onSave={v => patch({ last_contact_date: v })} />
            <Field label={t('Next action', 'Hành động tiếp theo')} value={prospect.next_action} onSave={v => patch({ next_action: v })} />
            <DateField label={t('Next action date', 'Ngày hành động tiếp theo')} value={prospect.next_action_date} onSave={v => patch({ next_action_date: v })} />
            <Field label={t('Assigned to', 'Phụ trách bởi')} value={prospect.assigned_to} onSave={v => patch({ assigned_to: v })} />
            <Field label={t('Notes', 'Ghi chú')} value={prospect.notes} onSave={v => patch({ notes: v })} textarea />
          </Section>

          {/* Interview */}
          <Section title={t('Interview', 'Phỏng vấn')}>
            <DateField label={t('Interview date', 'Ngày phỏng vấn')} value={prospect.interview_date} onSave={v => patch({ interview_date: v })} />
            <Field label={t('Interviewer', 'Người phỏng vấn')} value={prospect.interviewer} onSave={v => patch({ interviewer: v })} />
            <Field label={t('Location', 'Địa điểm')} value={prospect.interview_location} onSave={v => patch({ interview_location: v })} />
            <Field label={t('Duration', 'Thời lượng')} value={prospect.interview_duration} onSave={v => patch({ interview_duration: v })} />
            <Field label={t('Interview notes', 'Ghi chú phỏng vấn')} value={prospect.interview_notes} onSave={v => patch({ interview_notes: v })} textarea />
            <Field label={t('Red flags', 'Dấu hiệu cảnh báo')} value={prospect.red_flags} onSave={v => patch({ red_flags: v })} textarea />
          </Section>

          {/* Scoring rubric */}
          <Section title={t('Scoring rubric', 'Thang chấm điểm')} subtitle={t('1–5 per dimension · overall = mean of populated', '1–5 mỗi tiêu chí · tổng = trung bình các mục đã chấm')}>
            <div style={scoreGrid}>
              {SCORE_FIELDS.map(f => (
                <ScoreDial
                  key={f.key}
                  label={t(f.label, f.labelVi)}
                  tip={t(f.tip, f.tipVi)}
                  value={prospect[f.key as keyof Prospect] as number | null}
                  onSave={v => patch({ [f.key]: v })}
                />
              ))}
            </div>
            {prospect.overall_score != null && (
              <div style={overallBar}>
                <div style={overallBarLabel}>{t('Overall', 'Tổng')}</div>
                <div style={overallBarTrack}>
                  <div style={{ ...overallBarFill, width: `${(Number(prospect.overall_score) / 5) * 100}%` }} />
                </div>
                <div style={overallBarValue}>{Number(prospect.overall_score).toFixed(2)}</div>
              </div>
            )}
            <Field label={t('Diversity contribution', 'Đóng góp về sự đa dạng')} value={prospect.diversity_contribution} onSave={v => patch({ diversity_contribution: v })} textarea />
          </Section>

          {/* Decision */}
          <Section title={t('Decision', 'Quyết định')}>
            <SelectField label={t('Decision', 'Quyết định')} value={prospect.decision} options={['', ...DECISIONS]} onSave={v => patch({ decision: v })} />
            <DateField label={t('Decision date', 'Ngày quyết định')} value={prospect.decision_date} onSave={v => patch({ decision_date: v })} />
            <Field label={t('Committee notes', 'Ghi chú của hội đồng')} value={prospect.committee_notes} onSave={v => patch({ committee_notes: v })} textarea />
          </Section>
        </div>

        {/* SIDEBAR */}
        <div style={sideCol}>
          <div style={actionsPanel}>
            <div style={panelLabel}>{t('Actions', 'Thao tác')}</div>
            <button onClick={processTranscript} style={btnPrimary}>
              ◆ {t('Process interview transcript', 'Xử lý biên bản phỏng vấn')} →
            </button>
            {!prospect.converted_member_no && (
              <button onClick={async () => { await allocateMember() }} style={btnGhost}>
                {t('Allocate provisional member no.', 'Cấp số hội viên tạm thời')}
              </button>
            )}
            {/* Un-convert — the inverse of allocate/convert. Shown only while a
                provisional member is linked but the prospect isn't yet Onboarded;
                the route + DB guard refuse on a real Active member. */}
            {prospect.converted_member_no && prospect.stage !== 'Onboarded' && (
              <button
                onClick={() => setPending({ kind: 'unconvert' })}
                disabled={converting}
                style={{ ...btnGhost, color: '#C27070', borderColor: 'rgba(180,70,70,0.30)' }}
              >
                {t('Un-convert · remove provisional', 'Hoàn tác · gỡ hội viên tạm thời')} ({prospect.converted_member_no})
              </button>
            )}

            {/* Signing flow */}
            {prospect.stage !== 'Onboarded' && (
              <>
                {activeInvitation ? (
                  <div style={inviteStatusBlock}>
                    <div style={editLabel}>{t('Invitation status', 'Trạng thái lời mời')}</div>
                    <div style={inviteStatusPill('pending')}>
                      ✉ {t('Pending · sent', 'Đang chờ · đã gửi')} {fmtDate(activeInvitation.created_at)}
                    </div>
                    <div style={inviteMeta}>
                      {t('To:', 'Đến:')} <span style={{ color: '#E5D4C2' }}>{activeInvitation.email}</span>
                    </div>
                    {activeInvitation.viewed_at && (
                      <div style={inviteMeta}>
                        {t('Viewed:', 'Đã xem:')} <span style={{ color: '#D4B85A' }}>{fmtDate(activeInvitation.viewed_at)}</span>
                        {activeInvitation.view_count ? ` (${activeInvitation.view_count}×)` : ''}
                      </div>
                    )}
                    {!activeInvitation.viewed_at && (
                      <div style={{ ...inviteMeta, opacity: 0.5 }}>{t('Not yet opened.', 'Chưa mở.')}</div>
                    )}
                    {activeInvitation.reminder_count ? (
                      <div style={inviteMeta}>
                        {t('Reminders sent:', 'Số lần nhắc đã gửi:')} {activeInvitation.reminder_count}
                        {activeInvitation.last_reminded_at && ` · ${t('last', 'lần cuối')} ${fmtDate(activeInvitation.last_reminded_at)}`}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => sendInvitation({ resend: true })} disabled={sending} style={{ ...btnGhost, padding: '8px 12px', flex: 1 }}>
                        {sending ? t('Sending…', 'Đang gửi…') : t('Resend email', 'Gửi lại email')}
                      </button>
                      <button onClick={() => copyLink(activeInvitation.token)} style={{ ...btnGhost, padding: '8px 12px' }}>
                        {t('Copy link', 'Sao chép liên kết')}
                      </button>
                      <button onClick={() => setPending({ kind: 'revoke', invitation_id: activeInvitation.id })} style={{ ...btnGhost, padding: '8px 12px', color: '#C27070', borderColor: 'rgba(180,70,70,0.30)' }}>
                        {t('Revoke', 'Thu hồi')}
                      </button>
                    </div>
                  </div>
                ) : latestInvitation && latestInvitation.status === 'signed' ? (
                  <div style={inviteStatusBlock}>
                    <div style={editLabel}>{t('Agreement', 'Thỏa thuận')}</div>
                    <div style={inviteStatusPill('signed')}>
                      ✓ {t('Signed ·', 'Đã ký ·')} {fmtDate(latestInvitation.created_at)}
                    </div>
                    <div style={inviteMeta}>
                      {t('Member', 'Hội viên')} <span style={{ color: '#7AB07A' }}>{latestInvitation.member_no || prospect.converted_member_no}</span> {t('is Active.', 'đang hoạt động.')}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowInvite(s => !s)} style={btnAccent}>
                    {showInvite ? t('Cancel invitation', 'Hủy lời mời') : `✉ ${t('Send signing invitation', 'Gửi lời mời ký')}`}
                  </button>
                )}

                {showInvite && !activeInvitation && (
                  <div style={convertBlock}>
                    <div style={editLabel}>{t('Tier', 'Hạng')}</div>
                    <select value={conversionTier} onChange={e => setConversionTier(e.target.value)} style={inputStyle}>
                      {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={editLabel}>{t('Email *', 'Email *')}</div>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="name@example.com"
                      style={inputStyle}
                    />
                    <div style={editLabel}>{t('Mobile (optional)', 'Số di động (tùy chọn)')}</div>
                    <input
                      value={inviteMobile}
                      onChange={e => setInviteMobile(e.target.value)}
                      placeholder="+84 …"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => sendInvitation()}
                      disabled={sending || !inviteEmail.trim()}
                      style={{ ...btnPrimary, marginTop: 8, width: '100%', opacity: !inviteEmail.trim() ? 0.4 : 1 }}
                    >
                      {sending ? t('Sending…', 'Đang gửi…') : t('Send invitation', 'Gửi lời mời')}
                    </button>
                    <div style={{ ...inviteMeta, marginTop: 6 }}>
                      {t('Creates a Pending Signature member, emails the signing link, and flips this prospect to Application Received. They become Active when they sign.', 'Tạo một hội viên ở trạng thái Chờ ký, gửi email liên kết ký, và chuyển ứng viên này sang Đã nhận đơn. Họ trở thành hội viên hoạt động khi ký.')}
                    </div>
                  </div>
                )}

                {sendResult && (
                  <div style={sendResult.ok ? inviteSuccessBox : inviteWarnBox}>
                    {sendResult.msg}
                  </div>
                )}

                {/* Admin override: force-convert without signing */}
                <button onClick={() => setShowOverride(s => !s)} style={{ ...btnGhost, fontSize: 10, opacity: 0.7 }}>
                  {showOverride ? t('— hide override', '— ẩn ghi đè') : `★ ${t('Force convert without signing', 'Ép chuyển đổi mà không cần ký')}`}
                </button>
                {showOverride && (
                  <div style={convertBlock}>
                    <div style={inviteMeta}>
                      {t('Skips the signing flow — member becomes Active immediately with no agreement on file. Use only when a paper agreement has been signed offline.', 'Bỏ qua quy trình ký — hội viên hoạt động ngay lập tức mà không có thỏa thuận lưu hồ sơ. Chỉ dùng khi đã ký thỏa thuận giấy ngoài hệ thống.')}
                    </div>
                    <div style={editLabel}>{t('Tier', 'Hạng')}</div>
                    <select value={conversionTier} onChange={e => setConversionTier(e.target.value)} style={inputStyle}>
                      {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={() => setPending({ kind: 'force_convert' })} disabled={converting} style={{ ...btnPrimary, marginTop: 8, width: '100%', background: 'rgba(180,70,70,0.30)' }}>
                      {converting ? t('Converting…', 'Đang chuyển đổi…') : t('Confirm force convert', 'Xác nhận ép chuyển đổi')}
                    </button>
                  </div>
                )}
              </>
            )}

            <button onClick={() => setPending({ kind: 'archive' })} style={btnDanger}>
              {t('Archive prospect', 'Lưu trữ ứng viên')}
            </button>
          </div>

          {/* Activity timeline */}
          <div style={timelinePanel}>
            <div style={panelLabel}>{t('Activity', 'Hoạt động')}</div>
            <div style={timelineList}>
              {activity.length === 0 ? (
                <div style={timelineEmpty}>{t('No activity yet.', 'Chưa có hoạt động.')}</div>
              ) : activity.map(a => (
                <div key={a.id} style={timelineRow}>
                  <div style={timelineDot} />
                  <div style={timelineBody}>
                    <div style={timelineEvent}>{formatEvent(a, t)}</div>
                    <div style={timelineMeta}>
                      {a.actor || t('system', 'hệ thống')} · {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pending}
        eyebrow={pending?.kind === 'force_convert' ? t('⚠ ADMIN OVERRIDE', '⚠ QUẢN TRỊ GHI ĐÈ')
          : pending?.kind === 'revoke' ? t('⚠ REVOKE INVITATION', '⚠ THU HỒI LỜI MỜI')
          : pending?.kind === 'unconvert' ? t('⚠ REMOVE PROVISIONAL MEMBER', '⚠ GỠ HỘI VIÊN TẠM THỜI')
          : t('⚠ ARCHIVE PROSPECT', '⚠ LƯU TRỮ ỨNG VIÊN')}
        title={pending?.kind === 'force_convert' ? t('Force convert without signing?', 'Ép chuyển đổi mà không cần ký?')
          : pending?.kind === 'revoke' ? t('Revoke this invitation?', 'Thu hồi lời mời này?')
          : pending?.kind === 'unconvert' ? t('Remove the provisional member?', 'Gỡ hội viên tạm thời?')
          : t('Archive this prospect?', 'Lưu trữ ứng viên này?')}
        subject={prospect?.full_name}
        body={pending?.kind === 'force_convert'
          ? `${t('The member becomes Active immediately as', 'Hội viên sẽ hoạt động ngay lập tức với hạng')} ${conversionTier}${t(', with no signed agreement on file. Admin override only — use when the agreement is handled outside the system.', ', không có thỏa thuận đã ký lưu hồ sơ. Chỉ dành cho quản trị ghi đè — dùng khi thỏa thuận được xử lý ngoài hệ thống.')}`
          : pending?.kind === 'revoke'
          ? t('The signing link stops working immediately. You can send a fresh invitation afterwards if needed.', 'Liên kết ký sẽ ngừng hoạt động ngay lập tức. Sau đó bạn có thể gửi lời mời mới nếu cần.')
          : pending?.kind === 'unconvert'
          ? `${t('This removes the provisional member record', 'Thao tác này gỡ hồ sơ hội viên tạm thời')} ${prospect?.converted_member_no ? `(${prospect.converted_member_no}) ` : ''}${t("and returns them to Lead. Only for provisional members — real members can't be removed here. The member number is retired, not reused.", 'và trả họ về Lead. Chỉ dành cho hội viên tạm thời — không thể gỡ hội viên thật ở đây. Số hội viên sẽ ngừng dùng, không tái sử dụng.')}`
          : t('Hides the prospect from the pipeline. The record and its full activity trail are preserved for audit.', 'Ẩn ứng viên khỏi quy trình. Hồ sơ và toàn bộ lịch sử hoạt động được giữ lại để kiểm toán.')}
        confirmLabel={pending?.kind === 'force_convert' ? t('Force convert', 'Ép chuyển đổi')
          : pending?.kind === 'revoke' ? t('Revoke invitation', 'Thu hồi lời mời')
          : pending?.kind === 'unconvert' ? t('Remove & return to Lead', 'Gỡ & trả về Lead')
          : t('Archive prospect', 'Lưu trữ ứng viên')}
        busyLabel={t('Working…', 'Đang xử lý…')}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runPending}
      />
    </>
  )
}

function formatEvent(a: Activity, t: (en: string, vi: string) => string): string {
  switch (a.event_type) {
    case 'created':            return t(`Prospect added · ${a.to_value}`, `Đã thêm ứng viên · ${a.to_value}`)
    case 'stage_changed':      return t(`Stage: ${a.from_value || '∅'} → ${a.to_value}`, `Giai đoạn: ${a.from_value || '∅'} → ${a.to_value}`)
    case 'source_changed':     return t(`Source: ${a.from_value || '∅'} → ${a.to_value || '∅'}`, `Nguồn: ${a.from_value || '∅'} → ${a.to_value || '∅'}`)
    case 'decision_changed':   return t(`Decision: ${a.from_value || '∅'} → ${a.to_value || '∅'}`, `Quyết định: ${a.from_value || '∅'} → ${a.to_value || '∅'}`)
    case 'letter_sent':        return t('Letter sent', 'Đã gửi thư')
    case 'letter_unsent':      return t('Letter sent — undone', 'Đã gửi thư — đã hoàn tác')
    case 'scored':             return t('Score updated', 'Đã cập nhật điểm')
    case 'member_no_allocated':return t(`Provisional ${a.to_value} allocated`, `Đã cấp số tạm thời ${a.to_value}`)
    case 'invitation_sent':    return t(`Signing invitation sent · ${a.to_value}`, `Đã gửi lời mời ký · ${a.to_value}`)
    case 'invitation_resent':  return t(`Signing invitation resent · ${a.to_value}`, `Đã gửi lại lời mời ký · ${a.to_value}`)
    case 'signed':             return t(`Agreement signed${a.to_value ? ` · ${a.to_value} activated` : ''}`, `Đã ký thỏa thuận${a.to_value ? ` · ${a.to_value} đã kích hoạt` : ''}`)
    case 'converted':          return t(`Converted to member ${a.to_value}`, `Đã chuyển thành hội viên ${a.to_value}`)
    case 'archived':           return t('Archived', 'Đã lưu trữ')
    case 'restored':           return t('Restored', 'Đã khôi phục')
    default:                   return a.event_type
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ── reusable field components ───────────────────────────────────────
function Field({ label, value, onSave, textarea }: { label: string; value: string | null; onSave: (v: string | null) => void; textarea?: boolean }) {
  const [draft, setDraft] = useState(value || '')
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setDraft(value || ''); setDirty(false) }, [value])
  const commit = () => {
    if (!dirty) return
    onSave(draft.trim() || null)
    setDirty(false)
  }
  return (
    <div style={fieldRow}>
      <div style={editLabel}>{label}</div>
      {textarea ? (
        <textarea
          value={draft}
          onChange={e => { setDraft(e.target.value); setDirty(true) }}
          onBlur={commit}
          rows={2}
          style={{ ...editInput, resize: 'vertical', minHeight: 50 }}
        />
      ) : (
        <input
          type="text"
          value={draft}
          onChange={e => { setDraft(e.target.value); setDirty(true) }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={editInput}
        />
      )}
    </div>
  )
}

function DateField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  return (
    <div style={fieldRow}>
      <div style={editLabel}>{label}</div>
      <input
        type="date"
        value={value || ''}
        onChange={e => onSave(e.target.value || null)}
        style={editInput}
      />
    </div>
  )
}

function SelectField({ label, value, options, onSave }: { label: string; value: string | null; options: string[]; onSave: (v: string | null) => void }) {
  const { t } = useLang()
  return (
    <div style={fieldRow}>
      <div style={editLabel}>{label}</div>
      <select
        value={value || ''}
        onChange={e => onSave(e.target.value || null)}
        style={editInput}
      >
        {options.map(o => <option key={o} value={o}>{o || t('— none —', '— không —')}</option>)}
      </select>
    </div>
  )
}

function ScoreDial({ label, tip, value, onSave }: { label: string; tip: string; value: number | null; onSave: (v: number | null) => void }) {
  const colors = ['#5E6650', '#7A8470', '#D4B85A', '#C49555', '#D4B85A']
  return (
    <div style={scoreCard}>
      <div style={{ ...editLabel, marginBottom: 6, color: '#E5D4C2' }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            onClick={() => onSave(value === n ? null : n)}
            style={{
              flex: 1, padding: '6px 0',
              background: value != null && n <= value ? colors[n-1] : 'rgba(229,212,194,0.06)',
              border: '1px solid ' + (value === n ? 'rgba(212,184,90,0.60)' : 'rgba(229,212,194,0.10)'),
              borderRadius: 4, color: value != null && n <= value ? '#052E20' : '#B2AA98',
              fontFamily: "'Rampant Sans', serif", fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.2s, transform 0.15s',
            }}
            title={tip}
          >
            {n}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 9, fontFamily: "'Google Sans Code', monospace", color: '#B2AA98', opacity: 0.7, marginTop: 6, lineHeight: 1.4 }}>{tip}</div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={section}>
      <div style={sectionHead}>
        <div style={sectionTitle}>{title}</div>
        {subtitle && <div style={sectionSubtitle}>{subtitle}</div>}
      </div>
      <div style={sectionBody}>{children}</div>
    </div>
  )
}

// ── styles ──────────────────────────────────────────────────────────
const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 18, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const heroGrid: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 24, marginBottom: 20, flexWrap: 'wrap',
}
const prospectIdBadge: React.CSSProperties = {
  display: 'inline-block', padding: '4px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.10em',
  background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.02em', margin: '8px 0 4px',
}
const nicknameText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, letterSpacing: '0.02em',
}
const heroStats: React.CSSProperties = {
  display: 'flex', gap: 12, flexWrap: 'wrap',
}
const heroStat: React.CSSProperties = {
  padding: '12px 18px',
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  textAlign: 'center', minWidth: 100,
  textDecoration: 'none',
}
const heroStatLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const heroStatValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 600,
  color: '#E5D4C2', marginTop: 4,
}
const stageProgress: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 8,
}
const stageStep: React.CSSProperties = {
  width: '100%', padding: '10px 6px',
  borderRadius: 6,
  transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
}
const offrampBanner: React.CSSProperties = {
  padding: '12px 14px',
  background: 'rgba(194,112,112,0.10)', border: '1px solid rgba(194,112,112,0.30)',
  borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#C27070', letterSpacing: '0.06em',
  marginBottom: 12,
}
const inlineBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#D4B85A',
  textDecoration: 'underline', cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  padding: 0,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, boxSizing: 'border-box', outline: 'none',
}
const errorBox: React.CSSProperties = {
  marginTop: 12, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const twoCol: React.CSSProperties = {
  display: 'grid', gap: 22, marginTop: 22,
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
}
const mainCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 18,
}
const sideCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 18,
}
const section: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
  overflow: 'hidden',
}
const sectionHead: React.CSSProperties = {
  padding: '14px 18px 10px',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const sectionSubtitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.6, marginTop: 4,
}
const sectionBody: React.CSSProperties = {
  padding: 18,
  display: 'flex', flexDirection: 'column', gap: 12,
}
const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const editInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const scoreGrid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
}
const scoreCard: React.CSSProperties = {
  padding: 12,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const overallBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  marginTop: 16, padding: '12px 14px',
  background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.25)',
  borderRadius: 6,
}
const overallBarLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  minWidth: 60,
}
const overallBarTrack: React.CSSProperties = {
  flex: 1, height: 8,
  background: 'rgba(229,212,194,0.08)', borderRadius: 4,
  overflow: 'hidden',
}
const overallBarFill: React.CSSProperties = {
  height: '100%', background: 'linear-gradient(90deg, #5E6650, #D4B85A)',
  transition: 'width 0.4s ease',
}
const overallBarValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 600,
  color: '#D4B85A', minWidth: 50, textAlign: 'right',
}
const actionsPanel: React.CSSProperties = {
  padding: 18,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
  display: 'flex', flexDirection: 'column', gap: 10,
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textAlign: 'center',
}
const btnAccent: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 6,
  padding: '12px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textAlign: 'center',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
  textAlign: 'center',
}
const btnDanger: React.CSSProperties = {
  background: 'rgba(180,70,70,0.18)', color: '#C27070',
  border: '1px solid rgba(180,70,70,0.30)', borderRadius: 6,
  padding: '10px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
  textAlign: 'center', marginTop: 12,
}
const convertBlock: React.CSSProperties = {
  marginTop: 6, padding: '12px 14px',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 6,
  display: 'flex', flexDirection: 'column', gap: 6,
}
const inviteStatusBlock: React.CSSProperties = {
  marginTop: 6, padding: '12px 14px',
  background: 'rgba(122,176,122,0.06)', border: '1px solid rgba(122,176,122,0.22)',
  borderRadius: 6,
  display: 'flex', flexDirection: 'column', gap: 4,
}
function inviteStatusPill(kind: 'pending' | 'signed' | 'revoked'): React.CSSProperties {
  const palette = {
    pending: { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)', bd: 'rgba(212,184,90,0.40)' },
    signed:  { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
    revoked: { fg: '#C27070', bg: 'rgba(180,70,70,0.16)',   bd: 'rgba(180,70,70,0.40)' },
  }[kind]
  return {
    display: 'inline-block', padding: '4px 10px', borderRadius: 4,
    background: palette.bg, color: palette.fg, border: `1px solid ${palette.bd}`,
    fontFamily: "'Google Sans Code', monospace", fontSize: 10,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    width: 'fit-content',
  }
}
const inviteMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', lineHeight: 1.55,
}
const inviteSuccessBox: React.CSSProperties = {
  marginTop: 6, padding: '10px 14px',
  background: 'rgba(122,176,122,0.10)', border: '1px solid rgba(122,176,122,0.30)',
  borderRadius: 6, color: '#7AB07A',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, lineHeight: 1.55,
}
const inviteWarnBox: React.CSSProperties = {
  marginTop: 6, padding: '10px 14px',
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 6, color: '#D4B85A',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, lineHeight: 1.55,
}
const timelinePanel: React.CSSProperties = {
  padding: 18,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
}
const timelineList: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8,
  maxHeight: 400, overflowY: 'auto',
}
const timelineRow: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'flex-start',
}
const timelineDot: React.CSSProperties = {
  flex: '0 0 8px', width: 8, height: 8, borderRadius: 4,
  background: '#D4B85A', marginTop: 6,
}
const timelineBody: React.CSSProperties = { flex: 1 }
const timelineEvent: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.4,
}
const timelineMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.6, marginTop: 2, letterSpacing: '0.04em',
}
const timelineEmpty: React.CSSProperties = {
  padding: '14px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, fontStyle: 'italic',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
