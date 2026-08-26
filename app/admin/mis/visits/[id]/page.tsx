'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

// Admin / Intelligence / Members / Visit detail
//
// The Guardian Angel lifecycle for one visit: Overture (pre-arrival brief)
// → Accord (live observations + write contracts A/B) → Continuum
// (data_for_next_overture + close).

type Phase = 'overture' | 'accord' | 'continuum' | 'closed'

interface Visit {
  visit_id: string
  member_no: string
  visit_date: string
  phase: Phase
  space: string | null
  duration_min: number | null
  emotional_state: string | null
  notes: string | null
  logged_by: string | null
  archived_at: string | null
  overture_generated_at: string | null
  overture_generated_by: string | null
  arrival_time: string | null
  departure_time: string | null
  continuum_completed_at: string | null
  data_for_next_overture: string | null
  created_at: string
}

interface MemberLite {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  birthday: string | null
  join_date: string | null
}

interface PrefRow {
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
  ps_t: number
  needs_revalidation: string | null
  status: string
}

interface MemberStats {
  total_visits: number
  last_visit: string | null
  days_since_visit: number | null
  avg_visits_per_month: number | null
}

interface LastNote {
  visit_id: string
  visit_date: string
  data_for_next_overture: string
}

interface Brief {
  score5: PrefRow[]
  revalidate: PrefRow[]
  last_continuum_note: LastNote | null
}

interface OvertureResponse {
  visit: { visit_id: string; visit_date: string; overture_generated_at: string }
  member: MemberLite
  stats: MemberStats | null
  brief: Brief
  all_preferences: PrefRow[]
}

interface Observation {
  observation_id: string
  visit_id: string
  member_no: string
  category: string | null
  observation: string
  sentiment: 'excellence' | 'neutral' | 'grievance'
  score: number | null
  links_to_preference_id: string | null
  spawned_candidate: boolean
  logged_by: string | null
  created_at: string
}

const CATEGORIES = [
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
]
const SPACES = ['Lounge', 'Library', 'Bar', 'Cigar Terrace', 'Private Dining']

export default function VisitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLang()
  const { id } = use(params)
  const [visit, setVisit] = useState<Visit | null>(null)
  const [member, setMember] = useState<MemberLite | null>(null)
  const [stats, setStats] = useState<MemberStats | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [allPrefs, setAllPrefs] = useState<PrefRow[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [v, o] = await Promise.all([
        fetch(`/api/admin/mis/visits/${id}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/admin/mis/visits/${id}/overture`, { cache: 'no-store' }).then(r => r.json()),
      ])
      if (v.visit) setVisit(v.visit)
      if (v.member) setMember(v.member)
      if (v.observations) setObservations(v.observations)
      if (o.brief) setBrief(o.brief)
      if (o.stats) setStats(o.stats)
      if (o.all_preferences) setAllPrefs(o.all_preferences)
      if (o.member) setMember(o.member)
      setLoading(false)
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/admin/mis/visits/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [id, load])

  if (loading || !visit || !member) return <div style={emptyText}>{t('Loading visit…', 'Đang tải lượt ghé…')}</div>

  return (
    <>
      <Link href={`/admin/mis/${member.member_no}`} style={backLink}>← {member.full_name}</Link>

      {/* Hero */}
      <div style={hero}>
        <div>
          <div style={eyebrow}>{t('Visit', 'Lượt ghé')} · {visit.visit_date}</div>
          <h1 style={pageTitle}>{member.full_name}</h1>
          <div style={subtle}>
            {member.member_no} · {member.tier}
            {stats?.days_since_visit != null && (
              <> · {t('last visit', 'lần ghé gần nhất')} {stats.days_since_visit}d {t('ago', 'trước')}</>
            )}
            {stats?.total_visits != null && stats.total_visits > 0 && (
              <> · {stats.total_visits} {t('visits on file', 'lượt ghé đã lưu')}</>
            )}
          </div>
        </div>
        <PhaseRail current={visit.phase} />
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {/* OVERTURE */}
      <Section title={t('Overture · pre-arrival brief', 'Overture · tóm tắt trước khi đến')} subtitle={t('Assembled live from current data — never cached.', 'Tổng hợp trực tiếp từ dữ liệu hiện tại — không bao giờ lưu đệm.')}>
        {brief && <OvertureBody brief={brief} stats={stats} />}
        {visit.phase === 'overture' && (
          <div style={actionRow}>
            <button onClick={() => patch({ phase: 'accord' })} disabled={busy} style={btnPrimary}>
              {busy ? t('Saving…', 'Đang lưu…') : t('◆ Begin Accord →', '◆ Bắt đầu Accord →')}
            </button>
            <span style={hintText}>
              {t('Stamps arrival time and opens the live observation log.', 'Ghi lại giờ đến và mở nhật ký quan sát trực tiếp.')}
            </span>
          </div>
        )}
        {visit.phase !== 'overture' && (
          <div style={timestampStrip}>
            {visit.arrival_time && <span style={timestamp}>{t('Arrived', 'Đã đến')} {fmtTime(visit.arrival_time)}</span>}
            {visit.departure_time && <span style={timestamp}>{t('Departed', 'Đã rời')} {fmtTime(visit.departure_time)}</span>}
            {visit.continuum_completed_at && <span style={timestamp}>{t('Closed', 'Đã đóng')} {fmtTime(visit.continuum_completed_at)}</span>}
          </div>
        )}
      </Section>

      {/* ACCORD */}
      {(visit.phase === 'accord' || visit.phase === 'continuum' || visit.phase === 'closed') && (
        <Section title={t('Accord · Accord Notes', 'Accord · Ghi chú Accord')} subtitle={t('Observations captured during the visit. Each can confirm a preference, contradict it, or spawn a new candidate.', 'Các quan sát ghi nhận trong lượt ghé. Mỗi quan sát có thể xác nhận một sở thích, phủ nhận nó, hoặc tạo ra một ứng viên mới.')}>
          <ObservationList observations={observations} prefs={allPrefs} />
          {visit.phase === 'accord' && (
            <ObservationForm
              visit_id={id}
              prefs={allPrefs}
              revalidatePrefs={brief?.revalidate || []}
              onSubmitted={load}
            />
          )}
          {visit.phase === 'accord' && (
            <div style={actionRow}>
              <button onClick={() => patch({ phase: 'continuum' })} disabled={busy} style={btnPrimary}>
                {busy ? t('Saving…', 'Đang lưu…') : t('◆ Close out & enter Continuum →', '◆ Kết thúc & vào Continuum →')}
              </button>
              <span style={hintText}>{t('Stamps departure time. Observations are locked but can be reviewed.', 'Ghi lại giờ rời. Các quan sát bị khóa nhưng vẫn có thể xem lại.')}</span>
            </div>
          )}
        </Section>
      )}

      {/* CONTINUUM */}
      {(visit.phase === 'continuum' || visit.phase === 'closed') && (
        <ContinuumBlock visit={visit} busy={busy} onPatch={patch} />
      )}
    </>
  )
}

// ── PhaseRail ─────────────────────────────────────────────────────────
function PhaseRail({ current }: { current: Phase }) {
  const phases: Phase[] = ['overture', 'accord', 'continuum', 'closed']
  const idx = phases.indexOf(current)
  return (
    <div style={phaseRail}>
      {phases.map((p, i) => {
        const isCurrent = i === idx
        const isDone = i < idx
        return (
          <div key={p} style={{
            ...phaseChip,
            color: isCurrent ? '#D4B85A' : isDone ? '#7AB07A' : '#7E7864',
            background: isCurrent ? 'rgba(212,184,90,0.16)' : isDone ? 'rgba(122,176,122,0.10)' : 'transparent',
            border: '1px solid ' + (isCurrent ? 'rgba(212,184,90,0.50)' : isDone ? 'rgba(122,176,122,0.30)' : 'rgba(229,212,194,0.10)'),
          }}>
            {isDone ? '✓ ' : ''}{p}
          </div>
        )
      })}
    </div>
  )
}

// ── Overture body ─────────────────────────────────────────────────────
function OvertureBody({ brief, stats }: { brief: Brief; stats: MemberStats | null }) {
  return (
    <div style={overtureGrid}>
      {/* Score-5 non-negotiables */}
      <div>
        <div style={subHeader}>
          Non-negotiables · S₀=5
          <span style={countBadge}>{brief.score5.length}</span>
        </div>
        {brief.score5.length === 0 ? (
          <div style={emptyHint}>None recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brief.score5.map(p => (
              <div key={p.preference_id} style={prefRow}>
                <div style={prefName}>{p.preference_name}</div>
                {p.detail && <div style={prefDetail}>{p.detail}</div>}
                <div style={prefMeta}>
                  {p.category}{p.subcategory ? ` · ${p.subcategory}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revalidation queue */}
      <div>
        <div style={subHeader}>
          Confirm this visit · ⚠ REVALIDATE
          <span style={countBadge}>{brief.revalidate.length}</span>
        </div>
        {brief.revalidate.length === 0 ? (
          <div style={emptyHint}>Clear — no preferences need confirming.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brief.revalidate.map(p => (
              <div key={p.preference_id} style={{ ...prefRow, borderLeft: '2px solid #D4B85A' }}>
                <div style={prefName}>{p.preference_name}</div>
                {p.detail && <div style={prefDetail}>{p.detail}</div>}
                <div style={prefMeta}>
                  {p.category} · last validated {p.last_validated}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last continuum note */}
      <div>
        <div style={subHeader}>From the previous visit</div>
        {brief.last_continuum_note ? (
          <div style={lastNoteBox}>
            <div style={lastNoteText}>{brief.last_continuum_note.data_for_next_overture}</div>
            <div style={lastNoteMeta}>
              {brief.last_continuum_note.visit_date} ·
              <Link href={`/admin/mis/visits/${brief.last_continuum_note.visit_id}`} style={lastNoteLink}> open last visit →</Link>
            </div>
          </div>
        ) : (
          <div style={emptyHint}>No closed visit on file yet. This visit will be the first to feed the next Overture.</div>
        )}

        {stats && (
          <div style={{ marginTop: 14 }}>
            <div style={subHeader}>Engagement</div>
            <div style={statRow}>
              <span style={statLabel}>Visits on file</span>
              <span style={statValue}>{stats.total_visits ?? 0}</span>
            </div>
            <div style={statRow}>
              <span style={statLabel}>Avg / month</span>
              <span style={statValue}>{stats.avg_visits_per_month != null ? Number(stats.avg_visits_per_month).toFixed(2) : '—'}</span>
            </div>
            <div style={statRow}>
              <span style={statLabel}>Days since last</span>
              <span style={statValue}>{stats.days_since_visit ?? '—'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Observation list ──────────────────────────────────────────────────
function ObservationList({ observations, prefs }: { observations: Observation[]; prefs: PrefRow[] }) {
  if (observations.length === 0) return <div style={emptyHint}>No observations yet.</div>
  const prefByName = new Map(prefs.map(p => [p.preference_id, p.preference_name]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      {observations.map(o => (
        <div key={o.observation_id} style={{
          ...obsRow,
          borderLeft: `2px solid ${sentimentColor(o.sentiment)}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ ...sentimentPill, color: sentimentColor(o.sentiment), borderColor: sentimentColor(o.sentiment) + '50' }}>
              {sentimentLabel(o.sentiment)}
            </span>
            {o.category && <span style={metaPill}>{o.category}</span>}
            {o.score != null && <span style={scoreChip}>{o.score}/5</span>}
            {o.links_to_preference_id && (
              <span style={linkedPill}>
                ↳ {prefByName.get(o.links_to_preference_id) || 'preference'}
              </span>
            )}
            {o.spawned_candidate && <span style={candidatePill}>candidate</span>}
            <span style={{ marginLeft: 'auto', fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
              {fmtTime(o.created_at)} · {o.logged_by || 'unknown'}
            </span>
          </div>
          <div style={obsBody}>{o.observation}</div>
        </div>
      ))}
    </div>
  )
}

// ── Observation form (Accord live entry) ──────────────────────────────
function ObservationForm({ visit_id, prefs, revalidatePrefs, onSubmitted }: {
  visit_id: string
  prefs: PrefRow[]
  revalidatePrefs: PrefRow[]
  onSubmitted: () => void
}) {
  const [observation, setObservation] = useState('')
  const [category, setCategory] = useState('')
  const [sentiment, setSentiment] = useState<'excellence' | 'neutral' | 'grievance'>('neutral')
  const [score, setScore] = useState<string>('')
  const [mode, setMode] = useState<'free' | 'link' | 'candidate'>('free')
  const [linkPref, setLinkPref] = useState('')
  const [eventType, setEventType] = useState<'confirmed' | 'contradicted' | 'revised'>('confirmed')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const revalidateIds = useMemo(() => new Set(revalidatePrefs.map(p => p.preference_id)), [revalidatePrefs])

  const submit = useCallback(async () => {
    if (!observation.trim()) { setError('Observation text required.'); return }
    if (mode === 'link' && !linkPref) { setError('Pick a preference to link, or switch mode.'); return }
    setSubmitting(true); setError(null)
    try {
      const body: Record<string, unknown> = {
        observation, category: category || null, sentiment,
        score: score ? Number(score) : null,
      }
      if (mode === 'link') {
        body.links_to_preference_id = linkPref
        body.validation_event_type = eventType
      }
      if (mode === 'candidate') {
        body.spawn_candidate = true
        body.candidate = { suggested_category: category || null }
      }
      const r = await fetch(`/api/admin/mis/visits/${visit_id}/observations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      if (j.warnings && j.warnings.length) setError(`Saved with warnings: ${j.warnings.join('; ')}`)
      setObservation(''); setCategory(''); setSentiment('neutral'); setScore('')
      setMode('free'); setLinkPref(''); setEventType('confirmed')
      onSubmitted()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [observation, category, sentiment, score, mode, linkPref, eventType, visit_id, onSubmitted])

  return (
    <div style={formBlock}>
      <div style={subHeader}>Log an observation</div>
      {error && <div style={errorBox}>{error}</div>}

      <textarea
        value={observation}
        onChange={e => setObservation(e.target.value)}
        rows={3}
        placeholder="What did you notice? Be specific."
        style={{ ...inputStyle, resize: 'vertical' }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <div style={fieldGroup}>
          <div style={editLabel}>Category</div>
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={fieldGroup}>
          <div style={editLabel}>Sentiment</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['excellence', 'neutral', 'grievance'] as const).map(s => (
              <button key={s} onClick={() => setSentiment(s)} style={{
                ...sentimentToggle,
                color: sentiment === s ? sentimentColor(s) : '#B2AA98',
                borderColor: sentiment === s ? sentimentColor(s) : 'rgba(229,212,194,0.10)',
                background: sentiment === s ? sentimentColor(s) + '14' : 'transparent',
              }}>
                {sentimentLabel(s)}
              </button>
            ))}
          </div>
        </div>
        <div style={fieldGroup}>
          <div style={editLabel}>Score (optional)</div>
          <select value={score} onChange={e => setScore(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}/5</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={editLabel}>Link this observation to…</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {([
            ['free', 'Just an observation'],
            ['link', 'An existing preference'],
            ['candidate', 'A new candidate'],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              ...modeToggle,
              color: mode === k ? '#D4B85A' : '#B2AA98',
              borderColor: mode === k ? 'rgba(212,184,90,0.40)' : 'rgba(229,212,194,0.10)',
              background: mode === k ? 'rgba(212,184,90,0.10)' : 'transparent',
            }}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'link' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ ...fieldGroup, flex: 2 }}>
              <div style={editLabel}>Preference</div>
              <select value={linkPref} onChange={e => setLinkPref(e.target.value)} style={inputStyle}>
                <option value="">— pick —</option>
                {/* Revalidation candidates surface first */}
                {revalidatePrefs.length > 0 && (
                  <optgroup label="⚠ Revalidation flagged">
                    {revalidatePrefs.map(p => (
                      <option key={p.preference_id} value={p.preference_id}>{p.preference_name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Other active">
                  {prefs.filter(p => !revalidateIds.has(p.preference_id)).map(p => (
                    <option key={p.preference_id} value={p.preference_id}>{p.preference_name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div style={fieldGroup}>
              <div style={editLabel}>Effect</div>
              <select value={eventType} onChange={e => setEventType(e.target.value as 'confirmed' | 'contradicted' | 'revised')} style={inputStyle}>
                <option value="confirmed">Confirmed</option>
                <option value="contradicted">Contradicted</option>
                <option value="revised">Revised</option>
              </select>
            </div>
          </div>
        )}

        {mode === 'candidate' && (
          <div style={{ ...hintText, padding: '8px 10px', background: 'rgba(212,184,90,0.06)', borderRadius: 4 }}>
            Adds this observation as a candidate for a brand-new preference. An admin reviews the queue and either accepts it (and it lands in <code>preferences</code> with validation_count=1) or rejects it.
          </div>
        )}
      </div>

      <button onClick={submit} disabled={submitting || !observation.trim()} style={{ ...btnPrimary, marginTop: 12, opacity: !observation.trim() ? 0.4 : 1 }}>
        {submitting ? 'Saving…' : '＋ Add observation'}
      </button>
    </div>
  )
}

// ── Continuum block ───────────────────────────────────────────────────
function ContinuumBlock({ visit, busy, onPatch }: { visit: Visit; busy: boolean; onPatch: (b: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState(visit.data_for_next_overture || '')
  const [dirty, setDirty] = useState(false)
  const [notes, setNotes] = useState(visit.notes || '')
  const [notesDirty, setNotesDirty] = useState(false)

  return (
    <Section title="Continuum · close the loop" subtitle="The single most important field is data_for_next_overture — it becomes the opening line of the member's next Overture brief.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <div style={editLabel}>Wrap-up notes (optional)</div>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesDirty(true) }}
          onBlur={() => { if (notesDirty) { onPatch({ notes }); setNotesDirty(false) } }}
          rows={3}
          placeholder="Anything for the audit log — what worked, what didn't."
          disabled={visit.phase === 'closed'}
          style={{ ...inputStyle, resize: 'vertical', opacity: visit.phase === 'closed' ? 0.6 : 1 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={editLabel}>Data for the next Overture *</div>
        <textarea
          value={draft}
          onChange={e => { setDraft(e.target.value); setDirty(true) }}
          rows={5}
          placeholder="The single thread the team needs from tonight when this member walks back in. Example: 'Asked about Bowmore 25 — pre-pour a sample if we can get one in.'"
          disabled={visit.phase === 'closed'}
          style={{ ...inputStyle, resize: 'vertical', opacity: visit.phase === 'closed' ? 0.6 : 1 }}
        />
        <div style={{ ...hintText, marginTop: 4 }}>
          {draft.length.toLocaleString()} chars · feeds last_continuum_note → next Overture
        </div>
      </div>

      {visit.phase === 'continuum' && (
        <div style={actionRow}>
          <button
            onClick={() => onPatch({ data_for_next_overture: draft, phase: 'closed' })}
            disabled={busy || !draft.trim()}
            style={{ ...btnPrimary, opacity: !draft.trim() ? 0.4 : 1 }}
          >
            {busy ? 'Saving…' : '◆ Mark visit closed →'}
          </button>
          <span style={hintText}>Stamps continuum_completed_at and locks observations.</span>
        </div>
      )}
      {visit.phase === 'continuum' && dirty && (
        <button onClick={() => { onPatch({ data_for_next_overture: draft }); setDirty(false) }} style={btnGhost}>
          Save without closing
        </button>
      )}
      {visit.phase === 'closed' && (
        <div style={timestampStrip}>
          <span style={timestamp}>Closed {fmtTime(visit.continuum_completed_at!)}</span>
        </div>
      )}
    </Section>
  )
}

// ── small bits ────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={sectionBlock}>
      <div style={sectionHeader}>
        <div style={sectionTitle}>{title}</div>
        {subtitle && <div style={sectionSubtitle}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function sentimentColor(s: 'excellence' | 'neutral' | 'grievance'): string {
  return s === 'excellence' ? '#7AB07A' : s === 'grievance' ? '#C27070' : '#B2AA98'
}
function sentimentLabel(s: 'excellence' | 'neutral' | 'grievance'): string {
  return s === 'excellence' ? '★ Excellence' : s === 'grievance' ? '⚠ Grievance' : 'Neutral'
}

// ── styles ────────────────────────────────────────────────────────────
const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 18, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const hero: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 24, marginBottom: 24, flexWrap: 'wrap',
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const subtle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const phaseRail: React.CSSProperties = {
  display: 'flex', gap: 4,
}
const phaseChip: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.08em', textTransform: 'uppercase',
}
const sectionBlock: React.CSSProperties = {
  marginBottom: 28, padding: 20,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const sectionHeader: React.CSSProperties = { marginBottom: 14 }
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const sectionSubtitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7, marginTop: 4,
}
const subHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
}
const countBadge: React.CSSProperties = {
  background: 'rgba(212,184,90,0.20)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 10,
  padding: '1px 7px', fontSize: 9, fontWeight: 600,
}
const overtureGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 20,
}
const prefRow: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const prefName: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', fontWeight: 500,
}
const prefDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.5, marginTop: 3,
}
const prefMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em', marginTop: 4,
}
const lastNoteBox: React.CSSProperties = {
  padding: 12,
  background: 'rgba(122,176,122,0.08)',
  border: '1px solid rgba(122,176,122,0.25)',
  borderLeft: '3px solid #7AB07A',
  borderRadius: 4,
}
const lastNoteText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', lineHeight: 1.7, whiteSpace: 'pre-wrap',
}
const lastNoteMeta: React.CSSProperties = {
  marginTop: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const lastNoteLink: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'none', marginLeft: 4,
}
const statRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '6px 0', borderBottom: '1px solid rgba(229,212,194,0.06)',
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.06em',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', fontWeight: 500,
}
const actionRow: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
  marginTop: 14,
}
const hintText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7, letterSpacing: '0.04em',
}
const timestampStrip: React.CSSProperties = {
  display: 'flex', gap: 14, marginTop: 14,
  flexWrap: 'wrap',
}
const timestamp: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const obsRow: React.CSSProperties = {
  padding: '10px 12px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const obsBody: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', lineHeight: 1.6, whiteSpace: 'pre-wrap',
}
const sentimentPill: React.CSSProperties = {
  display: 'inline-block', padding: '1px 7px', borderRadius: 3,
  border: '1px solid',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
}
const metaPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '1px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
}
const scoreChip: React.CSSProperties = {
  background: 'rgba(212,184,90,0.10)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 3,
  padding: '1px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
}
const linkedPill: React.CSSProperties = {
  background: 'rgba(122,176,122,0.10)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 3,
  padding: '1px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
}
const candidatePill: React.CSSProperties = {
  background: 'rgba(158,143,196,0.10)', color: '#9E8FC4',
  border: '1px solid rgba(158,143,196,0.30)', borderRadius: 3,
  padding: '1px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
}
const formBlock: React.CSSProperties = {
  padding: 16,
  background: 'rgba(5,46,32,0.5)', border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 6,
}
const fieldGroup: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  flex: 1, minWidth: 140,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const sentimentToggle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 3, border: '1px solid',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.08em', cursor: 'pointer',
}
const modeToggle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 3, border: '1px solid',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.06em', cursor: 'pointer',
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
  marginTop: 8,
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyHint: React.CSSProperties = {
  padding: '14px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, fontStyle: 'italic',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
