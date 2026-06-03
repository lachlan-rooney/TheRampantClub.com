'use client'

import { use, useEffect, useState, useCallback, useMemo } from 'react'
import { ConfirmModal } from '@/components/admin/dialogs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  { key: 'cultural_fit',         label: 'Cultural Fit',         tip: 'Does the prospect align with the club\'s values and style?' },
  { key: 'social_compatibility', label: 'Social Compatibility', tip: 'Will they get on with existing members? Will they enhance the room?' },
  { key: 'commercial_potential', label: 'Commercial Potential', tip: 'How much will they contribute to revenue (bottle pours, events, hosting)?' },
  { key: 'whisky_interest',      label: 'Whisky Interest',      tip: 'Genuine connoisseur, casual enthusiast, or here for the room only?' },
  { key: 'brand_alignment',      label: 'Brand Alignment',      tip: 'Does the prospect uplift the club\'s reputation?' },
  { key: 'community_value',      label: 'Community Value',      tip: 'What unique relationships or perspective do they bring?' },
] as const

export default function ProspectDetail({ params }: { params: Promise<{ prospect_id: string }> }) {
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
      if (!r.ok) throw new Error(j.error || 'Save failed')
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
      if (!r.ok) throw new Error(j.error || 'Failed to allocate')
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
    if (!inviteEmail.trim()) { setError('Email required for invitation.'); return }
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
      if (!r.ok) throw new Error(j.error || 'Send failed')
      setSendResult({
        ok: j.email_sent,
        msg: j.email_sent
          ? `Invitation sent to ${inviteEmail.trim()}. Member ${j.member_no} created with status Pending Signature.`
          : `Invitation row created but email failed: ${j.email_error}. Link: ${j.link}`,
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
      if (!r.ok) throw new Error(j.error || 'Convert failed')
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
        throw new Error(j.error || 'Revoke failed')
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

  // Branded confirm modal — one state covers all three destructive paths.
  type Pending =
    | { kind: 'force_convert' }
    | { kind: 'archive' }
    | { kind: 'revoke'; invitation_id: string }
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const closeConfirm = () => { if (!confirmBusy) setPending(null) }
  const runPending = async () => {
    if (!pending) return
    setConfirmBusy(true)
    try {
      if (pending.kind === 'force_convert') await forceConvert()
      else if (pending.kind === 'revoke') await revokeInvitation(pending.invitation_id)
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

  if (loading) return <div style={emptyText}>Loading…</div>
  if (!prospect) return <div style={emptyText}>Prospect not found.</div>

  const scoreVals = SCORE_FIELDS.map(f => prospect[f.key as keyof Prospect] as number | null).filter(v => v != null) as number[]

  return (
    <>
      <Link href="/admin/mis/pipeline" style={backLink}>← Pipeline</Link>

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
              <div style={heroStatLabel}>Days in pipeline</div>
              <div style={heroStatValue}>{prospect.days_in_pipeline}</div>
            </div>
          )}
          {prospect.overall_score != null && (
            <div style={heroStat}>
              <div style={heroStatLabel}>Overall score</div>
              <div style={{ ...heroStatValue, color: '#D4B85A' }}>{Number(prospect.overall_score).toFixed(2)}</div>
            </div>
          )}
          {prospect.converted_member_no && (
            <Link href={`/admin/mis/${prospect.converted_member_no}`} style={heroStat}>
              <div style={heroStatLabel}>Member no.</div>
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
          ◆ Off-ramp · {prospect.stage} — <button onClick={() => patch({ stage: 'Lead' })} style={inlineBtn}>return to pipeline</button>
        </div>
      )}

      {/* Stage transition (also covers off-ramps) */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          Move to
        </span>
        <select value={prospect.stage} onChange={e => patch({ stage: e.target.value })} style={inputStyle}>
          {ALL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', marginLeft: 'auto', cursor: 'pointer' }}>
          <input type="checkbox" checked={prospect.letter_sent} onChange={e => patch({ letter_sent: e.target.checked })} />
          Letter sent
        </label>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={twoCol}>
        {/* MAIN COLUMN */}
        <div style={mainCol}>
          {/* Identity & Referral */}
          <Section title="Identity & referral">
            <Field label="Profession / sector" value={prospect.profession} onSave={v => patch({ profession: v })} />
            <Field label="Position / title" value={prospect.nickname} onSave={v => patch({ nickname: v })} />
            <Field label="Referred by" value={prospect.referred_by_name} onSave={v => patch({ referred_by_name: v })} />
            <Field label="Relationship" value={prospect.referral_relationship} onSave={v => patch({ referral_relationship: v })} />
            <SelectField label="Source channel" value={prospect.source_channel} options={['', ...SOURCES]} onSave={v => patch({ source_channel: v })} />
            <Field label="Contact info" value={prospect.contact_info} onSave={v => patch({ contact_info: v })} textarea />
          </Section>

          {/* Engagement */}
          <Section title="Engagement">
            <DateField label="First contact date" value={prospect.first_contact_date} onSave={v => patch({ first_contact_date: v })} />
            <DateField label="Last contact date" value={prospect.last_contact_date} onSave={v => patch({ last_contact_date: v })} />
            <Field label="Next action" value={prospect.next_action} onSave={v => patch({ next_action: v })} />
            <DateField label="Next action date" value={prospect.next_action_date} onSave={v => patch({ next_action_date: v })} />
            <Field label="Assigned to" value={prospect.assigned_to} onSave={v => patch({ assigned_to: v })} />
            <Field label="Notes" value={prospect.notes} onSave={v => patch({ notes: v })} textarea />
          </Section>

          {/* Interview */}
          <Section title="Interview">
            <DateField label="Interview date" value={prospect.interview_date} onSave={v => patch({ interview_date: v })} />
            <Field label="Interviewer" value={prospect.interviewer} onSave={v => patch({ interviewer: v })} />
            <Field label="Location" value={prospect.interview_location} onSave={v => patch({ interview_location: v })} />
            <Field label="Duration" value={prospect.interview_duration} onSave={v => patch({ interview_duration: v })} />
            <Field label="Interview notes" value={prospect.interview_notes} onSave={v => patch({ interview_notes: v })} textarea />
            <Field label="Red flags" value={prospect.red_flags} onSave={v => patch({ red_flags: v })} textarea />
          </Section>

          {/* Scoring rubric */}
          <Section title="Scoring rubric" subtitle="1–5 per dimension · overall = mean of populated">
            <div style={scoreGrid}>
              {SCORE_FIELDS.map(f => (
                <ScoreDial
                  key={f.key}
                  label={f.label}
                  tip={f.tip}
                  value={prospect[f.key as keyof Prospect] as number | null}
                  onSave={v => patch({ [f.key]: v })}
                />
              ))}
            </div>
            {prospect.overall_score != null && (
              <div style={overallBar}>
                <div style={overallBarLabel}>Overall</div>
                <div style={overallBarTrack}>
                  <div style={{ ...overallBarFill, width: `${(Number(prospect.overall_score) / 5) * 100}%` }} />
                </div>
                <div style={overallBarValue}>{Number(prospect.overall_score).toFixed(2)}</div>
              </div>
            )}
            <Field label="Diversity contribution" value={prospect.diversity_contribution} onSave={v => patch({ diversity_contribution: v })} textarea />
          </Section>

          {/* Decision */}
          <Section title="Decision">
            <SelectField label="Decision" value={prospect.decision} options={['', ...DECISIONS]} onSave={v => patch({ decision: v })} />
            <DateField label="Decision date" value={prospect.decision_date} onSave={v => patch({ decision_date: v })} />
            <Field label="Committee notes" value={prospect.committee_notes} onSave={v => patch({ committee_notes: v })} textarea />
          </Section>
        </div>

        {/* SIDEBAR */}
        <div style={sideCol}>
          <div style={actionsPanel}>
            <div style={panelLabel}>Actions</div>
            <button onClick={processTranscript} style={btnPrimary}>
              ◆ Process interview transcript →
            </button>
            {!prospect.converted_member_no && (
              <button onClick={async () => { await allocateMember() }} style={btnGhost}>
                Allocate provisional member no.
              </button>
            )}

            {/* Signing flow */}
            {prospect.stage !== 'Onboarded' && (
              <>
                {activeInvitation ? (
                  <div style={inviteStatusBlock}>
                    <div style={editLabel}>Invitation status</div>
                    <div style={inviteStatusPill('pending')}>
                      ✉ Pending · sent {fmtDate(activeInvitation.created_at)}
                    </div>
                    <div style={inviteMeta}>
                      To: <span style={{ color: '#E5D4C2' }}>{activeInvitation.email}</span>
                    </div>
                    {activeInvitation.viewed_at && (
                      <div style={inviteMeta}>
                        Viewed: <span style={{ color: '#D4B85A' }}>{fmtDate(activeInvitation.viewed_at)}</span>
                        {activeInvitation.view_count ? ` (${activeInvitation.view_count}×)` : ''}
                      </div>
                    )}
                    {!activeInvitation.viewed_at && (
                      <div style={{ ...inviteMeta, opacity: 0.5 }}>Not yet opened.</div>
                    )}
                    {activeInvitation.reminder_count ? (
                      <div style={inviteMeta}>
                        Reminders sent: {activeInvitation.reminder_count}
                        {activeInvitation.last_reminded_at && ` · last ${fmtDate(activeInvitation.last_reminded_at)}`}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => sendInvitation({ resend: true })} disabled={sending} style={{ ...btnGhost, padding: '8px 12px', flex: 1 }}>
                        {sending ? 'Sending…' : 'Resend email'}
                      </button>
                      <button onClick={() => copyLink(activeInvitation.token)} style={{ ...btnGhost, padding: '8px 12px' }}>
                        Copy link
                      </button>
                      <button onClick={() => setPending({ kind: 'revoke', invitation_id: activeInvitation.id })} style={{ ...btnGhost, padding: '8px 12px', color: '#C27070', borderColor: 'rgba(180,70,70,0.30)' }}>
                        Revoke
                      </button>
                    </div>
                  </div>
                ) : latestInvitation && latestInvitation.status === 'signed' ? (
                  <div style={inviteStatusBlock}>
                    <div style={editLabel}>Agreement</div>
                    <div style={inviteStatusPill('signed')}>
                      ✓ Signed · {fmtDate(latestInvitation.created_at)}
                    </div>
                    <div style={inviteMeta}>
                      Member <span style={{ color: '#7AB07A' }}>{latestInvitation.member_no || prospect.converted_member_no}</span> is Active.
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowInvite(s => !s)} style={btnAccent}>
                    {showInvite ? 'Cancel invitation' : '✉ Send signing invitation'}
                  </button>
                )}

                {showInvite && !activeInvitation && (
                  <div style={convertBlock}>
                    <div style={editLabel}>Tier</div>
                    <select value={conversionTier} onChange={e => setConversionTier(e.target.value)} style={inputStyle}>
                      {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={editLabel}>Email *</div>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="name@example.com"
                      style={inputStyle}
                    />
                    <div style={editLabel}>Mobile (optional)</div>
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
                      {sending ? 'Sending…' : 'Send invitation'}
                    </button>
                    <div style={{ ...inviteMeta, marginTop: 6 }}>
                      Creates a Pending Signature member, emails the signing link, and flips this prospect to Application Received. They become Active when they sign.
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
                  {showOverride ? '— hide override' : '★ Force convert without signing'}
                </button>
                {showOverride && (
                  <div style={convertBlock}>
                    <div style={inviteMeta}>
                      Skips the signing flow — member becomes Active immediately with no agreement on file. Use only when a paper agreement has been signed offline.
                    </div>
                    <div style={editLabel}>Tier</div>
                    <select value={conversionTier} onChange={e => setConversionTier(e.target.value)} style={inputStyle}>
                      {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={() => setPending({ kind: 'force_convert' })} disabled={converting} style={{ ...btnPrimary, marginTop: 8, width: '100%', background: 'rgba(180,70,70,0.30)' }}>
                      {converting ? 'Converting…' : 'Confirm force convert'}
                    </button>
                  </div>
                )}
              </>
            )}

            <button onClick={() => setPending({ kind: 'archive' })} style={btnDanger}>
              Archive prospect
            </button>
          </div>

          {/* Activity timeline */}
          <div style={timelinePanel}>
            <div style={panelLabel}>Activity</div>
            <div style={timelineList}>
              {activity.length === 0 ? (
                <div style={timelineEmpty}>No activity yet.</div>
              ) : activity.map(a => (
                <div key={a.id} style={timelineRow}>
                  <div style={timelineDot} />
                  <div style={timelineBody}>
                    <div style={timelineEvent}>{formatEvent(a)}</div>
                    <div style={timelineMeta}>
                      {a.actor || 'system'} · {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
        eyebrow={pending?.kind === 'force_convert' ? '⚠ ADMIN OVERRIDE'
          : pending?.kind === 'revoke' ? '⚠ REVOKE INVITATION'
          : '⚠ ARCHIVE PROSPECT'}
        title={pending?.kind === 'force_convert' ? 'Force convert without signing?'
          : pending?.kind === 'revoke' ? 'Revoke this invitation?'
          : 'Archive this prospect?'}
        subject={prospect?.full_name}
        body={pending?.kind === 'force_convert'
          ? `The member becomes Active immediately as ${conversionTier}, with no signed agreement on file. Admin override only — use when the agreement is handled outside the system.`
          : pending?.kind === 'revoke'
          ? 'The signing link stops working immediately. You can send a fresh invitation afterwards if needed.'
          : 'Hides the prospect from the pipeline. The record and its full activity trail are preserved for audit.'}
        confirmLabel={pending?.kind === 'force_convert' ? 'Force convert'
          : pending?.kind === 'revoke' ? 'Revoke invitation'
          : 'Archive prospect'}
        busyLabel="Working…"
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runPending}
      />
    </>
  )
}

function formatEvent(a: Activity): string {
  switch (a.event_type) {
    case 'created':            return `Prospect added · ${a.to_value}`
    case 'stage_changed':      return `Stage: ${a.from_value || '∅'} → ${a.to_value}`
    case 'source_changed':     return `Source: ${a.from_value || '∅'} → ${a.to_value || '∅'}`
    case 'decision_changed':   return `Decision: ${a.from_value || '∅'} → ${a.to_value || '∅'}`
    case 'letter_sent':        return 'Letter sent'
    case 'letter_unsent':      return 'Letter sent — undone'
    case 'scored':             return 'Score updated'
    case 'member_no_allocated':return `Provisional ${a.to_value} allocated`
    case 'invitation_sent':    return `Signing invitation sent · ${a.to_value}`
    case 'invitation_resent':  return `Signing invitation resent · ${a.to_value}`
    case 'signed':             return `Agreement signed${a.to_value ? ` · ${a.to_value} activated` : ''}`
    case 'converted':          return `Converted to member ${a.to_value}`
    case 'archived':           return 'Archived'
    case 'restored':           return 'Restored'
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
  return (
    <div style={fieldRow}>
      <div style={editLabel}>{label}</div>
      <select
        value={value || ''}
        onChange={e => onSave(e.target.value || null)}
        style={editInput}
      >
        {options.map(o => <option key={o} value={o}>{o || '— none —'}</option>)}
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
