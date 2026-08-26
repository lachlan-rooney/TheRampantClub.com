'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  computePSt, decayCurve,
  type PrefInputs, type MemberEngagement,
} from '@/lib/mis/live-pst'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { OBSERVATORY_SAMPLES, type SampleTranscript } from '@/lib/observatory-samples'
import { useLang } from '@/lib/admin-lang'

// Admin / Observatory
//
// A live, glass-box view of the Member Intelligence System's mathematics.
// Every number on this page traces to a real row or view; nothing is animated
// for show. Panel 1 (this turn) recomputes PS(t) client-side on a ~1s timer
// from stored inputs (λ, last_validated, validation_count, member visit
// cadence) using the SAME formulas as the preference_scores SQL view, so the
// number displayed equals the system's number — not a prettier approximation.
//
// Integer-day decay only steps at the UTC date boundary; the trajectory SVG
// shows the continuous curve the score is following, with a dot at the
// integer-day "today" — that's the system's value, the curve is where it's
// heading.

interface PreferenceRow {
  preference_id: string
  member_no: string
  category: string
  preference_name: string
  detail: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  validation_count: number
  last_validated: string | null
  lambda_origin: string | null
  status: string
}
interface MemberSummary {
  member_no: string
  full_name: string
  nickname: string | null
  avg_visits_per_month: number | null
  active_pref_count: number
}
interface LdcRow {
  id: string
  category: string
  designed_lambda: number
  learned_lambda: number
  lambda_ci_lower: number | null
  lambda_ci_upper: number | null
  n_events: number
  n_observations: number
  status: string | null
  ci_relative_width: number | null
  meets_event_floor: boolean | null
  ci_narrow_enough: boolean | null
  fit_timestamp: string
}
interface CategorySlice {
  category: string
  designed_lambda: number
  active: LdcRow | null
  latestProposal: LdcRow | null
  latestAny: LdcRow | null
}
interface Vitals {
  active_preferences: number
  total_exposure_days: number
  medical_locked: number
  flagged_for_revalidation: number
  lambda_origin_breakdown: Record<string, number>
  category_status_counts: { active: number; proposed: number; insufficient_data: number; no_fit_yet: number }
  total_validation_events: number
}
interface Snapshot {
  timestamp: string
  members: MemberSummary[]
  preferences: PreferenceRow[]
  categories: CategorySlice[]
  vitals: Vitals
}
// Panel 6 — Demo live-extraction types
interface DemoExtractedPref {
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  lambda_origin?:
    | 'ai_specific'
    | 'category_baseline_learned'
    | 'category_baseline_designed'
    | 'forced_medical'
    | 'forced_identity'
    | 'ai_permanent'
  rationale: string | RationaleDetail | null
  uid: string
}

// Per-factor rationale (mirrors lib/mis/extraction-decay.ts).
interface RationaleDetail {
  summary?: string
  s0?: string
  c?: string
  lambda?: string
  f?: string
}

/** Back-compat reader: handles both the legacy single-string rationale and
 *  the new per-factor object. Returns the summary line for callers that
 *  only need a one-liner (e.g. the consistency analyser's drill-down). */
function rationaleSummary(r: string | RationaleDetail | null | undefined): string {
  if (!r) return ''
  if (typeof r === 'string') return r
  return r.summary || ''
}

/** Per-factor rationale access — returns the rule-labelled or AI text for a
 *  given factor. Empty string when neither was supplied. */
function rationaleFactor(r: string | RationaleDetail | null | undefined, f: 's0' | 'c' | 'lambda' | 'f'): string {
  if (!r || typeof r === 'string') return ''
  return r[f] || ''
}

/** Whether a factor is rule-forced (i.e. its rationale came from code, not the
 *  AI). Used to show a 🔒 glyph on the line. */
function isFactorForced(origin: string | null | undefined, factor: 's0' | 'c' | 'lambda' | 'f'): boolean {
  if (factor === 'f') return false
  if (origin === 'forced_medical' || origin === 'forced_identity' || origin === 'ai_permanent') {
    return factor === 's0' || factor === 'c' || factor === 'lambda'
  }
  if (origin === 'category_baseline_designed' || origin === 'category_baseline_learned') {
    return factor === 'lambda'
  }
  return false
}
interface DemoReconciledSummary {
  count: number
  medicalForced: number
  identityForced: number
  aiPermanent: number
  dropped: { reason: string; item: { category?: string; preference_name?: string; verbatim_quote?: string } }[]
  baselines: Record<string, { baselineLambda: number; source: 'learned' | 'designed' }>
}
interface ConsistencyReport {
  verdict: 'stable' | 'judgment_variance' | 'safety_inconsistency'
  headline: string
  invariants: { preference: string; detail: string }[]
  variances: { preference: string; type: 'granularity' | 'judgment' | 'safety'; detail: string }[]
  counts: number[]
  synthesis: string
}

interface ProbeRun {
  id: string
  label: string                // sample id or "pasted"
  member_name: string
  transcript_snippet: string   // first ~120 chars for the run list
  transcript_hash?: string     // SHA-256[:16] of the FULL transcript. Optional only because
                               // session state from before this field was added may not have it;
                               // pre-existing runs without a hash are skipped in same-transcript
                               // gating (NOT backfilled — that reintroduces collision risk).
  preferences: DemoExtractedPref[]
  summary: DemoReconciledSummary
  ran_at: string               // ISO
  tokens: { input: number; output: number; cache_read: number; cache_created: number }
}

// SHA-256 of the full transcript, first 8 bytes as hex (16 chars). Web Crypto;
// the analyser uses hash equality as the "same transcript" gate so paste-runs
// and sample-runs both get a hard match.
async function sha256Hex16(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
type DemoPhase = 'idle' | 'streaming' | 'reconciling' | 'done' | 'error'

interface FeedEvent {
  id: string
  kind: 'validation' | 'preference_insert' | 'promotion'
  subtype: string | null
  timestamp: string
  member_no: string | null
  member_name: string | null
  category: string | null
  preference_id: string | null
  preference_name: string | null
  lambda: number | null
  lambda_origin: string | null
  learned_lambda: number | null
  designed_lambda: number | null
  days_since_last_validation: number | null
  is_demo_fixture: boolean
  loop_closure: boolean
}

const EVENT_FLOOR = 20
const DEMO_HOLD_SECONDS = 30
const POLL_INTERVAL_MS = 15_000
const REALTIME_SUBSCRIBE_TIMEOUT_MS = 3_000

type Transport = 'realtime' | 'polling' | 'probing'
type DemoGate = 'open' | 'closed' | 'probing'
type DemoState = 'idle' | 'promoting' | 'active' | 'reverting'

export default function ObservatoryPage() {
  const { t } = useLang()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [selectedPref, setSelectedPref] = useState<string | null>(null)
  const [tick, setTick] = useState(0)  // forces 1s recompute + countdown
  const [transport, setTransport] = useState<Transport>('probing')
  const [transportNote, setTransportNote] = useState<string>(t('probing supabase realtime…', 'đang dò supabase realtime…'))
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [demoGate, setDemoGate] = useState<DemoGate>('probing')
  const [demoState, setDemoState] = useState<DemoState>('idle')
  const [demoFixtureId, setDemoFixtureId] = useState<string | null>(null)
  const [demoCountdownEnd, setDemoCountdownEnd] = useState<number | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [demoCategory, setDemoCategory] = useState<string>('Whisky & Beverage')
  const [demoLambda, setDemoLambda] = useState<number>(0.002)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const demoFixtureIdRef = useRef<string | null>(null)
  useEffect(() => { demoFixtureIdRef.current = demoFixtureId }, [demoFixtureId])

  // Panel 6 — Demo live extraction state. Default to the first sample loaded
  // so the textarea has content on mount — otherwise the picker shows "Callum"
  // but the transcript is empty and the Run button is silently disabled.
  const initialSample = OBSERVATORY_SAMPLES[0]
  const [demoSampleId, setDemoSampleId] = useState<string>(initialSample?.id || '')
  const [demoTranscript, setDemoTranscript] = useState<string>(initialSample?.transcript || '')
  const [demoMemberName, setDemoMemberName] = useState<string>(initialSample?.member_name || 'Demo Member')
  const [demoExtracted, setDemoExtracted] = useState<DemoExtractedPref[]>([])
  const [demoSummary, setDemoSummary] = useState<DemoReconciledSummary | null>(null)
  const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle')
  const [demoExtractError, setDemoExtractError] = useState<string | null>(null)
  const [expandedRationales, setExpandedRationales] = useState<Set<string>>(new Set())
  const [probeRuns, setProbeRuns] = useState<ProbeRun[]>([])
  // Collapsible panels — persist state per-panel in localStorage so the user's
  // chosen layout survives reloads. Default everything OPEN (initial visit
  // sees the whole report); subsequent visits restore whatever was collapsed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem('observatory_collapsed_panels')
      if (raw) setCollapsed(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('observatory_collapsed_panels', JSON.stringify(collapsed)) }
    catch { /* ignore quota errors */ }
  }, [collapsed])
  const togglePanel = useCallback((id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])
  const isOpen = useCallback((id: string) => !collapsed[id], [collapsed])
  const collapseAll = useCallback(() => {
    setCollapsed({
      panel1: true, panel2: true, panel3: true, panel4: true,
      panel5: true, panel6: true, breadth: true,
    })
  }, [])
  const expandAll = useCallback(() => setCollapsed({}), [])

  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | null>(null)
  const [consistencyTriple, setConsistencyTriple] = useState<ProbeRun[] | null>(null)
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'analysing' | 'done' | 'error'>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [demoTokens, setDemoTokens] = useState<{ input: number; output: number; cache_read: number; cache_created: number }>({ input: 0, output: 0, cache_read: 0, cache_created: 0 })
  const [compareIds, setCompareIds] = useState<string[]>([])
  const demoAbortRef = useRef<AbortController | null>(null)

  const toggleRationale = useCallback((uid: string) => {
    setExpandedRationales(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid); else next.add(uid)
      return next
    })
  }, [])

  const loadDemoSample = useCallback((id: string) => {
    const s = OBSERVATORY_SAMPLES.find(x => x.id === id)
    if (!s) return
    setDemoSampleId(id)
    setDemoTranscript(s.transcript)
    setDemoMemberName(s.member_name)
  }, [])

  const cancelDemoRun = useCallback(() => {
    demoAbortRef.current?.abort()
    setDemoPhase('idle')
  }, [])

  const runDemoExtraction = useCallback(async () => {
    if (!demoTranscript.trim()) {
      setDemoExtractError(t('Paste a transcript or load a sample first.', 'Vui lòng dán một bản ghi hoặc tải một mẫu trước.'))
      return
    }
    setDemoExtractError(null)
    setDemoExtracted([])
    setDemoSummary(null)
    setDemoPhase('streaming')

    const controller = new AbortController()
    demoAbortRef.current = controller

    try {
      const r = await fetch('/api/admin/observatory/extract-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: demoTranscript, member_name: demoMemberName }),
        signal: controller.signal,
      })
      if (!r.ok || !r.body) {
        const txt = await r.text().catch(() => '')
        let msg = txt
        try { msg = JSON.parse(txt).error || txt } catch { /* keep txt */ }
        throw new Error(msg || `Request failed (${r.status})`)
      }
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let sep = buf.indexOf('\n\n')
        while (sep !== -1) {
          const raw = buf.slice(0, sep)
          buf = buf.slice(sep + 2)
          handleDemoFrame(raw)
          sep = buf.indexOf('\n\n')
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setDemoExtractError((e as Error).message)
      setDemoPhase('error')
    }

    function handleDemoFrame(raw: string) {
      let evt = 'message', data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) evt = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) return
      let payload: Record<string, unknown>
      try { payload = JSON.parse(data) } catch { return }

      switch (evt) {
        case 'status': {
          const ph = String(payload.phase || '')
          if (ph === 'reconciling') setDemoPhase('reconciling')
          break
        }
        case 'preference': {
          const p = payload.pref as Omit<DemoExtractedPref, 'uid' | 'lambda_origin'> | undefined
          if (!p) return
          setDemoExtracted(prev => [...prev, { ...p, rationale: p.rationale ?? null, uid: crypto.randomUUID() }])
          break
        }
        case 'reconciled': {
          const pref = (payload.preferences || []) as Array<{
            category: string; subcategory: string; preference_name: string; detail: string; verbatim_quote: string;
            s0: number; confidence: number; lambda: number; frequency: number;
            lambda_origin: DemoExtractedPref['lambda_origin']
            rationale?: string
          }>
          setDemoExtracted(pref.map(p => ({
            category: p.category,
            subcategory: p.subcategory || null,
            preference_name: p.preference_name,
            detail: p.detail || null,
            verbatim_quote: p.verbatim_quote || null,
            s0: p.s0, confidence: p.confidence, lambda: p.lambda, frequency: p.frequency,
            lambda_origin: p.lambda_origin,
            rationale: p.rationale ?? null,
            uid: crypto.randomUUID(),
          })))
          setDemoSummary({
            count: pref.length,
            medicalForced:  Number(payload.medicalForced)  || 0,
            identityForced: Number(payload.identityForced) || 0,
            aiPermanent:    Number(payload.aiPermanent)    || 0,
            dropped: (payload.dropped as DemoReconciledSummary['dropped']) || [],
            baselines: (payload.baselines as DemoReconciledSummary['baselines']) || {},
          })
          break
        }
        case 'usage': {
          setDemoTokens({
            input:         Number((payload as { input_tokens?: number }).input_tokens) || 0,
            output:        Number((payload as { output_tokens?: number }).output_tokens) || 0,
            cache_read:    Number((payload as { cache_read_input_tokens?: number }).cache_read_input_tokens) || 0,
            cache_created: Number((payload as { cache_creation_input_tokens?: number }).cache_creation_input_tokens) || 0,
          })
          break
        }
        case 'done':
          setDemoPhase('done')
          break
        case 'error':
          setDemoExtractError(String(payload.message || 'Unknown error'))
          setDemoPhase('error')
          break
      }
    }
  }, [demoTranscript, demoMemberName])

  // Capture each completed run for in-session compare. Cap at 10 — oldest drops.
  // Kept in React state only; gone on refresh. No persistence anywhere.
  useEffect(() => {
    if (demoPhase !== 'done' || !demoSummary) return
    let cancelled = false
    ;(async () => {
      const sample = OBSERVATORY_SAMPLES.find(s => s.id === demoSampleId)
      const label = sample ? sample.label : 'pasted transcript'
      const transcript_hash = await sha256Hex16(demoTranscript)
      if (cancelled) return
      const run: ProbeRun = {
        id: crypto.randomUUID(),
        label,
        member_name: demoMemberName,
        transcript_snippet: demoTranscript.slice(0, 140).replace(/\s+/g, ' ').trim(),
        transcript_hash,
        preferences: demoExtracted,
        summary: demoSummary,
        ran_at: new Date().toISOString(),
        tokens: demoTokens,
      }
      setProbeRuns(prev => {
        // Avoid re-capturing if the user is still on the same 'done' state and
        // demoExtracted hasn't changed (no shallow effect re-fire).
        if (prev[0]?.preferences === demoExtracted) return prev
        return [run, ...prev].slice(0, 10)
      })
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoPhase])

  const restoreRun = useCallback((id: string) => {
    const run = probeRuns.find(r => r.id === id)
    if (!run) return
    setDemoExtracted(run.preferences)
    setDemoSummary(run.summary)
    setDemoTokens(run.tokens)
    setDemoMemberName(run.member_name)
    setDemoPhase('done')
  }, [probeRuns])

  // ── Same-transcript triple detection ────────────────────────────────
  // Group captured runs by transcript_hash (skip undefined-hash runs — those
  // were captured before the field existed). Find the most-recently-active
  // group with ≥ 3 runs; that group's three most-recent runs are the
  // analyser's input.
  // If the user has explicitly checked 3 runs that share a transcript_hash,
  // the analyser uses those (manual override). Otherwise it falls back to the
  // auto-pick (most-recent matching triple). If 3 are checked but they span
  // multiple hashes, explicitTriple is null and the analyser button surfaces
  // a "selected runs span multiple transcripts" hint.
  const explicitTriple = useMemo<ProbeRun[] | null>(() => {
    if (compareIds.length !== 3) return null
    const picked = compareIds
      .map(id => probeRuns.find(r => r.id === id))
      .filter((r): r is ProbeRun => !!r && !!r.transcript_hash)
    if (picked.length !== 3) return null
    const hash = picked[0].transcript_hash
    if (!picked.every(r => r.transcript_hash === hash)) return null
    return picked
  }, [compareIds, probeRuns])

  const analysableTriple = useMemo<ProbeRun[] | null>(() => {
    const hashed = probeRuns.filter(r => !!r.transcript_hash)
    if (hashed.length < 3) return null
    const groups = new Map<string, ProbeRun[]>()
    for (const r of hashed) {
      const k = r.transcript_hash!
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(r)
    }
    const qualifying = [...groups.values()].filter(g => g.length >= 3)
    if (qualifying.length === 0) return null
    // Pick the group whose most-recent run is most recent overall.
    qualifying.sort((a, b) => (b[0]?.ran_at || '').localeCompare(a[0]?.ran_at || ''))
    // Each group's runs are already in reverse-chrono order (probeRuns is).
    return qualifying[0].slice(0, 3)
  }, [probeRuns])

  const runConsistencyAnalysis = useCallback(async () => {
    // Explicit selection (3 checkboxes sharing a hash) wins; else fall back
    // to the auto-pick of the most-recent matching triple.
    const triple = explicitTriple ?? analysableTriple
    if (!triple) return
    setAnalysisError(null)
    setConsistencyReport(null)
    setConsistencyTriple(null)
    setAnalysisPhase('analysing')
    // Snapshot the triple AT analysis time so the report stays bound to the
    // specific three runs that were analysed — even if the user captures more
    // runs afterwards (which would shift `analysableTriple`).
    const snapshot = triple
    try {
      const r = await fetch('/api/admin/observatory/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runs: snapshot }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `analysis failed (${r.status})`)
      setConsistencyReport(j as ConsistencyReport)
      setConsistencyTriple(snapshot)
      setAnalysisPhase('done')
    } catch (e) {
      setAnalysisError((e as Error).message)
      setAnalysisPhase('error')
    }
  }, [analysableTriple, explicitTriple])

  // 1s heartbeat — drives Panel 1 recompute AND the demo countdown.
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])

  // Snapshot loader, exposed so promote/revert can refresh on demand.
  const fetchSnapshot = useCallback(async (preserveSelection = true) => {
    try {
      const r = await fetch('/api/admin/observatory/snapshot', { cache: 'no-store' })
      const d = await r.json()
      if (d.error) { setError(d.error); return null }
      setSnap(d)
      if (!preserveSelection && d.members?.length) {
        setSelectedMember(d.members[0].member_no)
        const firstPref = d.preferences.find((p: PreferenceRow) => p.member_no === d.members[0].member_no)
        if (firstPref) setSelectedPref(firstPref.preference_id)
      }
      return d as Snapshot
    } catch (e) {
      setError(String(e))
      return null
    }
  }, [])

  // Events feed loader (full reload — used at mount and on poll tick).
  const fetchEvents = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/observatory/events?limit=100', { cache: 'no-store' })
      const d = await r.json()
      if (Array.isArray(d.events)) setEvents(d.events)
    } catch { /* ignore — keep previous feed */ }
  }, [])

  // Initial load + on-mount sweep of any stale fixtures.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Sweep first — clears anything a previous tab left behind. The sweep
      // call doubles as the demo-gate probe: 200 → gate open, 403 → closed.
      try {
        const r = await fetch('/api/admin/debug/decay-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sweep' }),
        })
        if (cancelled) return
        if (r.status === 403) setDemoGate('closed')
        else if (r.ok) setDemoGate('open')
        else setDemoGate('closed')
      } catch {
        if (!cancelled) setDemoGate('closed')
      }
      if (cancelled) return
      const d = await fetchSnapshot(false)
      if (cancelled || !d) return
      await fetchEvents()
    })()
    return () => { cancelled = true }
  }, [fetchSnapshot, fetchEvents])

  // Transport — Realtime subscription with timeout fallback to polling.
  // On a Realtime event we refetch the events feed (cheap) and, for LDC
  // changes, the snapshot (Panel 2/3/5 derive from it).
  useEffect(() => {
    let unsub: (() => void) | null = null
    let pollId: ReturnType<typeof setInterval> | null = null
    let resolved = false

    const fallback = (note: string) => {
      if (resolved) return
      resolved = true
      setTransport('polling')
      setTransportNote(note)
      pollId = setInterval(() => {
        fetchEvents()
        fetchSnapshot(true)
      }, POLL_INTERVAL_MS)
    }

    try {
      const sb = createBrowserSupabaseClient()
      const channel = sb.channel('observatory-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'preferences' }, () => {
          fetchEvents(); fetchSnapshot(true)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'validation_events' }, () => {
          fetchEvents(); fetchSnapshot(true)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'learned_decay_constants' }, () => {
          fetchEvents(); fetchSnapshot(true)
        })
        .subscribe(status => {
          if (resolved) return
          if (status === 'SUBSCRIBED') {
            resolved = true
            setTransport('realtime')
            setTransportNote(t('postgres_changes subscribed · live events arrive immediately', 'postgres_changes đã kết nối · sự kiện trực tiếp đến ngay lập tức'))
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            fallback(`realtime ${status.toLowerCase()} — ${t('falling back to 15s polling', 'chuyển sang thăm dò mỗi 15 giây')}`)
          }
        })
      unsub = () => { try { sb.removeChannel(channel) } catch { /* ignore */ } }
    } catch (e) {
      fallback(`${t('realtime init failed:', 'khởi tạo realtime thất bại:')} ${(e as Error).message} — ${t('polling 15s', 'thăm dò mỗi 15 giây')}`)
    }

    const timeoutId = setTimeout(
      () => fallback(t('realtime did not subscribe within 3s — polling 15s', 'realtime không kết nối trong 3 giây — thăm dò mỗi 15 giây')),
      REALTIME_SUBSCRIBE_TIMEOUT_MS
    )

    return () => {
      clearTimeout(timeoutId)
      if (unsub) unsub()
      if (pollId) clearInterval(pollId)
    }
  }, [fetchSnapshot, fetchEvents])

  // Demo countdown — checked every tick. Fires revert when countdown hits 0.
  const secondsLeft = useMemo(() => {
    if (!demoCountdownEnd) return null
    return Math.max(0, Math.ceil((demoCountdownEnd - Date.now()) / 1000))
  }, [demoCountdownEnd, tick])

  const revertDemo = useCallback(async () => {
    const id = demoFixtureIdRef.current
    if (!id) return
    setDemoState('reverting')
    try {
      const r = await fetch('/api/admin/debug/decay-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert', id }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `revert failed (${r.status})`)
      }
    } catch (e) {
      setDemoError((e as Error).message)
    } finally {
      setDemoFixtureId(null)
      setDemoCountdownEnd(null)
      setDemoState('idle')
      await Promise.all([fetchSnapshot(true), fetchEvents()])
    }
  }, [fetchSnapshot, fetchEvents])

  useEffect(() => {
    if (demoState === 'active' && secondsLeft === 0) {
      revertDemo()
    }
  }, [demoState, secondsLeft, revertDemo])

  // Revert any active demo on unmount — best-effort, can't await in cleanup.
  useEffect(() => {
    return () => {
      if (demoFixtureIdRef.current) {
        const id = demoFixtureIdRef.current
        try {
          // Use sendBeacon so the request survives the page unload.
          const body = new Blob([JSON.stringify({ action: 'revert', id })], { type: 'application/json' })
          navigator.sendBeacon?.('/api/admin/debug/decay-demo', body)
        } catch { /* ignore */ }
      }
    }
  }, [])

  const promoteDemo = useCallback(async () => {
    if (demoGate !== 'open') return
    setDemoError(null)
    setDemoState('promoting')
    try {
      const r = await fetch('/api/admin/debug/decay-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote', category: demoCategory, lambda: demoLambda }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `promote failed (${r.status})`)
      setDemoFixtureId(j.fixture_id)
      setDemoCountdownEnd(Date.now() + DEMO_HOLD_SECONDS * 1000)
      setDemoState('active')
      await Promise.all([fetchSnapshot(true), fetchEvents()])
    } catch (e) {
      setDemoError((e as Error).message)
      setDemoState('idle')
    }
  }, [demoCategory, demoLambda, demoGate, fetchSnapshot, fetchEvents])

  const memberPrefs = useMemo(() => {
    if (!snap || !selectedMember) return []
    return snap.preferences.filter(p => p.member_no === selectedMember)
  }, [snap, selectedMember])

  const selectedMemberObj = useMemo(() =>
    snap?.members.find(m => m.member_no === selectedMember) || null,
    [snap, selectedMember]
  )

  const focusPref = useMemo(() =>
    memberPrefs.find(p => p.preference_id === selectedPref) || memberPrefs[0] || null,
    [memberPrefs, selectedPref]
  )

  if (error) return <div style={errorBox}>{error}</div>
  if (!snap) return <div style={empty}>{t('Loading the live state…', 'Đang tải trạng thái trực tiếp…')}</div>

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rc-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes rc-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rc-reveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rc-safety-attention {
          0%   { transform: scale(0.99); box-shadow: 0 0 0 0 rgba(194,112,112,0); }
          40%  { transform: scale(1.005); box-shadow: 0 0 0 1px rgba(194,112,112,0.9), 0 0 28px rgba(194,112,112,0.55); }
          100% { transform: scale(1); box-shadow: 0 0 0 1px rgba(194,112,112,0.7), 0 0 22px rgba(194,112,112,0.45); }
        }
      ` }} />
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>{t('Intelligence · Live', 'Trí tuệ · Trực tiếp')}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={pageTitle}>{t('The Observatory', 'Đài Quan Sát')}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={collapseAll} style={collapseAllBtn} title={t('Collapse every panel', 'Thu gọn mọi bảng')}>{t('collapse all', 'thu gọn tất cả')}</button>
            <button onClick={expandAll}   style={collapseAllBtn} title={t('Expand every panel', 'Mở rộng mọi bảng')}>{t('expand all', 'mở rộng tất cả')}</button>
            <TransportPill transport={transport} note={transportNote} demoGate={demoGate} />
            <RefreshButton
              busy={refreshing}
              onClick={async () => {
                setRefreshing(true)
                try { await Promise.all([fetchSnapshot(true), fetchEvents()]) }
                finally { setRefreshing(false) }
              }}
            />
          </div>
        </div>
        <p style={lede}>
          {t("A live, glass-box view of the system's mathematics. Every figure on this page traces to a real row. PS(t) is recomputed client-side from the stored inputs (λ, ", "Góc nhìn trực tiếp, minh bạch về toán học của hệ thống. Mọi con số trên trang này đều truy ngược về một dòng dữ liệu thật. PS(t) được tính lại phía trình duyệt từ các đầu vào đã lưu (λ, ")}<code>last_validated</code>{t(", validation count, member visit cadence) by the same formulas as the ", ", số lần xác thực, nhịp ghé thăm của hội viên) bằng chính các công thức như ")}<code>preference_scores</code>{t(" SQL view, so the displayed number equals the system's number. The integer-day decay term only visibly steps at the UTC date boundary — the trajectory curve shows where the score is heading; the dot marks where it is now.", " (SQL view), nên con số hiển thị bằng đúng con số của hệ thống. Số hạng suy giảm theo ngày nguyên chỉ nhảy bước rõ rệt tại ranh giới ngày UTC — đường quỹ đạo cho thấy điểm số đang hướng tới đâu; chấm điểm đánh dấu vị trí hiện tại.")}
        </p>
      </div>

      {/* ─── Panel 1 — Live PS(t) decomposition ─── */}
      <CollapsiblePanel
        id="panel1"
        open={isOpen('panel1')}
        onToggle={() => togglePanel('panel1')}
        head={
          <div>
            <div style={panelEyebrow}>{t('Panel 1 · Live decomposition', 'Bảng 1 · Phân rã trực tiếp')}</div>
            <div style={panelTitle}>PS(t) = S₀ · C · e<sup>−λt</sup>{t(' · F · R · M, capped at 5', ' · F · R · M, giới hạn ở mức 5')}</div>
          </div>
        }
      >
        <div style={pickerRow}>
          <label style={pickerLabel}>
            {t('Member', 'Hội viên')}
            <select
              value={selectedMember || ''}
              onChange={e => {
                setSelectedMember(e.target.value)
                const first = snap.preferences.find(p => p.member_no === e.target.value)
                setSelectedPref(first?.preference_id || null)
              }}
              style={pickerInput}
            >
              {snap.members.map(m => (
                <option key={m.member_no} value={m.member_no}>
                  {m.full_name} · {m.active_pref_count} {t('prefs', 'sở thích')}
                </option>
              ))}
            </select>
          </label>
          <label style={pickerLabel}>
            {t('Preference', 'Sở thích')}
            <select
              value={selectedPref || ''}
              onChange={e => setSelectedPref(e.target.value)}
              style={pickerInput}
              disabled={memberPrefs.length === 0}
            >
              {memberPrefs.map(p => (
                <option key={p.preference_id} value={p.preference_id}>
                  [{p.category.slice(0, 14)}] {p.preference_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {focusPref ? (
          <Decomposition pref={focusPref} member={selectedMemberObj} />
        ) : (
          <div style={empty}>{t('This member has no active preferences.', 'Hội viên này chưa có sở thích đang hoạt động.')}</div>
        )}
      </CollapsiblePanel>

      {/* ─── Panel 2 — Category decay posteriors ─── */}
      <CollapsiblePanel
        id="panel2"
        open={isOpen('panel2')}
        onToggle={() => togglePanel('panel2')}
        head={
          <>
            <div>
              <div style={panelEyebrow}>{t('Panel 2 · Category posteriors', 'Bảng 2 · Hậu nghiệm theo danh mục')}</div>
              <div style={panelTitle}>{t('Designed prior vs learned posterior, 95% credible interval, distance to event floor', 'Tiên nghiệm thiết kế so với hậu nghiệm đã học, khoảng tin cậy 95%, khoảng cách đến ngưỡng sự kiện')}</div>
            </div>
            <div style={metaText}>
              {snap.vitals.category_status_counts.active} {t('active', 'đang hoạt động')} ·
              {' '}{snap.vitals.category_status_counts.proposed} {t('proposed', 'đề xuất')} ·
              {' '}{snap.vitals.category_status_counts.insufficient_data + snap.vitals.category_status_counts.no_fit_yet} {t('awaiting evidence', 'đang chờ bằng chứng')}
            </div>
          </>
        }
      >
        <CategoryPosteriorsTable categories={snap.categories} />
      </CollapsiblePanel>

      {/* ─── Panel 3 — Loop-closure / baseline inheritance ─── */}
      <CollapsiblePanel
        id="panel3"
        open={isOpen('panel3')}
        onToggle={() => togglePanel('panel3')}
        head={
          <>
            <div>
              <div style={panelEyebrow}>{t('Panel 3 · Loop-closure · baseline inheritance', 'Bảng 3 · Đóng vòng lặp · kế thừa mốc cơ sở')}</div>
              <div style={panelTitle}>{t('What a new extraction would inherit right now', 'Một trích xuất mới sẽ kế thừa gì ngay lúc này')}</div>
            </div>
            {demoGate === 'open' && demoState !== 'idle' && (
              <span style={demoActivePill}>
                {demoState === 'promoting' ? t('promoting…', 'đang thăng cấp…') :
                  demoState === 'reverting' ? t('reverting…', 'đang hoàn tác…') :
                    `DEMO ACTIVE · ${t('reverting in', 'hoàn tác sau')} ${secondsLeft}s`}
              </span>
            )}
          </>
        }
      >
        <p style={loopLede}>
          {t("For each canonical category, this is the λ a new preference inherits when the AI doesn't emit a preference-specific signal. The source is ", "Với mỗi danh mục chuẩn, đây là λ mà một sở thích mới kế thừa khi AI không phát ra tín hiệu riêng cho sở thích đó. Nguồn là ")}<code>learned</code>{t(" when an active row exists in ", " khi tồn tại một dòng đang hoạt động trong ")}<code> learned_decay_constants</code>{t(" for that category, else ", " cho danh mục đó, nếu không thì ")}<code>designed</code>{t(" (the prior centre from ", " (tâm tiên nghiệm từ ")}<code>lib/mis/decay-priors.ts</code>{t("). This is what ", "). Đây chính là giá trị mà ")}<code> buildCategoryBaselines(getActiveLearnedLambda(sb))</code>{t(" returns — the same call the intake route makes per request. Today every row reads ", " trả về — cùng lời gọi mà tuyến tiếp nhận thực hiện cho mỗi yêu cầu. Hôm nay mọi dòng đều đọc ")}<code>designed</code>{t(" because no proposal has been promoted yet.", " vì chưa có đề xuất nào được thăng cấp.")}
        </p>

        <BaselineTable categories={snap.categories} demoCategory={demoState === 'active' ? demoCategory : null} />

        {/* Demo affordance */}
        {demoGate === 'open' ? (
          <div style={demoBlock}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={demoEyebrow}>DEV FIXTURE</span>
              <span style={metaText}>
                {t('MIS_DEMO_ENABLED=1 detected. This promotes a real learned λ, shows what new extractions would inherit, then reverts. Not a mock.', 'Đã phát hiện MIS_DEMO_ENABLED=1. Thao tác này thăng cấp một λ đã học thực, cho thấy các trích xuất mới sẽ kế thừa gì, rồi hoàn tác. Không phải bản giả lập.')}
              </span>
            </div>
            <div style={demoControls}>
              <label style={pickerLabel}>
                {t('Category', 'Danh mục')}
                <select
                  value={demoCategory}
                  onChange={e => setDemoCategory(e.target.value)}
                  disabled={demoState !== 'idle'}
                  style={pickerInput}
                >
                  {snap.categories.map(c => (
                    <option key={c.category} value={c.category}>
                      {c.category} · {t('designed', 'thiết kế')} {c.designed_lambda.toFixed(3)}{c.active ? ` · ${t('already active', 'đã hoạt động')}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label style={pickerLabel}>
                {t('Learned λ', 'λ đã học')}
                <select
                  value={demoLambda}
                  onChange={e => setDemoLambda(Number(e.target.value))}
                  disabled={demoState !== 'idle'}
                  style={pickerInput}
                >
                  {[0.002, 0.005, 0.010, 0.020].map(v => (
                    <option key={v} value={v}>{v.toFixed(3)} · {t('half-life', 'chu kỳ bán rã')} {Math.round(Math.LN2 / v)}d</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                {demoState === 'idle' && (
                  <button onClick={promoteDemo} style={demoBtn}>
                    {t('Demonstrate the loop', 'Trình diễn vòng lặp')}
                  </button>
                )}
                {demoState === 'active' && (
                  <button onClick={revertDemo} style={demoBtnDanger}>
                    {t('Revert now', 'Hoàn tác ngay')}
                  </button>
                )}
                {(demoState === 'promoting' || demoState === 'reverting') && (
                  <button disabled style={{ ...demoBtn, opacity: 0.6 }}>…</button>
                )}
              </div>
            </div>
            {demoError && <div style={errorBox}>{demoError}</div>}
          </div>
        ) : demoGate === 'closed' ? (
          <div style={demoBlockClosed}>
            <span style={demoEyebrow}>DEV FIXTURE</span>
            <span style={metaText}>
              {' '}{t('Demo affordance disabled (', 'Tính năng demo đã tắt (')}<code>MIS_DEMO_ENABLED</code>{t(' not set to ', ' chưa được đặt bằng ')}<code>1</code>{t('). Baselines above are read-only; this guards production scoring from accidental promotion.', '). Các mốc cơ sở ở trên chỉ để đọc; điều này bảo vệ việc chấm điểm sản xuất khỏi bị thăng cấp nhầm.')}
            </span>
          </div>
        ) : null}
      </CollapsiblePanel>

      {/* ─── Panel 4 — Live event stream + loop-closure ticker ─── */}
      <CollapsiblePanel
        id="panel4"
        open={isOpen('panel4')}
        onToggle={() => togglePanel('panel4')}
        head={
          <>
            <div>
              <div style={panelEyebrow}>{t('Panel 4 · Live event stream', 'Bảng 4 · Luồng sự kiện trực tiếp')}</div>
              <div style={panelTitle}>{t('Scoring events as they happen, with the mathematical consequence of each', 'Các sự kiện chấm điểm ngay khi diễn ra, kèm hệ quả toán học của từng sự kiện')}</div>
            </div>
            <div style={metaText}>
              {events.length === 0
                ? `${t('watching…', 'đang theo dõi…')} ${transport === 'realtime' ? t('Realtime subscribed', 'Realtime đã kết nối') : transport === 'polling' ? t('polling every 15s', 'thăm dò mỗi 15 giây') : t('probing transport', 'đang dò kênh truyền')}`
                : `${events.length} ${t('event', 'sự kiện')}${events.length === 1 ? '' : t('s', '')} · ${t('loop-closure:', 'đóng vòng lặp:')} ${events.filter(e => e.loop_closure).length}`}
            </div>
          </>
        }
      >
        <EventStream events={events} transport={transport} />
      </CollapsiblePanel>

      {/* ─── Panel 5 — Aggregate vitals ─── */}
      <CollapsiblePanel
        id="panel5"
        open={isOpen('panel5')}
        onToggle={() => togglePanel('panel5')}
        head={
          <div>
            <div style={panelEyebrow}>{t('Panel 5 · Aggregate vitals', 'Bảng 5 · Chỉ số tổng hợp')}</div>
            <div style={panelTitle}>{t('What the system holds right now', 'Những gì hệ thống đang nắm giữ ngay lúc này')}</div>
          </div>
        }
      >
        <VitalsGrid vitals={snap.vitals} />
      </CollapsiblePanel>

      {/* ─── Panel 6 — Demo · Live extraction (gated, saves nothing) ─── */}
      <CollapsiblePanel
        id="panel6"
        open={isOpen('panel6')}
        onToggle={() => togglePanel('panel6')}
        head={
          <>
            <div>
              <div style={panelEyebrow}>{t('Panel 6 · Demo · Live extraction', 'Bảng 6 · Demo · Trích xuất trực tiếp')}</div>
              <div style={panelTitle}>{t('Paste a transcript, watch the system extract preferences in real time', 'Dán một bản ghi, xem hệ thống trích xuất sở thích theo thời gian thực')}</div>
            </div>
            {demoGate === 'open' && demoPhase !== 'idle' && demoPhase !== 'done' && (
              <span style={demoActivePill}>{demoPhase === 'streaming' ? t('extracting…', 'đang trích xuất…') : demoPhase === 'reconciling' ? t('reconciling…', 'đang đối chiếu…') : t('error', 'lỗi')}</span>
            )}
          </>
        }
      >
        <p style={loopLede}>
          {t('Demo runs the same engine as the live intake — same ', 'Demo chạy cùng bộ máy như tuyến tiếp nhận trực tiếp — cùng ')}<code>buildSystemPrompt</code>{t(', same ', ', cùng ')}<code> reconcile</code>{t(' from ', ' từ ')}<code>lib/mis/extraction-decay.ts</code>{t(', same Claude model, same SSE streaming. The only difference: there is no save path. Nothing reaches the database. ', ', cùng mô hình Claude, cùng luồng SSE. Khác biệt duy nhất: không có đường lưu. Không gì chạm tới cơ sở dữ liệu. ')}<strong style={{ color: '#E5D4C2' }}>{t('Demo runs on sample data. Nothing is saved.', 'Demo chạy trên dữ liệu mẫu. Không có gì được lưu.')}</strong>
        </p>

        {demoGate === 'open' ? (
          <>
            <DemoExtractionPanel
              sampleId={demoSampleId}
              samples={OBSERVATORY_SAMPLES}
              transcript={demoTranscript}
              memberName={demoMemberName}
              phase={demoPhase}
              extracted={demoExtracted}
              summary={demoSummary}
              error={demoExtractError}
              expandedRationales={expandedRationales}
              onToggleRationale={toggleRationale}
              onLoadSample={loadDemoSample}
              onTranscriptChange={setDemoTranscript}
              onMemberNameChange={setDemoMemberName}
              onRun={runDemoExtraction}
              onCancel={cancelDemoRun}
            />
            {probeRuns.length > 0 && (
              <ProbeRunsStrip
                runs={probeRuns}
                onRestore={restoreRun}
                compareIds={compareIds}
                onCompareToggle={(id) => setCompareIds(prev => {
                  if (prev.includes(id)) return prev.filter(x => x !== id)
                  // Cap at 3: 2 selected → 2-up compare; 3 selected → consistency
                  // analyser uses these instead of the auto-pick.
                  if (prev.length >= 3) return prev
                  return [...prev, id]
                })}
              />
            )}
            {probeRuns.length > 0 && (
              <ConsistencyControl
                triple={explicitTriple ?? analysableTriple}
                source={explicitTriple ? 'explicit' : analysableTriple ? 'auto' : null}
                explicitMismatch={compareIds.length === 3 && explicitTriple === null}
                phase={analysisPhase}
                error={analysisError}
                onRun={runConsistencyAnalysis}
              />
            )}
            {consistencyReport && consistencyTriple && (
              <ConsistencyReportView report={consistencyReport} triple={consistencyTriple as [ProbeRun, ProbeRun, ProbeRun]} />
            )}
            {compareIds.length === 2 && (
              <ProbeCompareView
                a={probeRuns.find(r => r.id === compareIds[0])!}
                b={probeRuns.find(r => r.id === compareIds[1])!}
                onClose={() => setCompareIds([])}
              />
            )}
          </>
        ) : (
          <div style={demoBlockClosed}>
            <span style={demoEyebrow}>DEMO SURFACE</span>
            <span style={metaText}>
              {' '}{t('Demo affordance disabled (', 'Tính năng demo đã tắt (')}<code>MIS_DEMO_ENABLED</code>{t(' not set to ', ' chưa được đặt bằng ')}<code>1</code>{t('). When enabled, this panel runs the live extraction pipeline on a bundled fictional transcript and streams the result here. No database write of any kind.', '). Khi bật, bảng này chạy quy trình trích xuất trực tiếp trên một bản ghi hư cấu đi kèm và truyền kết quả về đây. Không ghi cơ sở dữ liệu dưới bất kỳ hình thức nào.')}
            </span>
          </div>
        )}
      </CollapsiblePanel>

      {/* ─── Breadth table — all active preferences ─── */}
      <CollapsiblePanel
        id="breadth"
        open={isOpen('breadth')}
        onToggle={() => togglePanel('breadth')}
        head={
          <>
            <div>
              <div style={panelEyebrow}>{t('Breadth · all', 'Toàn diện · tất cả')} {snap.preferences.length} {t('active preferences', 'sở thích đang hoạt động')}</div>
              <div style={panelTitle}>{t('Current PS(t) across the live profile', 'PS(t) hiện tại trên toàn hồ sơ trực tiếp')}</div>
            </div>
            <div style={metaText}>
              {t('snapshot:', 'ảnh chụp:')} {new Date(snap.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </>
        }
      >
        <BreadthTable preferences={snap.preferences} members={snap.members} onPick={(memberNo, prefId) => {
          setSelectedMember(memberNo)
          setSelectedPref(prefId)
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
        }} />
      </CollapsiblePanel>
    </>
  )
}

// ─── Decomposition card + trajectory SVG ─────────────────────────────────────

function Decomposition({ pref, member }: { pref: PreferenceRow; member: MemberSummary | null }) {
  const { t } = useLang()
  const inputs: PrefInputs = {
    s0: pref.s0,
    confidence: pref.confidence,
    lambda: pref.lambda,
    frequency: pref.frequency,
    validationCount: pref.validation_count,
    lastValidatedISO: pref.last_validated || new Date().toISOString().slice(0, 10),
  }
  const engagement: MemberEngagement = { avgVisitsPerMonth: member?.avg_visits_per_month ?? null }
  const r = computePSt(inputs, engagement)
  const curve = useMemo(() => decayCurve(inputs, engagement, 365, 1), [
    inputs.s0, inputs.confidence, inputs.lambda, inputs.frequency,
    inputs.validationCount, inputs.lastValidatedISO,
    engagement.avgVisitsPerMonth,
  ])

  const factorRow = (label: string, value: string, note?: string, accent?: string) => (
    <div style={factorRowStyle}>
      <div style={factorLabel}>{label}</div>
      <div style={{ ...factorValue, color: accent || '#E5D4C2' }}>{value}</div>
      {note && <div style={factorNote}>{note}</div>}
    </div>
  )

  return (
    <div style={decompGrid}>
      <div style={decompLeft}>
        <div style={{ marginBottom: 12 }}>
          <div style={prefCategoryBadge}>{pref.category}</div>
          {pref.lambda_origin && <span style={originPill(pref.lambda_origin)}>{pref.lambda_origin.replace(/_/g, ' ')}</span>}
        </div>
        <div style={prefName}>{pref.preference_name}</div>
        {pref.detail && <div style={prefDetail}>{pref.detail}</div>}

        <div style={factorList}>
          {factorRow(t('S₀ — importance', 'S₀ — mức quan trọng'), pref.s0.toString())}
          {factorRow(t('C — confidence', 'C — độ tin cậy'), pref.confidence.toFixed(2))}
          {factorRow(t('e^(−λt) — decay', 'e^(−λt) — suy giảm'), r.decay.toFixed(4), `λ=${pref.lambda.toFixed(3)} · t=${r.daysSince}d ${t('(integer)', '(số nguyên)')}`)}
          {factorRow(t('F — frequency', 'F — tần suất'), pref.frequency.toFixed(1))}
          {factorRow(t('R — reinforcement', 'R — củng cố'), r.reinforcement.toFixed(3), `vc=${pref.validation_count} · ${t('cap', 'giới hạn')} 1.30`)}
          {factorRow(t('M — engagement', 'M — mức gắn kết'), r.engagement.toFixed(3),
            member?.avg_visits_per_month != null
              ? `${t('avg', 'tb')} ${member.avg_visits_per_month.toFixed(2)} ${t('visits/mo', 'lượt/tháng')}`
              : t('no visit history → neutral 1.0', 'chưa có lịch sử ghé thăm → trung tính 1.0')
          )}
        </div>

        <div style={resultRow}>
          <div>
            <div style={factorLabel}>{t('raw product', 'tích thô')}</div>
            <div style={resultMid}>{r.rawProduct.toFixed(4)}</div>
          </div>
          <div>
            <div style={factorLabel}>{t('PS(t) · capped at 5', 'PS(t) · giới hạn ở 5')}</div>
            <div style={resultBig}>{r.pst.toFixed(3)}</div>
          </div>
          <div>
            <div style={factorLabel}>{t('0.7·S₀ threshold', 'ngưỡng 0.7·S₀')}</div>
            <div style={resultMid}>{(0.7 * pref.s0).toFixed(2)}</div>
          </div>
        </div>

        <div style={flagRow}>
          {r.capped && <span style={flagPill('gold')}>{t('cap binds — raw', 'giới hạn tác động — thô')} {r.rawProduct.toFixed(2)} {'>'} 5</span>}
          {r.needsRevalidation && <span style={flagPill('red')}>{t('flagged for revalidation', 'đã đánh dấu cần tái xác thực')}</span>}
          {pref.lambda === 0 && <span style={flagPill('red')}>{t('medical · no decay', 'y tế · không suy giảm')}</span>}
          {!r.capped && !r.needsRevalidation && pref.lambda > 0 && <span style={flagPill('green')}>{t('healthy · within band', 'ổn định · trong biên độ')}</span>}
        </div>
      </div>

      <div style={decompRight}>
        <TrajectoryChart
          curve={curve}
          s0={pref.s0}
          currentPst={r.pst}
          daysSince={r.daysSince}
        />
        <div style={chartCaption}>
          {t('Trajectory', 'Quỹ đạo')} · {pref.lambda > 0 ? `${t('half-life ≈', 'chu kỳ bán rã ≈')} ${Math.round(Math.LN2 / pref.lambda)}d` : t('no decay', 'không suy giảm')}
          {' · '}{t('horizon 365d · dot = today (integer-day score)', 'tầm nhìn 365 ngày · chấm = hôm nay (điểm theo ngày nguyên)')}
        </div>
      </div>
    </div>
  )
}

// ─── Trajectory SVG ──────────────────────────────────────────────────────────

function TrajectoryChart({
  curve, s0, currentPst, daysSince,
}: {
  curve: { points: { day: number; pst: number }[]; todayIndex: number }
  s0: number
  currentPst: number
  daysSince: number
}) {
  const { t } = useLang()
  const W = 460, H = 220
  const padL = 36, padR = 12, padT = 14, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxDay = curve.points[curve.points.length - 1]?.day || 1
  const yMax = 5
  const x = (d: number) => padL + (d / maxDay) * innerW
  const y = (v: number) => padT + (1 - v / yMax) * innerH

  const pathD = curve.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.pst).toFixed(1)}`)
    .join(' ')

  const threshold = 0.7 * s0
  const todayX = x(daysSince)
  const todayY = y(currentPst)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {/* y-axis ticks */}
      {[0, 1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="rgba(229,212,194,0.06)" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 4} fill="#7E7864" fontSize="9" textAnchor="end" fontFamily="Google Sans Code, monospace">{v}</text>
        </g>
      ))}
      {/* x-axis ticks */}
      {[0, 90, 180, 270, 365].map(d => d <= maxDay && (
        <g key={d}>
          <line x1={x(d)} y1={padT} x2={x(d)} y2={H - padB} stroke="rgba(229,212,194,0.04)" strokeWidth={1} />
          <text x={x(d)} y={H - padB + 14} fill="#7E7864" fontSize="9" textAnchor="middle" fontFamily="Google Sans Code, monospace">{d}d</text>
        </g>
      ))}
      {/* 0.7·S0 threshold */}
      <line x1={padL} y1={y(threshold)} x2={W - padR} y2={y(threshold)}
            stroke="#C27070" strokeWidth={1} strokeDasharray="3 4" opacity={0.85} />
      <text x={W - padR - 4} y={y(threshold) - 4} fill="#C27070" fontSize="9" textAnchor="end" fontFamily="Google Sans Code, monospace">
        0.7·S₀ = {threshold.toFixed(2)} {t('(revalidation line)', '(đường tái xác thực)')}
      </text>
      {/* trajectory */}
      <path d={pathD} fill="none" stroke="#D4B85A" strokeWidth={1.5} />
      {/* today line + dot */}
      <line x1={todayX} y1={padT} x2={todayX} y2={H - padB} stroke="rgba(212,184,90,0.30)" strokeWidth={1} />
      <circle cx={todayX} cy={todayY} r={4.5} fill="#E5D4C2" stroke="#052E20" strokeWidth={1.5} />
      <text x={todayX + 8} y={todayY - 6} fill="#E5D4C2" fontSize="10" fontFamily="Google Sans Code, monospace">
        {t('today', 'hôm nay')} · {currentPst.toFixed(2)}
      </text>
    </svg>
  )
}

// ─── Transport pill — honest about how the page receives updates ────────────

function TransportPill({ transport, note, demoGate }: {
  transport: Transport; note: string; demoGate: DemoGate
}) {
  const { t } = useLang()
  const tone = transport === 'realtime' ? 'green' : transport === 'polling' ? 'gold' : 'grey'
  const label = transport === 'realtime' ? t('live · Realtime', 'trực tiếp · Realtime')
    : transport === 'polling'  ? t('live · polling 15s', 'trực tiếp · thăm dò 15 giây')
    : t('probing transport…', 'đang dò kênh truyền…')
  return (
    <>
      <span style={transportPill(tone)} title={note}>
        <span style={transportDot(tone)} />
        {label}
      </span>
      {demoGate === 'open' && (
        <span style={demoGatePill}>MIS_DEMO_ENABLED=1</span>
      )}
    </>
  )
}

// ─── Refresh button — manual snapshot + events reload ───────────────────────

function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  const { t } = useLang()
  return (
    <button onClick={onClick} disabled={busy} style={refreshBtn}>
      <span style={refreshGlyph(busy)}>↻</span>
      {busy ? t('refreshing…', 'đang làm mới…') : t('refresh', 'làm mới')}
    </button>
  )
}

// ─── Panel 3 — Baseline inheritance table ────────────────────────────────────

function BaselineTable({ categories, demoCategory }: {
  categories: CategorySlice[]
  demoCategory: string | null
}) {
  const { t } = useLang()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 14 }}>
      {categories.map(c => {
        const learned = c.active?.learned_lambda
        const liveLambda = learned ?? c.designed_lambda
        const source: 'learned' | 'designed' = learned != null ? 'learned' : 'designed'
        const isDemoTarget = demoCategory === c.category
        return (
          <div key={c.category} style={{
            ...baselineCard,
            ...(isDemoTarget ? {
              borderColor: 'rgba(122,176,122,0.55)',
              background: 'rgba(122,176,122,0.06)',
              boxShadow: '0 0 0 1px rgba(122,176,122,0.30)',
            } : {}),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={catName}>{c.category}</div>
              <span style={originPill(`category_baseline_${source}`)}>
                {source === 'learned' ? t('learned', 'đã học') : t('designed', 'thiết kế')}
                {isDemoTarget && t(' ← FLIPPED', ' ← ĐÃ LẬT')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'baseline' }}>
              <div>
                <div style={miniLabel}>{t('baseline λ', 'λ cơ sở')}</div>
                <div style={{ ...posteriorBig, color: source === 'learned' ? '#7AB07A' : '#E5D4C2' }}>
                  {liveLambda.toFixed(4)}
                </div>
              </div>
              <div>
                <div style={miniLabel}>{t('half-life', 'chu kỳ bán rã')}</div>
                <div style={posteriorBig}>{Math.round(Math.LN2 / liveLambda)}d</div>
              </div>
            </div>
            {source === 'designed' && (
              <div style={metaText}>{t('from', 'từ')} <code>decay-priors.ts</code></div>
            )}
            {source === 'learned' && c.active && (
              <div style={metaText}>
                {t('designed was', 'thiết kế trước là')} {c.designed_lambda.toFixed(4)} · {t('promoted', 'thăng cấp')} {new Date(c.active.fit_timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {c.active.n_events > 0 && ` · d=${c.active.n_events}`}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Panel 2 — Category posteriors ───────────────────────────────────────────

function CategoryPosteriorsTable({ categories }: { categories: CategorySlice[] }) {
  const { t } = useLang()
  // Visualisation scale for the CI rail: max λ across all categories' priors and CIs,
  // capped so a wide posterior doesn't squash the others.
  const lambdaScaleMax = Math.max(
    0.025,
    ...categories.map(c => c.latestAny?.lambda_ci_upper ?? c.designed_lambda),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {categories.map(c => {
        const latest = c.active || c.latestProposal || c.latestAny
        const statusKey = c.active
          ? 'active'
          : latest?.status === 'proposed' ? 'proposed'
          : latest?.status === 'insufficient_data' ? 'insufficient_data'
          : 'no_fit_yet'

        const nEvents = latest?.n_events ?? 0
        const floorPct = Math.min(100, (nEvents / EVENT_FLOOR) * 100)
        const liveLambda = c.active?.learned_lambda ?? c.designed_lambda
        const halfLifeLive = liveLambda > 0 ? Math.round(Math.LN2 / liveLambda) : null

        const designedX  = (c.designed_lambda / lambdaScaleMax) * 100
        const posteriorX = ((latest?.learned_lambda ?? c.designed_lambda) / lambdaScaleMax) * 100
        const ciLoX = latest?.lambda_ci_lower != null ? (latest.lambda_ci_lower / lambdaScaleMax) * 100 : null
        const ciHiX = latest?.lambda_ci_upper != null ? (latest.lambda_ci_upper / lambdaScaleMax) * 100 : null

        return (
          <div key={c.category} style={posteriorCard}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <div style={catName}>{c.category}</div>
              <span style={posteriorStatusPill(statusKey)}>{statusKey.replace(/_/g, ' ')}</span>
              {halfLifeLive != null && (
                <span style={metaText}>{t('live', 'trực tiếp')} λ={liveLambda.toFixed(4)} · {t('half-life', 'chu kỳ bán rã')} {halfLifeLive}d</span>
              )}
            </div>

            <div style={posteriorGrid}>
              <div>
                <div style={miniLabel}>{t('Designed prior', 'Tiên nghiệm thiết kế')}</div>
                <div style={posteriorBig}>{c.designed_lambda.toFixed(4)}</div>
                <div style={metaText}>{t('centre', 'tâm')} · {Math.round(Math.LN2 / c.designed_lambda)}d</div>
              </div>
              <div>
                <div style={miniLabel}>{t('Posterior centre', 'Tâm hậu nghiệm')}</div>
                <div style={{ ...posteriorBig, color: c.active ? '#7AB07A' : '#B2AA98' }}>
                  {latest ? latest.learned_lambda.toFixed(4) : c.designed_lambda.toFixed(4)}
                </div>
                <div style={metaText}>
                  {latest ? `Gamma(α+d, β+T) · n=${latest.n_observations}` : t('equals prior (no fit yet)', 'bằng tiên nghiệm (chưa khớp)')}
                </div>
              </div>
              <div>
                <div style={miniLabel}>{t('95% credible interval', 'khoảng tin cậy 95%')}</div>
                {latest?.lambda_ci_lower != null && latest?.lambda_ci_upper != null ? (
                  <>
                    <div style={posteriorBig}>
                      [{latest.lambda_ci_lower.toFixed(4)}, {latest.lambda_ci_upper.toFixed(4)}]
                    </div>
                    <div style={metaText}>
                      {t('rel-width', 'độ rộng tương đối')} {latest.ci_relative_width != null ? latest.ci_relative_width.toFixed(2) : '—'}
                      {' '}({latest.ci_narrow_enough ? t('narrow enough', 'đủ hẹp') : t('too wide', 'quá rộng')})
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ ...posteriorBig, color: '#7E7864' }}>—</div>
                    <div style={metaText}>{t('pending fit', 'chờ khớp')}</div>
                  </>
                )}
              </div>
            </div>

            {/* CI rail */}
            <div style={ciRail}>
              {ciLoX != null && ciHiX != null && (
                <div style={{
                  position: 'absolute', top: 6, height: 8,
                  left: `${ciLoX}%`, width: `${Math.max(0.5, ciHiX - ciLoX)}%`,
                  background: 'rgba(122,176,122,0.20)',
                  border: '1px solid rgba(122,176,122,0.45)',
                  borderRadius: 2,
                }} />
              )}
              <div style={{
                position: 'absolute', top: 0, height: 20, width: 2,
                left: `calc(${designedX}% - 1px)`,
                background: '#B2AA98',
              }} title={`${t('designed prior centre', 'tâm tiên nghiệm thiết kế')} · λ=${c.designed_lambda.toFixed(4)}`} />
              <div style={{
                position: 'absolute', top: 0, height: 20, width: 2,
                left: `calc(${posteriorX}% - 1px)`,
                background: c.active ? '#7AB07A' : '#D4B85A',
              }} title={`${t('posterior centre', 'tâm hậu nghiệm')} · λ=${(latest?.learned_lambda ?? c.designed_lambda).toFixed(4)}`} />
              <div style={ciRailScale}>
                <span>0</span>
                <span>{lambdaScaleMax.toFixed(3)}</span>
              </div>
            </div>

            {/* Distance to event floor */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={miniLabel}>{t('Distance to event floor (contradictions)', 'Khoảng cách đến ngưỡng sự kiện (mâu thuẫn)')}</span>
                <span style={metaText}>
                  {nEvents} / {EVENT_FLOOR} · {nEvents < EVENT_FLOOR ? `${EVENT_FLOOR - nEvents} ${t('to go', 'còn lại')}` : t('floor met', 'đã đạt ngưỡng')}
                </span>
              </div>
              <div style={progressTrack}>
                <div style={{
                  height: '100%',
                  width: `${floorPct}%`,
                  background: nEvents >= EVENT_FLOOR ? '#7AB07A' : '#D4B85A',
                  borderRadius: 2, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Panel 5 — Aggregate vitals ──────────────────────────────────────────────

function VitalsGrid({ vitals }: { vitals: Vitals }) {
  const { t } = useLang()
  const stat = (label: string, value: string, note?: string, tone?: 'gold' | 'green' | 'red') => (
    <div style={vitalCard}>
      <div style={miniLabel}>{label}</div>
      <div style={{
        ...vitalBig,
        color: tone === 'gold' ? '#D4B85A' : tone === 'green' ? '#7AB07A' : tone === 'red' ? '#C27070' : '#E5D4C2',
      }}>{value}</div>
      {note && <div style={metaText}>{note}</div>}
    </div>
  )

  const totalExpYears = (vitals.total_exposure_days / 365).toFixed(1)
  const cs = vitals.category_status_counts

  return (
    <div>
      <div style={vitalsGrid}>
        {stat(t('Active preferences', 'Sở thích đang hoạt động'), vitals.active_preferences.toString())}
        {stat(t('Total exposure accruing', 'Tổng phơi nhiễm đang tích lũy'), `${vitals.total_exposure_days.toLocaleString()}d`,
          `${totalExpYears} ${t('prefs·years · the survival data the fit will see', 'sở thích·năm · dữ liệu sống sót mà mô hình khớp sẽ thấy')}`)}
        {stat(t('Medical-locked', 'Khóa y tế'), vitals.medical_locked.toString(),
          t('λ=0 by content guardrail — never decay', 'λ=0 theo rào chắn nội dung — không bao giờ suy giảm'), vitals.medical_locked > 0 ? 'red' : undefined)}
        {stat(t('Flagged for revalidation', 'Đã đánh dấu cần tái xác thực'), vitals.flagged_for_revalidation.toString(),
          t('PS(t) < 0.7·S₀ or stale beyond category window', 'PS(t) < 0.7·S₀ hoặc quá hạn ngoài cửa sổ danh mục'),
          vitals.flagged_for_revalidation > 0 ? 'gold' : 'green')}
        {stat(t('Validation events', 'Sự kiện xác thực'), vitals.total_validation_events.toString(),
          vitals.total_validation_events === 0
            ? t('Tank empty — every fit reads insufficient_data until events accrue', 'Bể trống — mọi lần khớp đều đọc insufficient_data cho đến khi có sự kiện tích lũy')
            : t('feeds the Bayesian fit', 'cấp dữ liệu cho phép khớp Bayes'))}
      </div>

      <div style={vitalsSubgrid}>
        <div style={vitalCardSm}>
          <div style={miniLabel}>{t('Categories', 'Danh mục')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={catStatChip('active')}>{cs.active} {t('active', 'đang hoạt động')}</span>
            <span style={catStatChip('proposed')}>{cs.proposed} {t('proposed', 'đề xuất')}</span>
            <span style={catStatChip('insufficient_data')}>{cs.insufficient_data} {t('insufficient', 'chưa đủ')}</span>
            <span style={catStatChip('no_fit_yet')}>{cs.no_fit_yet} {t('no fit yet', 'chưa khớp')}</span>
          </div>
        </div>

        <div style={vitalCardSm}>
          <div style={miniLabel}>{t('λ origin breakdown', 'phân tích nguồn gốc λ')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {Object.entries(vitals.lambda_origin_breakdown).map(([k, v]) => (
              <span key={k} style={originPill(k)}>{v} {k.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Panel 4 — Event stream ──────────────────────────────────────────────────

function consequenceText(e: FeedEvent, t: (en: string, vi: string) => string): string {
  if (e.kind === 'validation') {
    const days = e.days_since_last_validation
    switch (e.subtype) {
      case 'confirmed':
        return `${t('validation_count + 1, R recomputed (cap 1.30), spell clock reset, revalidation flag cleared', 'validation_count + 1, R được tính lại (giới hạn 1.30), đồng hồ chu kỳ đặt lại, cờ tái xác thực được xóa')}${days != null ? ` · ${days}${t('d since last validation', ' ngày kể từ lần xác thực cuối')}` : ''}`
      case 'contradicted':
        return `${t('fed to category exposure as an event (d+1); λ posterior updates at next monthly fit', 'được nạp vào phơi nhiễm danh mục dưới dạng một sự kiện (d+1); hậu nghiệm λ cập nhật ở lần khớp hằng tháng kế tiếp')}${days != null ? ` · ${days}${t('d spell', ' ngày chu kỳ')}` : ''}`
      case 'revised':
        return t('preference replaced; old row archived, new row inherits λ + lambda_origin', 'sở thích được thay thế; dòng cũ lưu trữ, dòng mới kế thừa λ + lambda_origin')
      case 'invalidated':
        return t('preference marked invalid; no longer scored', 'sở thích bị đánh dấu không hợp lệ; không còn được chấm điểm')
      default:
        return t('validation event', 'sự kiện xác thực')
    }
  }
  if (e.kind === 'preference_insert') {
    const origin = (e.lambda_origin || 'unknown').replace(/_/g, ' ')
    const lam = e.lambda != null ? `λ=${e.lambda.toFixed(4)}` : t('no λ', 'không có λ')
    return `${t('new preference written', 'sở thích mới được ghi')} · ${lam} · ${t('origin:', 'nguồn:')} ${origin}${e.loop_closure ? ` · ${t('← loop closed (inherited learned λ)', '← vòng lặp đã đóng (kế thừa λ đã học)')}` : ''}`
  }
  if (e.kind === 'promotion') {
    if (e.subtype === 'active') {
      const designed = e.designed_lambda != null ? e.designed_lambda.toFixed(4) : '—'
      const learned  = e.learned_lambda  != null ? e.learned_lambda.toFixed(4) : '—'
      return `${t('λ PROMOTED · designed', 'λ ĐÃ THĂNG CẤP · thiết kế')} ${designed} → ${t('learned', 'đã học')} ${learned}${e.is_demo_fixture ? ` · ${t('DEMO fixture', 'bản demo')}` : ''}`
    }
    return `learned_decay_constants ${e.subtype ?? t('updated', 'đã cập nhật')}`
  }
  return t('event', 'sự kiện')
}

function eventDotColor(e: FeedEvent): string {
  if (e.kind === 'validation') {
    if (e.subtype === 'confirmed') return '#7AB07A'
    if (e.subtype === 'contradicted') return '#C27070'
    return '#9E8FC4'
  }
  if (e.kind === 'preference_insert') return e.loop_closure ? '#7AB07A' : '#D4B85A'
  if (e.kind === 'promotion') return e.is_demo_fixture ? '#C27070' : '#7AB07A'
  return '#B2AA98'
}

function formatRelTime(iso: string, t: (en: string, vi: string) => string): string {
  const now = Date.now()
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return iso
  const secs = Math.max(0, Math.floor((now - then) / 1000))
  if (secs < 60)    return `${secs}${t('s ago', ' giây trước')}`
  if (secs < 3600)  return `${Math.floor(secs / 60)}${t('m ago', ' phút trước')}`
  if (secs < 86400) return `${Math.floor(secs / 3600)}${t('h ago', ' giờ trước')}`
  return `${Math.floor(secs / 86400)}${t('d ago', ' ngày trước')}`
}

function EventStream({ events, transport }: { events: FeedEvent[]; transport: Transport }) {
  const { t } = useLang()
  const loopClosure = events.filter(e => e.loop_closure)

  if (events.length === 0) {
    return (
      <div style={emptyFeedBlock}>
        <div style={{ fontSize: 14, color: '#E5D4C2', marginBottom: 8 }}>{t('watching · no scoring events yet.', 'đang theo dõi · chưa có sự kiện chấm điểm nào.')}</div>
        <div style={{ lineHeight: 1.7 }}>
          {t('The subscription is live (', 'Kênh đăng ký đang trực tiếp (')}{transport === 'realtime' ? 'postgres_changes' : transport === 'polling' ? t('15s poll', 'thăm dò 15 giây') : t('probing', 'đang dò')}).
          {' '}{t('When validation events, preference inserts, or λ promotions arrive, they appear here in real time, each annotated with what the system did because of it. This empty state is the honest one for an empty tank.', 'Khi có sự kiện xác thực, thêm sở thích, hoặc thăng cấp λ, chúng sẽ xuất hiện tại đây theo thời gian thực, mỗi mục kèm ghi chú về việc hệ thống đã làm gì vì nó. Trạng thái trống này là trạng thái trung thực cho một bể trống.')}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Loop-closure ticker — events that prove the system learning from itself */}
      {loopClosure.length > 0 && (
        <div style={loopTicker}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ ...demoEyebrow, color: '#7AB07A' }}>{t('LOOP CLOSURE TICKER', 'BẢNG ĐÓNG VÒNG LẶP')}</span>
            <span style={metaText}>{loopClosure.length} {t('event', 'sự kiện')}{loopClosure.length === 1 ? '' : t('s', '')} {t('where the system inherited a rate it learned', 'nơi hệ thống kế thừa một tốc độ mà nó đã học')}</span>
          </div>
          {loopClosure.slice(0, 5).map(e => (
            <div key={`lc_${e.id}`} style={loopTickerRow}>
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: 4,
                background: '#7AB07A', boxShadow: '0 0 6px rgba(122,176,122,0.7)',
              }} />
              <span style={{ ...metaText, color: '#E5D4C2' }}>
                {e.kind === 'promotion'
                  ? `${t('λ PROMOTED', 'λ ĐÃ THĂNG CẤP')} · ${e.category}`
                  : `${e.preference_name || t('preference', 'sở thích')} · ${e.category}`}
              </span>
              <span style={metaText}>{consequenceText(e, t)}</span>
              <span style={{ ...metaText, marginLeft: 'auto' }}>{formatRelTime(e.timestamp, t)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Full feed */}
      <div style={feedList}>
        {events.map(e => (
          <div key={e.id} style={{ ...feedRow, ...(e.loop_closure ? feedRowLoop : {}) }}>
            <span style={{ ...feedDot, background: eventDotColor(e) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={feedLine1}>
                <span style={feedKindLabel(e)}>
                  {e.kind === 'validation'  ? `${t('validation', 'xác thực')} · ${e.subtype}` :
                   e.kind === 'preference_insert' ? t('preference · insert', 'sở thích · thêm mới') :
                                                    `${t('learned λ', 'λ đã học')} · ${e.subtype || t('change', 'thay đổi')}`}
                </span>
                {e.member_name && <span style={metaText}>· {e.member_name}</span>}
                {e.category    && <span style={metaText}>· {e.category}</span>}
                {e.preference_name && <span style={{ ...metaText, color: '#E5D4C2' }}>· {e.preference_name}</span>}
                {e.is_demo_fixture && <span style={demoGatePill}>DEMO</span>}
                <span style={{ ...metaText, marginLeft: 'auto' }}>{formatRelTime(e.timestamp, t)}</span>
              </div>
              <div style={feedLine2}>{consequenceText(e, t)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function feedKindLabel(e: FeedEvent): React.CSSProperties {
  const tone = e.kind === 'promotion' ? 'green'
    : e.kind === 'preference_insert' ? 'gold'
    : 'grey'
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 10,
    color: tone === 'green' ? '#7AB07A' : tone === 'gold' ? '#D4B85A' : '#B2AA98',
    letterSpacing: '0.06em', textTransform: 'uppercase',
  }
}

// ─── Panel 6 — Demo extraction surface ───────────────────────────────────────

function DemoExtractionPanel({
  sampleId, samples, transcript, memberName, phase, extracted, summary, error,
  expandedRationales, onToggleRationale,
  onLoadSample, onTranscriptChange, onMemberNameChange, onRun, onCancel,
}: {
  sampleId: string
  samples: readonly SampleTranscript[]
  transcript: string
  memberName: string
  phase: DemoPhase
  extracted: DemoExtractedPref[]
  summary: DemoReconciledSummary | null
  error: string | null
  expandedRationales: Set<string>
  onToggleRationale: (uid: string) => void
  onLoadSample: (id: string) => void
  onTranscriptChange: (v: string) => void
  onMemberNameChange: (v: string) => void
  onRun: () => void
  onCancel: () => void
}) {
  const { t } = useLang()
  const reconciled = phase === 'done' && summary !== null
  const baselineSummary = summary ? (() => {
    const learned = Object.entries(summary.baselines)
      .filter(([, b]) => b.source === 'learned').map(([cat]) => cat)
    return learned.length === 0
      ? t('all baselines designed (no learned λ promoted)', 'tất cả mốc cơ sở đều thiết kế (chưa thăng cấp λ đã học)')
      : `${t('learned:', 'đã học:')} ${learned.join(', ')} · ${t('rest designed', 'còn lại là thiết kế')}`
  })() : null

  return (
    <>
      <div style={demoControlsRow}>
        <label style={pickerLabel}>
          {t('Sample transcript', 'Bản ghi mẫu')}
          <select
            value={sampleId}
            onChange={e => onLoadSample(e.target.value)}
            disabled={phase === 'streaming' || phase === 'reconciling'}
            style={pickerInput}
          >
            <option value="">{t('— choose a sample —', '— chọn một mẫu —')}</option>
            {samples.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label style={pickerLabel}>
          {t('Member name (for the prompt)', 'Tên hội viên (cho lời nhắc)')}
          <input
            type="text"
            value={memberName}
            onChange={e => onMemberNameChange(e.target.value)}
            disabled={phase === 'streaming' || phase === 'reconciling'}
            style={pickerInput}
            placeholder={t('Demo Member', 'Hội viên demo')}
          />
        </label>
      </div>

      <textarea
        value={transcript}
        onChange={e => onTranscriptChange(e.target.value)}
        disabled={phase === 'streaming' || phase === 'reconciling'}
        placeholder={t('Load a bundled sample above, or paste a fictional transcript here. Real member transcripts have no business on this surface.', 'Tải một mẫu đi kèm ở trên, hoặc dán một bản ghi hư cấu vào đây. Bản ghi của hội viên thật không nên xuất hiện trên bề mặt này.')}
        rows={6}
        style={demoTextarea}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(phase === 'streaming' || phase === 'reconciling') ? (
          <button onClick={onCancel} style={btnGhostDemo}>{t('Cancel', 'Hủy')}</button>
        ) : (
          <button
            onClick={onRun}
            disabled={!transcript.trim()}
            style={{
              ...demoBtn,
              ...(transcript.trim() ? {} : { opacity: 0.4, cursor: 'not-allowed' }),
            }}
            title={transcript.trim() ? '' : t('Load a sample or paste a transcript first', 'Vui lòng tải một mẫu hoặc dán một bản ghi trước')}
          >
            {phase === 'done' || phase === 'error' ? t('Run extraction again', 'Chạy trích xuất lại') : t('Run extraction', 'Chạy trích xuất')}
          </button>
        )}
        {phase === 'streaming' && (
          <span style={metaText}>{t('Claude is reading the transcript', 'Claude đang đọc bản ghi')} · {extracted.length} {t('preference', 'sở thích')}{extracted.length === 1 ? '' : t('s', '')} {t('so far…', 'cho đến nay…')}</span>
        )}
        {phase === 'reconciling' && (
          <span style={metaText}>{t('Applying medical guardrail and baseline inheritance…', 'Đang áp dụng rào chắn y tế và kế thừa mốc cơ sở…')}</span>
        )}
        {phase === 'done' && summary && (
          <span style={metaText}>
            {t('done', 'hoàn tất')} · {summary.count} {t('preference', 'sở thích')}{summary.count === 1 ? '' : t('s', '')} · {summary.medicalForced} {t('medical', 'y tế')} · {summary.identityForced} {t('identity', 'danh tính')} · {summary.aiPermanent} {t('permanent', 'vĩnh viễn')} · {summary.dropped.length} {t('dropped', 'bị loại')}
          </span>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {reconciled && summary && (
        <div style={demoSummaryBanner}>
          <strong style={{ color: '#D4B85A' }}>{summary.count}</strong> {t('preference', 'sở thích')}{summary.count === 1 ? '' : t('s', '')} ·
          {' '}<strong style={{ color: summary.medicalForced  > 0 ? '#C27070' : '#B2AA98' }}>{summary.medicalForced}</strong> {t('medical-forced', 'ép y tế')} ·
          {' '}<strong style={{ color: summary.identityForced > 0 ? '#D4B85A' : '#B2AA98' }}>{summary.identityForced}</strong> {t('identity-locked', 'khóa danh tính')} ·
          {' '}<strong style={{ color: summary.aiPermanent    > 0 ? '#D4B85A' : '#B2AA98' }}>{summary.aiPermanent}</strong> {t('permanent-locked', 'khóa vĩnh viễn')} ·
          {' '}<strong style={{ color: summary.dropped.length > 0 ? '#B2AA98' : '#7AB07A' }}>{summary.dropped.length}</strong> {t('dropped', 'bị loại')}
          {summary.dropped.length > 0 && (
            <span style={{ color: '#B2AA98', opacity: 0.75 }}> ({summary.dropped.map(d => d.reason).join(', ')})</span>
          )}
          <div style={{ marginTop: 4, color: '#B2AA98', opacity: 0.85 }}>
            {t('baselines used:', 'mốc cơ sở đã dùng:')} {baselineSummary}
          </div>
          <div style={{ marginTop: 6, color: '#7E7864', fontSize: 10, fontStyle: 'italic' }}>
            {t('No database write occurred. The list below exists only in this browser session.', 'Không có thao tác ghi cơ sở dữ liệu nào. Danh sách bên dưới chỉ tồn tại trong phiên trình duyệt này.')}
          </div>
        </div>
      )}

      {reconciled && summary && summary.dropped.length > 0 && (
        <div style={droppedStrip}>
          <div style={{ ...miniLabel, color: '#C27070', marginBottom: 6 }}>
            {t('⚠ DROPPED ·', '⚠ ĐÃ LOẠI ·')} {summary.dropped.length} {t('row', 'dòng')}{summary.dropped.length === 1 ? '' : t('s', '')} {t('did not survive reconciliation', 'không vượt qua đối chiếu')}
          </div>
          {summary.dropped.map((d, i) => (
            <div key={i} style={droppedRow}>
              <span style={{ color: '#C27070', marginRight: 8 }}>·</span>
              <span style={{ color: '#E5D4C2' }}>{d.item?.preference_name || t('(unnamed)', '(không tên)')}</span>
              <span style={{ color: '#7E7864' }}> — {d.reason}</span>
            </div>
          ))}
        </div>
      )}

      {extracted.length > 0 && (
        <div style={demoExtractedList}>
          {extracted.map((p, i) => (
            <DemoPreferenceCard
              key={p.uid}
              pref={p}
              index={i + 1}
              phase={phase}
              expanded={expandedRationales.has(p.uid)}
              onToggleExpand={() => onToggleRationale(p.uid)}
            />
          ))}
        </div>
      )}
    </>
  )
}

// Probe attention regex — substring match (deliberately loose; the affordance's
// job is to flag every not-locked row that could be a miss, then let the human
// judge). Mirrors the user's spec exactly so reviewers can audit the surface
// area at a glance.
const PROBE_MEDICAL_ADJACENT = /medic|allerg|intoleran|epipen|anaphyla/i
function isMedicalAdjacent(p: DemoExtractedPref): boolean {
  const hay = [p.preference_name, p.detail, p.verbatim_quote, p.subcategory, p.category]
    .filter(Boolean).join(' ')
  return PROBE_MEDICAL_ADJACENT.test(hay)
}

function DemoPreferenceCard({ pref, index, phase, expanded, onToggleExpand }: {
  pref: DemoExtractedPref; index: number; phase: DemoPhase
  expanded: boolean; onToggleExpand: () => void
}) {
  const { t } = useLang()
  // Streaming heuristic: AI-emitted λ=0 = the model thinks this is permanent.
  // Whether it's MEDICAL or PERMANENT depends on content-detection, which only
  // runs at reconcile. During streaming, render λ=0 as "PERMANENT — suspected"
  // (the conservative label); reconcile then upgrades to MEDICAL where the
  // content guardrail actually fires.
  const isReconciled = pref.lambda_origin != null
  const isMedical   = pref.lambda_origin === 'forced_medical'
  const isIdentity  = pref.lambda_origin === 'forced_identity'
  const isPermanent = pref.lambda_origin === 'ai_permanent'
  const isLocked    = isMedical || isIdentity || isPermanent || (!isReconciled && pref.lambda === 0)
  const originLabel: { text: string; tone: 'red' | 'gold' | 'green' | 'grey' | 'amber' } =
    isMedical                                           ? { text: t('MEDICAL — LOCKED', 'Y TẾ — ĐÃ KHÓA'),         tone: 'red'   } :
    isIdentity                                          ? { text: t('IDENTITY — LOCKED', 'DANH TÍNH — ĐÃ KHÓA'),        tone: 'gold'  } :
    isPermanent                                         ? { text: t('PERMANENT — LOCKED', 'VĨNH VIỄN — ĐÃ KHÓA'),       tone: 'amber' } :
    pref.lambda_origin === 'ai_specific'                ? { text: t('AI · SPECIFIC', 'AI · RIÊNG BIỆT'),             tone: 'gold'  } :
    pref.lambda_origin === 'category_baseline_learned'  ? { text: t('BASELINE · LEARNED', 'CƠ SỞ · ĐÃ HỌC'),        tone: 'green' } :
    pref.lambda_origin === 'category_baseline_designed' ? { text: t('BASELINE · DESIGNED', 'CƠ SỞ · THIẾT KẾ'),       tone: 'grey'  } :
    isLocked                                            ? { text: t('PERMANENT — suspected', 'VĨNH VIỄN — nghi ngờ'),     tone: 'amber' } :
                                                          { text: t('LIVE · pending reconcile', 'TRỰC TIẾP · chờ đối chiếu'),  tone: 'grey'  }

  const borderColor = isMedical   ? '#C27070'
                    : isIdentity  ? '#D4B85A'
                    : isPermanent ? '#D4B85A'
                    : isLocked    ? '#D4B85A'
                    : null
  const cardBg = isMedical   ? 'rgba(194,112,112,0.04)'
               : isIdentity  ? 'rgba(212,184,90,0.05)'
               : isPermanent ? 'rgba(212,184,90,0.04)'
               : null

  // ── Probe-mode edge flags (advisory only — do NOT certify correctness) ──
  // The medical-adjacent affordance flags FOR ATTENTION when a row contains
  // medical-ish language AND was not locked. It does NOT claim the non-firing
  // is "correct" — the same pattern catches the trap cases (correctly not
  // locked, e.g. "medicinal" tasting note) AND the misses (incorrectly not
  // locked — a real allergy the guardrail failed to catch). The badge's job
  // is to make every such row visible so a human can tell them apart.
  const showMedicalAdjacentAttention = isReconciled && !isLocked && isMedicalAdjacent(pref)
  const showLowConfidence = isReconciled && pref.confidence <= 0.50 && !isLocked

  return (
    <div style={{
      ...demoPrefCard,
      ...(borderColor ? { borderLeft: `3px solid ${borderColor}` } : {}),
      ...(cardBg      ? { background: cardBg } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={demoIndex}>#{index}</span>
        <span style={prefCategoryBadge}>{pref.category}</span>
        <span style={originBadge(originLabel.tone)}>{originLabel.text}</span>
        {showLowConfidence && (
          <span
            style={attentionBadge}
            title={t('C ≤ 0.50 — the AI hedged this scoring (e.g. one-off mention, qualifier). Worth a closer look.', 'C ≤ 0.50 — AI đã dè dặt khi chấm điểm này (ví dụ: chỉ nhắc một lần, có từ hạn định). Đáng xem xét kỹ hơn.')}
          >
            {t('⚠ LOW CONFIDENCE', '⚠ ĐỘ TIN CẬY THẤP')}
          </span>
        )}
        {showMedicalAdjacentAttention && (
          <span
            style={attentionBadgeMedicalAdjacent}
            title={t(`Pattern-matched: contains medical-adjacent language (matched /medic|allerg|intoleran|epipen|anaphyla/i) and was NOT locked. The badge does NOT certify the non-firing as correct — the same pattern catches "medicinal tasting note" (correctly unlocked) AND a missed allergy (incorrectly unlocked). Verify which this is.`, 'Khớp theo mẫu: chứa ngôn ngữ liên quan đến y tế (khớp /medic|allerg|intoleran|epipen|anaphyla/i) và KHÔNG được khóa. Nhãn này KHÔNG xác nhận việc không kích hoạt là đúng — cùng mẫu này bắt cả "ghi chú thử vị mang tính dược liệu" (đúng khi không khóa) LẪN một dị ứng bị bỏ sót (sai khi không khóa). Hãy kiểm chứng đây là trường hợp nào.')}
          >
            {t('⚠ MEDICAL-ADJACENT · UNLOCKED · VERIFY', '⚠ LIÊN QUAN Y TẾ · CHƯA KHÓA · KIỂM CHỨNG')}
          </span>
        )}
        {phase === 'streaming' && !isReconciled && <span style={liveTag}>· {t('live', 'trực tiếp')}</span>}
      </div>
      <div style={demoPrefName}>{pref.preference_name}</div>
      {pref.detail && <div style={demoPrefDetail}>{pref.detail}</div>}
      {pref.verbatim_quote && <div style={demoPrefQuote}>“{pref.verbatim_quote}”</div>}

      <div style={demoFactorRow}>
        <span style={demoFactor}>S₀ <strong style={{ color: pref.s0 === 5 ? '#D4B85A' : '#E5D4C2' }}>{pref.s0}</strong></span>
        <span style={demoFactor}>C <strong style={{ color: '#E5D4C2' }}>{pref.confidence.toFixed(2)}</strong></span>
        <span style={demoFactor}>λ <strong style={{ color: pref.lambda === 0 ? '#C27070' : '#E5D4C2' }}>{pref.lambda.toFixed(3)}</strong></span>
        <span style={demoFactor}>F <strong style={{ color: '#E5D4C2' }}>{pref.frequency.toFixed(1)}</strong></span>
        {pref.lambda > 0 && (
          <span style={demoFactor}>{t('half-life', 'chu kỳ bán rã')} <strong style={{ color: '#B2AA98' }}>{Math.round(Math.LN2 / pref.lambda)}d</strong></span>
        )}
        {pref.lambda === 0 && (
          <span style={demoFactor}><strong style={{ color: '#C27070' }}>{t('never decays', 'không bao giờ suy giảm')}</strong></span>
        )}
      </div>

      {pref.rationale && (
        <div style={{ marginTop: 10 }}>
          <button onClick={onToggleExpand} style={rationaleToggle}>
            {expanded ? '▾' : '▸'} {t('rationale', 'lý giải')}
          </button>
          {expanded && <RationaleBreakdown pref={pref} />}
        </div>
      )}
    </div>
  )
}

/** Collapsible section wrapper used by every Panel 1-6 + the breadth table.
 *  Renders head children (eyebrow + title + optional right-side meta) plus a
 *  chevron toggle that flips collapse state. When collapsed, body is hidden.
 *  Collapse state lives in the parent component (persisted to localStorage). */
function CollapsiblePanel({ id, open, onToggle, head, children }: {
  id: string
  open: boolean
  onToggle: () => void
  head: React.ReactNode
  children: React.ReactNode
}) {
  const { t } = useLang()
  return (
    <section style={panel} id={id}>
      <div style={panelHead}>
        {head}
        <button
          onClick={onToggle}
          style={chevronBtn}
          aria-label={open ? t('collapse panel', 'thu gọn bảng') : t('expand panel', 'mở rộng bảng')}
          title={open ? t('collapse panel', 'thu gọn bảng') : t('expand panel', 'mở rộng bảng')}
        >
          <span style={{ ...chevronGlyph, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
        </button>
      </div>
      {open && <>{children}</>}
    </section>
  )
}

/** Per-factor rationale breakdown. One line per factor. Rule-forced factors
 *  carry a 🔒 glyph + a subtle "rule" tone so it's glanceable that the line
 *  came from deterministic code rather than the AI. */
function RationaleBreakdown({ pref }: { pref: DemoExtractedPref }) {
  const { t } = useLang()
  // Legacy string rationale — show as one summary line, no per-factor breakdown.
  if (typeof pref.rationale === 'string') {
    return (
      <div style={rationaleBlock}>
        <span style={{ color: '#7E7864' }}>AI: </span>
        {pref.rationale}
      </div>
    )
  }
  const r = pref.rationale
  if (!r) return null

  const factors: Array<{
    key: 's0' | 'c' | 'lambda' | 'f'
    label: string
    value: string
    text: string
    forced: boolean
  }> = [
    { key: 's0',     label: 'S₀', value: pref.s0.toString(),         text: rationaleFactor(r, 's0'),     forced: isFactorForced(pref.lambda_origin, 's0') },
    { key: 'c',      label: 'C',  value: pref.confidence.toFixed(2), text: rationaleFactor(r, 'c'),      forced: isFactorForced(pref.lambda_origin, 'c') },
    { key: 'lambda', label: 'λ',  value: pref.lambda.toFixed(3),     text: rationaleFactor(r, 'lambda'), forced: isFactorForced(pref.lambda_origin, 'lambda') },
    { key: 'f',      label: 'F',  value: pref.frequency.toFixed(1),  text: rationaleFactor(r, 'f'),      forced: false },
  ]

  return (
    <div style={rationaleBlock}>
      {r.summary && (
        <div style={rationaleSummaryLine}>{r.summary}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {factors.map(f => (
          <div key={f.key} style={f.forced ? rationaleFactorRowForced : rationaleFactorRow}>
            <span style={rationaleFactorLabel}>{f.label}</span>
            <span style={rationaleFactorValue}>{f.value}</span>
            {f.forced && <span style={lockGlyph}>🔒</span>}
            <span style={f.forced ? rationaleFactorTextForced : rationaleFactorText}>
              {f.text || (f.forced ? t('(rule-forced; no AI rationale needed)', '(ép theo quy tắc; không cần lý giải từ AI)') : t('(no rationale supplied)', '(không có lý giải)'))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Probe runs (in-session) + compare view ──────────────────────────────────

function ProbeRunsStrip({ runs, onRestore, compareIds, onCompareToggle }: {
  runs: ProbeRun[]
  onRestore: (id: string) => void
  compareIds: string[]
  onCompareToggle: (id: string) => void
}) {
  const { t } = useLang()
  return (
    <div style={probeRunsStrip}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ ...miniLabel, color: '#D4B85A' }}>{t('PROBE RUNS · last', 'LẦN CHẠY THĂM DÒ · gần nhất')} {runs.length}</span>
        <span style={metaText}>
          {t('click a run to restore · check 2 to compare side-by-side · check 3 to override the auto-pick for AI consistency analysis · kept for this session only, nothing is saved', 'nhấp một lần chạy để khôi phục · chọn 2 để so sánh song song · chọn 3 để ghi đè lựa chọn tự động cho phân tích nhất quán bằng AI · chỉ lưu trong phiên này, không có gì được lưu lại')}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {runs.map((r, i) => {
          const selected = compareIds.includes(r.id)
          const atCap = compareIds.length >= 3 && !selected
          return (
            <div key={r.id} style={{
              ...probeRunRow,
              ...(selected ? { background: 'rgba(212,184,90,0.10)', borderColor: 'rgba(212,184,90,0.45)' } : {}),
            }}>
              <input
                type="checkbox"
                checked={selected}
                disabled={atCap}
                onChange={() => onCompareToggle(r.id)}
                style={{ marginRight: 6, opacity: atCap ? 0.35 : 1 }}
                title={atCap ? t('3 already selected (max)', 'đã chọn 3 (tối đa)') : t('2 = side-by-side compare · 3 = AI consistency analysis', '2 = so sánh song song · 3 = phân tích nhất quán bằng AI')}
              />
              <button onClick={() => onRestore(r.id)} style={probeRunButton}>
                <span style={{ color: '#7E7864', marginRight: 8 }}>#{runs.length - i}</span>
                <span style={{ color: '#E5D4C2' }}>{r.label}</span>
                <span style={metaText}> · {r.summary.count} {t('prefs', 'sở thích')}</span>
                {r.summary.medicalForced  > 0 && <span style={{ ...metaText, color: '#C27070' }}> · {r.summary.medicalForced} {t('medical', 'y tế')}</span>}
                {r.summary.identityForced > 0 && <span style={{ ...metaText, color: '#D4B85A' }}> · {r.summary.identityForced} {t('identity', 'danh tính')}</span>}
                {r.summary.aiPermanent    > 0 && <span style={{ ...metaText, color: '#D4B85A' }}> · {r.summary.aiPermanent} {t('permanent', 'vĩnh viễn')}</span>}
                {r.summary.dropped.length > 0 && <span style={metaText}> · {r.summary.dropped.length} {t('dropped', 'bị loại')}</span>}
                <span style={{ ...metaText, marginLeft: 'auto' }}>
                  {new Date(r.ran_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProbeCompareView({ a, b, onClose }: {
  a: ProbeRun
  b: ProbeRun
  onClose: () => void
}) {
  const { t } = useLang()
  // Group preferences by category so both columns line up by topic.
  const allCats = Array.from(new Set([
    ...a.preferences.map(p => p.category),
    ...b.preferences.map(p => p.category),
  ])).sort()

  return (
    <div style={probeCompareWrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ ...miniLabel, color: '#D4B85A' }}>{t('COMPARE', 'SO SÁNH')}</span>
        <span style={metaText}>{t('category-aligned · locked rows highlighted in colour', 'căn theo danh mục · dòng bị khóa được tô màu nổi bật')}</span>
        <button onClick={onClose} style={{ ...btnGhostDemo, marginLeft: 'auto', padding: '4px 10px', fontSize: 10 }}>{t('close', 'đóng')}</button>
      </div>
      <div style={probeCompareGrid}>
        <div style={probeCompareCol}>
          <div style={probeCompareHeader}>
            <strong>{a.label}</strong>
            <div style={metaText}>{a.summary.count} {t('prefs', 'sở thích')} · {a.summary.medicalForced} {t('medical', 'y tế')} · {a.summary.identityForced} {t('identity', 'danh tính')} · {a.summary.aiPermanent} {t('permanent', 'vĩnh viễn')} · {a.summary.dropped.length} {t('dropped', 'bị loại')}</div>
          </div>
          <ProbeCompareCategoryList cats={allCats} prefs={a.preferences} />
        </div>
        <div style={probeCompareCol}>
          <div style={probeCompareHeader}>
            <strong>{b.label}</strong>
            <div style={metaText}>{b.summary.count} {t('prefs', 'sở thích')} · {b.summary.medicalForced} {t('medical', 'y tế')} · {b.summary.identityForced} {t('identity', 'danh tính')} · {b.summary.aiPermanent} {t('permanent', 'vĩnh viễn')} · {b.summary.dropped.length} {t('dropped', 'bị loại')}</div>
          </div>
          <ProbeCompareCategoryList cats={allCats} prefs={b.preferences} />
        </div>
      </div>
    </div>
  )
}

function ProbeCompareCategoryList({ cats, prefs }: {
  cats: string[]
  prefs: DemoExtractedPref[]
}) {
  const { t } = useLang()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cats.map(cat => {
        const rows = prefs.filter(p => p.category === cat)
        if (rows.length === 0) {
          return (
            <div key={cat} style={probeCompareCatBlock}>
              <div style={{ ...miniLabel, marginBottom: 6 }}>{cat}</div>
              <div style={{ ...metaText, opacity: 0.5 }}>{t('— no preferences in this category —', '— không có sở thích nào trong danh mục này —')}</div>
            </div>
          )
        }
        return (
          <div key={cat} style={probeCompareCatBlock}>
            <div style={{ ...miniLabel, marginBottom: 6 }}>{cat}</div>
            {rows.map(r => {
              const locked = r.lambda_origin === 'forced_medical'
                          || r.lambda_origin === 'forced_identity'
                          || r.lambda_origin === 'ai_permanent'
              const tone = r.lambda_origin === 'forced_medical'  ? '#C27070'
                         : r.lambda_origin === 'forced_identity' ? '#D4B85A'
                         : r.lambda_origin === 'ai_permanent'    ? '#D4B85A'
                         : '#E5D4C2'
              return (
                <div key={r.uid} style={{
                  ...probeCompareRow,
                  ...(locked ? { borderLeft: `2px solid ${tone}`, paddingLeft: 8 } : {}),
                }}>
                  <span style={{ color: tone }}>{r.preference_name}</span>
                  <span style={metaText}> · s0={r.s0} c={r.confidence.toFixed(2)} λ={r.lambda.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Consistency analyser button + report ────────────────────────────────────

function ConsistencyControl({ triple, source, explicitMismatch, phase, error, onRun }: {
  triple: ProbeRun[] | null
  source: 'explicit' | 'auto' | null
  explicitMismatch: boolean
  phase: 'idle' | 'analysing' | 'done' | 'error'
  error: string | null
  onRun: () => void
}) {
  const { t } = useLang()
  const enabled = triple !== null && phase !== 'analysing'
  const tooltip = !triple
    ? (explicitMismatch
       ? t('Three runs selected but they span multiple transcripts. Tick 3 of the same.', 'Đã chọn ba lần chạy nhưng chúng thuộc nhiều bản ghi khác nhau. Hãy đánh dấu 3 lần của cùng một bản ghi.')
       : t('Run the same transcript three times to enable.', 'Chạy cùng một bản ghi ba lần để kích hoạt.'))
    : ''
  const counts = triple?.map(r => r.preferences.length).join(' / ')
  return (
    <div style={consistencyControl}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={onRun}
          disabled={!enabled}
          style={{
            ...analysisBtn,
            ...(enabled ? {} : { opacity: 0.4, cursor: 'not-allowed' }),
          }}
          title={tooltip}
        >
          {phase === 'analysing' ? t('Analysing…', 'Đang phân tích…') : t('AI consistency analysis', 'Phân tích nhất quán bằng AI')}
        </button>
        {triple ? (
          <span style={metaText}>
            {source === 'explicit'
              ? <>{t('analysing the', 'đang phân tích')} <strong style={{ color: '#D4B85A' }}>{t('3 selected runs', '3 lần chạy đã chọn')}</strong> {t('of', 'của')} </>
              : <>{t('analysing the 3 most-recent runs of', 'đang phân tích 3 lần chạy gần nhất của')} </>}
            <strong style={{ color: '#E5D4C2' }}>{triple[0].label}</strong> ·
            {t('counts', 'số lượng')} {counts}
          </span>
        ) : explicitMismatch ? (
          <span style={{ ...metaText, color: '#E58F4A' }}>
            {t('⚠ selected runs span multiple transcripts · tick 3 of the same to analyse', '⚠ các lần chạy đã chọn thuộc nhiều bản ghi · đánh dấu 3 lần của cùng một bản ghi để phân tích')}
          </span>
        ) : (
          <span style={metaText}>
            {t('requires ≥ 3 runs of the same transcript · auto-picks the most-recent triple, or tick 3 to override', 'cần ≥ 3 lần chạy của cùng một bản ghi · tự động chọn bộ ba gần nhất, hoặc đánh dấu 3 để ghi đè')}
          </span>
        )}
      </div>
      {error && <div style={errorBox}>{error}</div>}
    </div>
  )
}

// ─── Helpers: name-similarity matcher, cell state, drift detection ──────────

type MatrixCell =
  | { kind: 'present';          pref: DemoExtractedPref }
  | { kind: 'granularity_gap' }  // analyser classified GRANULARITY → absence is the finding
  | { kind: 'matcher_miss' }     // analyser classified invariant/judgment → row SHOULD be present
                                 //   in all 3 runs; UI couldn't align it confidently.

type MatrixRowData = {
  preference: string
  detail: string
  classification: 'invariant' | 'judgment' | 'granularity' | 'safety'
  cells: [MatrixCell, MatrixCell, MatrixCell]
  /** Per-cell flags: which factor (if any) is the deviant value vs the row's mode.
   *  Only computed for `present` cells; flag-objects line up index-for-index with cells. */
  deviance: { s0?: boolean; c?: boolean; lambda?: boolean; f?: boolean }[]
  driftedFactors: Set<'s0' | 'c' | 'lambda' | 'f'>
  // Three lock kinds, three severities:
  //   • Medical   — deterministic guardrail. Drift = code defect = ⛔ alarm (red).
  //   • Identity  — deterministic guardrail (Pass B). Drift = code defect = ⛔ alarm (red).
  //   • Permanence (ai_permanent residue) — model judgement. Drift = judgment variance (amber).
  // Lumping any two together would either over-escalate permanence drift or
  // under-escalate identity drift, both of which would hide what the band is
  // trying to say.
  isMedicalLocked: boolean       // ANY cell with lambda_origin === 'forced_medical'
  isIdentityLocked: boolean      // ANY cell with lambda_origin === 'forced_identity'
  isPermanenceLocked: boolean    // ANY cell with lambda_origin === 'ai_permanent'
  /** Shape of permanence drift (when isPermanenceLocked).
   *  - 'held':                     all present cells ai_permanent + all scores identical
   *  - 'classification_toggled':  lambda_origin VARIED across runs — the model
   *    judged it identity-permanent in some and decaying in others.
   *  - 'score_drift_within_lock': all cells stayed ai_permanent but a score moved. */
  permanenceShape: 'held' | 'classification_toggled' | 'score_drift_within_lock'
  permanenceLockedRuns: number[]   // 1-indexed: cells where lambda_origin === 'ai_permanent'
  permanenceUnlockedRuns: number[] // 1-indexed: cells present but NOT 'ai_permanent'
  // Symmetric fields for the medical case (relevant if verdict === 'safety_inconsistency'):
  medicalShape: 'held' | 'classification_toggled' | 'score_drift_within_lock'
  medicalLockedRuns: number[]
  medicalUnlockedRuns: number[]
  // Symmetric fields for the identity case. Drift here is deterministic-rule
  // drift — if any present cell isn't forced_identity in a same-transcript
  // triple, the isIdentityPreference detector is non-deterministic on the
  // SAME input and the band must say "code defect", same severity as medical.
  identityShape: 'held' | 'classification_toggled' | 'score_drift_within_lock'
  identityLockedRuns: number[]
  identityUnlockedRuns: number[]
}

/** Normalise a preference name for fuzzy matching across runs. */
function normPrefName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Find a captured-run preference that matches a canonical name from the
 *  analyser's invariants/variances list. Three-pass: exact → substring → token
 *  overlap > 0.5. Returns null when we can't align confidently — the matcher's
 *  job is to be honest about what it COULD align, not to force a match. */
function matchPrefInRun(canonical: string, run: ProbeRun): DemoExtractedPref | null {
  const lc = normPrefName(canonical)
  // Pass 1: exact normalised match.
  for (const p of run.preferences) {
    if (normPrefName(p.preference_name) === lc) return p
  }
  // Pass 2: substring containment either direction.
  for (const p of run.preferences) {
    const pn = normPrefName(p.preference_name)
    if (pn && (pn.includes(lc) || lc.includes(pn))) return p
  }
  // Pass 3: token overlap ratio > 0.5 on tokens of length ≥ 3.
  const toks = lc.split(' ').filter(t => t.length >= 3)
  if (toks.length === 0) return null
  let best: { pref: DemoExtractedPref; overlap: number } | null = null
  for (const p of run.preferences) {
    const ptoks = normPrefName(p.preference_name).split(' ').filter(t => t.length >= 3)
    if (ptoks.length === 0) continue
    const matched = toks.filter(t => ptoks.some(pt => pt.includes(t) || t.includes(pt))).length
    const overlap = matched / toks.length
    if (overlap > 0.5 && (!best || overlap > best.overlap)) {
      best = { pref: p, overlap }
    }
  }
  return best?.pref ?? null
}

/** For each cell in a row, flag the factor(s) whose value differs from the
 *  row's mode across present cells. Empty when no drift. */
function computeRowDeviance(cells: MatrixCell[]): {
  deviance: { s0?: boolean; c?: boolean; lambda?: boolean; f?: boolean }[]
  drifted: Set<'s0' | 'c' | 'lambda' | 'f'>
} {
  const drifted = new Set<'s0' | 'c' | 'lambda' | 'f'>()
  const presents = cells.map(c => c.kind === 'present' ? c.pref : null)
  const presentOnly = presents.filter((p): p is DemoExtractedPref => p !== null)
  const deviance: { s0?: boolean; c?: boolean; lambda?: boolean; f?: boolean }[] =
    cells.map(() => ({}))
  if (presentOnly.length < 2) return { deviance, drifted }

  const mode = <T,>(arr: T[]): T => {
    const counts = new Map<T, number>()
    for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }
  const modeS0 = mode(presentOnly.map(p => p.s0))
  const modeC  = mode(presentOnly.map(p => p.confidence))
  const modeL  = mode(presentOnly.map(p => p.lambda))
  const modeF  = mode(presentOnly.map(p => p.frequency))

  if (!presentOnly.every(p => p.s0 === modeS0))                                  drifted.add('s0')
  if (!presentOnly.every(p => Math.abs(p.confidence - modeC) < 1e-6))            drifted.add('c')
  if (!presentOnly.every(p => Math.abs(p.lambda - modeL) < 1e-6))                drifted.add('lambda')
  if (!presentOnly.every(p => Math.abs(p.frequency - modeF) < 1e-6))             drifted.add('f')

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (c.kind !== 'present') continue
    if (drifted.has('s0')     && c.pref.s0 !== modeS0)                            deviance[i].s0 = true
    if (drifted.has('c')      && Math.abs(c.pref.confidence - modeC) > 1e-6)      deviance[i].c = true
    if (drifted.has('lambda') && Math.abs(c.pref.lambda - modeL) > 1e-6)          deviance[i].lambda = true
    if (drifted.has('f')      && Math.abs(c.pref.frequency - modeF) > 1e-6)       deviance[i].f = true
  }
  return { deviance, drifted }
}

/** Compute drift shape for a locked classification (medical or permanence).
 *  Keys off the per-cell lambda_origin varying across present cells — NOT
 *  off λ itself moving. That's deliberate: λ flipping from 0 to 0.002 and
 *  lambda_origin flipping ai_permanent→ai_specific are the SAME event seen
 *  two ways; describing it as "the model's classification changed" (the
 *  meaningful framing) beats describing it as "λ drifted" (the mechanical
 *  one). The band's job is to say what the change MEANS. */
function lockShape(
  cells: MatrixCell[],
  lockOrigin: 'forced_medical' | 'forced_identity' | 'ai_permanent',
  anyDrifted: boolean,
): {
  shape: 'held' | 'classification_toggled' | 'score_drift_within_lock'
  lockedRuns: number[]
  unlockedRuns: number[]
} {
  const lockedRuns: number[] = []
  const unlockedRuns: number[] = []
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (c.kind !== 'present') continue
    if (c.pref.lambda_origin === lockOrigin) lockedRuns.push(i + 1)
    else                                     unlockedRuns.push(i + 1)
  }
  if (unlockedRuns.length > 0) return { shape: 'classification_toggled', lockedRuns, unlockedRuns }
  if (anyDrifted)              return { shape: 'score_drift_within_lock', lockedRuns, unlockedRuns }
  return { shape: 'held', lockedRuns, unlockedRuns }
}

function buildRow(
  preference: string,
  detail: string,
  classification: MatrixRowData['classification'],
  runs: [ProbeRun, ProbeRun, ProbeRun],
): MatrixRowData {
  const matched = runs.map(r => matchPrefInRun(preference, r))
  const cells: MatrixCell[] = matched.map<MatrixCell>(p => {
    if (p) return { kind: 'present', pref: p }
    if (classification === 'granularity') return { kind: 'granularity_gap' }
    return { kind: 'matcher_miss' }
  })
  const { deviance, drifted } = computeRowDeviance(cells)

  const isMedicalLocked    = matched.some(p => p?.lambda_origin === 'forced_medical')
  const isIdentityLocked   = matched.some(p => p?.lambda_origin === 'forced_identity')
  const isPermanenceLocked = matched.some(p => p?.lambda_origin === 'ai_permanent')

  const med  = lockShape(cells, 'forced_medical',  drifted.size > 0)
  const idn  = lockShape(cells, 'forced_identity', drifted.size > 0)
  const perm = lockShape(cells, 'ai_permanent',    drifted.size > 0)

  return {
    preference, detail, classification,
    cells: cells as [MatrixCell, MatrixCell, MatrixCell],
    deviance, driftedFactors: drifted,
    isMedicalLocked, isIdentityLocked, isPermanenceLocked,
    permanenceShape: perm.shape,
    permanenceLockedRuns:   perm.lockedRuns,
    permanenceUnlockedRuns: perm.unlockedRuns,
    medicalShape: med.shape,
    medicalLockedRuns:      med.lockedRuns,
    medicalUnlockedRuns:    med.unlockedRuns,
    identityShape: idn.shape,
    identityLockedRuns:     idn.lockedRuns,
    identityUnlockedRuns:   idn.unlockedRuns,
  }
}

function buildAllRows(
  report: ConsistencyReport,
  runs: [ProbeRun, ProbeRun, ProbeRun],
): MatrixRowData[] {
  const rows: MatrixRowData[] = []
  for (const inv of report.invariants) {
    rows.push(buildRow(inv.preference, inv.detail, 'invariant', runs))
  }
  for (const v of report.variances) {
    const cls = v.type === 'safety' ? 'safety' : v.type === 'judgment' ? 'judgment' : 'granularity'
    rows.push(buildRow(v.preference, v.detail, cls, runs))
  }
  // All three lock kinds pin to top of matrix — each rendered with its own
  // severity in the sub-bands below. The sort just gets them above the bulk.
  const isAnyLocked = (r: MatrixRowData) =>
    r.isMedicalLocked || r.isIdentityLocked || r.isPermanenceLocked
  return [
    ...rows.filter(isAnyLocked),
    ...rows.filter(r => !isAnyLocked(r)),
  ]
}

// ── Per-row band wording ──────────────────────────────────────────────
// The honesty of the band lives in its wording. For permanence drift we
// explicitly distinguish two shapes:
//   • classification_toggled: lambda_origin VARIED across runs — the model
//     couldn't decide whether this was identity-permanent. THIS is the case
//     Pass B will fix (code-forcing identity permanence so it can't toggle).
//     Saying so explicitly now means after Pass B the wording visibly
//     changes to "held identically", which is the before/after the user
//     needs to be able to read.
//   • score_drift_within_lock: lambda_origin stayed ai_permanent in all
//     runs, but a score moved — ordinary judgment variance that Pass B
//     won't touch.

function runListPhrase(runs: number[], t: (en: string, vi: string) => string): string {
  if (runs.length === 0) return ''
  if (runs.length === 1) return `${t('run', 'lần chạy')} ${runs[0]}`
  if (runs.length === 2) return `${t('runs', 'các lần chạy')} ${runs[0]} & ${runs[1]}`
  return `${t('runs', 'các lần chạy')} ${runs.slice(0, -1).join(', ')} & ${runs[runs.length - 1]}`
}

function permanenceRowMessage(r: MatrixRowData, t: (en: string, vi: string) => string): string {
  if (r.permanenceShape === 'held') {
    return r.detail || t('judged identity-permanent (λ=0) in all 3 runs', 'được đánh giá là bất biến theo danh tính (λ=0) trong cả 3 lần chạy')
  }
  if (r.permanenceShape === 'classification_toggled') {
    const lockedPhrase   = runListPhrase(r.permanenceLockedRuns, t)
    const unlockedPhrase = runListPhrase(r.permanenceUnlockedRuns, t)
    return `${t('classification toggled — judged identity-permanent in', 'phân loại đảo chiều — được đánh giá là bất biến theo danh tính trong')} ${lockedPhrase}, ${t('decaying in', 'suy giảm trong')} ${unlockedPhrase}. ${t("The model couldn't decide whether this is permanent.", 'Mô hình không thể quyết định liệu điều này có vĩnh viễn hay không.')}`
  }
  // score_drift_within_lock
  const moved = [...r.driftedFactors]
    .map(f => f === 's0' ? 'S₀' : f === 'c' ? 'C' : f === 'lambda' ? 'λ' : 'F')
    .join(' / ')
  return `${t('permanence held (ai_permanent in all 3 runs);', 'tính bất biến được giữ (ai_permanent trong cả 3 lần chạy);')} ${moved || t('a score', 'một điểm số')} ${t('varied — judgment-level.', 'đã thay đổi — mức đánh giá.')}`
}

function medicalRowMessage(r: MatrixRowData, t: (en: string, vi: string) => string): string {
  if (r.medicalShape === 'held') {
    return r.detail || t('forced_medical (S₀=5/C=1/λ=0) in all 3 runs', 'forced_medical (S₀=5/C=1/λ=0) trong cả 3 lần chạy')
  }
  if (r.medicalShape === 'classification_toggled') {
    const lockedPhrase   = runListPhrase(r.medicalLockedRuns, t)
    const unlockedPhrase = runListPhrase(r.medicalUnlockedRuns, t)
    return `${t('forced_medical in', 'forced_medical trong')} ${lockedPhrase}, ${t('NOT locked in', 'KHÔNG khóa trong')} ${unlockedPhrase}. ${t('The medical guardrail is enforced in code and cannot vary for the same input — this is a GUARDRAIL CODE DEFECT.', 'Rào chắn y tế được thực thi trong mã và không thể thay đổi với cùng một đầu vào — đây là LỖI MÃ RÀO CHẮN.')}`
  }
  // score_drift_within_lock — should be impossible for forced_medical
  // (reconcile forces s0/c/λ deterministically) but render honestly if it
  // ever happens.
  return r.detail || t('medical-locked; a score varied within the lock — investigate.', 'khóa y tế; một điểm số đã thay đổi trong phạm vi khóa — hãy điều tra.')
}

// Identity drift is deterministic-rule drift (Pass B). For a same-transcript
// triple, isIdentityPreference is a pure function — every cell must classify
// the same way. Any toggle means the detector regex matched on one rendering
// of the same text and not another, which is a code defect.
function identityRowMessage(r: MatrixRowData, t: (en: string, vi: string) => string): string {
  if (r.identityShape === 'held') {
    return r.detail || t('forced_identity (S₀=5/C=1/λ=0) in all 3 runs — declarative identity/relationship fact, code-locked', 'forced_identity (S₀=5/C=1/λ=0) trong cả 3 lần chạy — sự kiện danh tính/quan hệ mang tính khẳng định, khóa trong mã')
  }
  if (r.identityShape === 'classification_toggled') {
    const lockedPhrase   = runListPhrase(r.identityLockedRuns, t)
    const unlockedPhrase = runListPhrase(r.identityUnlockedRuns, t)
    return `${t('forced_identity in', 'forced_identity trong')} ${lockedPhrase}, ${t('NOT locked in', 'KHÔNG khóa trong')} ${unlockedPhrase}. ${t('The identity guardrail is enforced in code and cannot vary for the same input — this is a GUARDRAIL CODE DEFECT.', 'Rào chắn danh tính được thực thi trong mã và không thể thay đổi với cùng một đầu vào — đây là LỖI MÃ RÀO CHẮN.')}`
  }
  return r.detail || t('identity-locked; a score varied within the lock — investigate.', 'khóa danh tính; một điểm số đã thay đổi trong phạm vi khóa — hãy điều tra.')
}

// ─── ConsistencyReportView ───────────────────────────────────────────────────

function ConsistencyReportView({ report, triple }: {
  report: ConsistencyReport
  triple: [ProbeRun, ProbeRun, ProbeRun]
}) {
  const { t } = useLang()
  const tone: 'safety' | 'amber' | 'green' =
      report.verdict === 'safety_inconsistency' ? 'safety'
    : report.verdict === 'judgment_variance'   ? 'amber'
    :                                            'green'

  const rows = useMemo(() => buildAllRows(report, triple), [report, triple])
  // Precedence in the rendering matches the precedence in reconcile:
  // MEDICAL > IDENTITY > PERMANENCE. A row that's medical-locked never appears
  // in the identity band; a row that's identity-locked never appears in the
  // permanence band.
  const medicalRows     = rows.filter(r => r.isMedicalLocked)
  const identityRows    = rows.filter(r => r.isIdentityLocked && !r.isMedicalLocked)
  const permanenceRows  = rows.filter(r => r.isPermanenceLocked && !r.isMedicalLocked && !r.isIdentityLocked)
  const nonLockedRows   = rows.filter(r => !r.isMedicalLocked && !r.isIdentityLocked && !r.isPermanenceLocked)
  const lockedRows      = [...medicalRows, ...identityRows, ...permanenceRows]
  // Has a row in each band actually drifted?
  const medicalToggled    = medicalRows.some(r => r.medicalShape !== 'held')
  const identityToggled   = identityRows.some(r => r.identityShape !== 'held')
  const permanenceDrifted = permanenceRows.some(r => r.permanenceShape !== 'held')

  // Evidence tally — recomputed from the actual rows, not just claimed counts.
  const held         = rows.filter(r => r.classification === 'invariant').length
  const judgmentN    = rows.filter(r => r.classification === 'judgment').length
  const granularityN = rows.filter(r => r.classification === 'granularity').length
  const safetyN      = rows.filter(r => r.classification === 'safety').length

  return (
    <div style={consistencyReportWrap}>
      {/* ── 1. VERDICT READING ── */}
      <div style={{ ...stagger(0) }}>
        <VerdictReading tone={tone} headline={report.headline} verdict={report.verdict} />
        <div style={{ ...evidenceTally, marginTop: 10 }}>
          <span style={tallyValue('#7AB07A')}>{held}</span> {t('held', 'giữ nguyên')}
          <span style={tallyDivider}>·</span>
          <span style={tallyValue('#D4B85A')}>{judgmentN}</span> {t('judgment', 'đánh giá')}
          <span style={tallyDivider}>·</span>
          <span style={tallyValue('#B2AA98')}>{granularityN}</span> {t('granularity', 'độ chi tiết')}
          <span style={tallyDivider}>·</span>
          <span style={tallyValue(safetyN > 0 ? '#C27070' : '#7E7864')}>{safetyN}</span> {t('safety', 'an toàn')}
        </div>
        <div style={{ ...countsLine, marginTop: 4 }}>
          {t('Run counts', 'Số lượng theo lần chạy')} <span style={mono}>{report.counts.join(' / ')}</span>
          {(() => {
            const lo = Math.min(...report.counts), hi = Math.max(...report.counts)
            const spread = hi - lo
            if (spread === 0) return null
            return tone === 'safety' ? null : (
              <span style={{ color: '#7E7864' }}>
                · {t('spread', 'độ chênh')} {spread}
                {report.verdict === 'stable' && t(' attributable to granularity, not judgment', ' do độ chi tiết, không phải do đánh giá')}
              </span>
            )
          })()}
        </div>
      </div>

      {/* ── 2. SAFETY · IDENTITY · PERMANENCE LOCKS — three sub-bands ── */}
      <div style={{ ...stagger(1) }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ ...miniLabel, color: '#7AB07A' }}>{t('SAFETY · IDENTITY · PERMANENCE LOCKS', 'KHÓA AN TOÀN · DANH TÍNH · VĨNH VIỄN')}</span>
          <span style={metaText}>
            {medicalRows.length === 0 && identityRows.length === 0 && permanenceRows.length === 0
              ? t('— no locked preferences in this triple', '— không có sở thích bị khóa trong bộ ba này')
              : (() => {
                  // Honest combined-state meta: separate medical / identity /
                  // permanence; never imply safety where it's only judgment drift.
                  const medPhrase = medicalRows.length === 0 ? null
                    : medicalToggled ? t('⛔ medical lock differed across runs', '⛔ khóa y tế khác nhau giữa các lần chạy')
                    : t('medical locks held', 'các khóa y tế được giữ nguyên')
                  const idnPhrase = identityRows.length === 0 ? null
                    : identityToggled ? t('⛔ identity lock differed across runs', '⛔ khóa danh tính khác nhau giữa các lần chạy')
                    : t('identity locks held', 'các khóa danh tính được giữ nguyên')
                  const permPhrase = permanenceRows.length === 0 ? null
                    : permanenceDrifted ? `${t('permanence classification varied on', 'phân loại vĩnh viễn thay đổi ở')} ${permanenceRows.filter(r => r.permanenceShape !== 'held').length} ${t('row', 'dòng')}${permanenceRows.filter(r => r.permanenceShape !== 'held').length === 1 ? '' : t('s', '')} ${t('— judgment-level (see below)', '— mức đánh giá (xem bên dưới)')}`
                    : t('permanence classifications held', 'các phân loại vĩnh viễn được giữ nguyên')
                  return '— ' + [medPhrase, idnPhrase, permPhrase].filter(Boolean).join('; ') + '.'
                })()}
          </span>
        </div>

        {/* — SAFETY LOCKS sub-band (forced_medical only). Safety/⛔/red only here. — */}
        {medicalRows.length > 0 && (
          <div style={subBand(medicalToggled ? 'alarm' : 'calm')}>
            <div style={subBandHeader}>
              <span style={{ ...miniLabel, color: medicalToggled ? '#FFFFFF' : '#7AB07A' }}>
                {t('SAFETY LOCKS', 'KHÓA AN TOÀN')}
              </span>
              <span style={{ ...metaText, color: medicalToggled ? '#FFFFFF' : '#B2AA98' }}>
                {medicalToggled
                  ? t('⛔ a medical lock differed across runs — GUARDRAIL CODE DEFECT (medical guardrail is enforced in code; this cannot vary for the same input)', '⛔ một khóa y tế khác nhau giữa các lần chạy — LỖI MÃ RÀO CHẮN (rào chắn y tế được thực thi trong mã; điều này không thể thay đổi với cùng một đầu vào)')
                  : t('medical guardrail enforcements · held identically across all 3 runs', 'các thực thi rào chắn y tế · giữ nguyên y hệt trong cả 3 lần chạy')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {medicalRows.map(r => {
                const isAlarm = r.medicalShape !== 'held'
                return (
                  <div key={r.preference} style={lockedRowStyle(isAlarm ? 'medical_alarm' : 'medical_calm')}>
                    <span style={{ color: isAlarm ? '#FFFFFF' : '#7AB07A', flexShrink: 0 }}>
                      {isAlarm ? '⛔' : '✓'}
                    </span>
                    <span style={{ color: isAlarm ? '#FFFFFF' : '#E5D4C2', fontWeight: 500 }}>{r.preference}</span>
                    <span style={{ ...metaText, color: isAlarm ? '#FFFFFF' : '#B2AA98' }}>
                      — {medicalRowMessage(r, t)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* — IDENTITY LOCKS sub-band (forced_identity). Deterministic guardrail
             — same severity discipline as medical: any drift on a same-transcript
             triple is a CODE DEFECT (the detector matched on one rendering of
             the same text and not another). Red ⛔ when toggled; calm when held.
             The "held identically across all 3 runs" wording is what visibly
             flips when Pass B resolves the anniversary/Sophie/no-birthdays
             drift that the consistency analyser surfaced. — */}
        {identityRows.length > 0 && (
          <div style={subBand(identityToggled ? 'alarm' : 'calm')}>
            <div style={subBandHeader}>
              <span style={{ ...miniLabel, color: identityToggled ? '#FFFFFF' : '#7AB07A' }}>
                {t('IDENTITY LOCKS', 'KHÓA DANH TÍNH')}
              </span>
              <span style={{ ...metaText, color: identityToggled ? '#FFFFFF' : '#B2AA98' }}>
                {identityToggled
                  ? t('⛔ an identity lock differed across runs — GUARDRAIL CODE DEFECT (the identity guardrail is enforced in code and cannot vary for the same input)', '⛔ một khóa danh tính khác nhau giữa các lần chạy — LỖI MÃ RÀO CHẮN (rào chắn danh tính được thực thi trong mã và không thể thay đổi với cùng một đầu vào)')
                  : t('identity guardrail enforcements · held identically across all 3 runs', 'các thực thi rào chắn danh tính · giữ nguyên y hệt trong cả 3 lần chạy')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {identityRows.map(r => {
                const isAlarm = r.identityShape !== 'held'
                return (
                  <div key={r.preference} style={lockedRowStyle(isAlarm ? 'identity_alarm' : 'identity_calm')}>
                    <span style={{ color: isAlarm ? '#FFFFFF' : '#7AB07A', flexShrink: 0 }}>
                      {isAlarm ? '⛔' : '✓'}
                    </span>
                    <span style={{ color: isAlarm ? '#FFFFFF' : '#E5D4C2', fontWeight: 500 }}>{r.preference}</span>
                    <span style={{ ...metaText, color: isAlarm ? '#FFFFFF' : '#B2AA98' }}>
                      — {identityRowMessage(r, t)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* — PERMANENCE LOCKS sub-band (ai_permanent only). Amber Δ at most; NEVER red, NEVER ⛔, NEVER 'safety'. — */}
        {permanenceRows.length > 0 && (
          <div style={subBand(permanenceDrifted ? 'amber' : 'calm')}>
            <div style={subBandHeader}>
              <span style={{ ...miniLabel, color: permanenceDrifted ? '#D4B85A' : '#7AB07A' }}>
                {t('PERMANENCE LOCKS', 'KHÓA VĨNH VIỄN')}
              </span>
              <span style={metaText}>
                {permanenceDrifted
                  ? `${t('model identity-level judgments · classification toggled on', 'đánh giá cấp danh tính của mô hình · phân loại đảo chiều ở')} ${permanenceRows.filter(r => r.permanenceShape === 'classification_toggled').length} ${t('row', 'dòng')}${permanenceRows.filter(r => r.permanenceShape === 'classification_toggled').length === 1 ? '' : t('s', '')} ${t('— judgment-level variance (not safety)', '— biến thiên mức đánh giá (không phải an toàn)')}`
                  : t('model identity-level judgments · held identically across all 3 runs', 'đánh giá cấp danh tính của mô hình · giữ nguyên y hệt trong cả 3 lần chạy')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {permanenceRows.map(r => {
                const drifted = r.permanenceShape !== 'held'
                return (
                  <div key={r.preference} style={lockedRowStyle(drifted ? 'permanence_amber' : 'permanence_calm')}>
                    <span style={{ color: drifted ? '#D4B85A' : '#7AB07A', flexShrink: 0 }}>
                      {drifted ? 'Δ' : '✓'}
                    </span>
                    <span style={{ color: '#E5D4C2', fontWeight: 500 }}>{r.preference}</span>
                    <span style={metaText}>— {permanenceRowMessage(r, t)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. RUN-COMPARISON MATRIX ── */}
      <div style={{ ...stagger(2) }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={miniLabel}>{t('RUN COMPARISON', 'SO SÁNH LẦN CHẠY')}</span>
          <span style={metaText}>{t('· preferences down · runs across · each cell shows S₀ / C / λ', '· sở thích theo hàng dọc · lần chạy theo hàng ngang · mỗi ô hiển thị S₀ / C / λ')}</span>
        </div>
        <MatrixLegend />
        <div style={matrixWrap}>
          <div style={matrixHeader}>
            <div style={matrixHeaderCellPref}>{t('preference', 'sở thích')}</div>
            {[1, 2, 3].map(i => (
              <div key={i} style={matrixHeaderCellRun}>
                {t('Run', 'Lần chạy')} {i}
                <span style={{ ...metaText, marginLeft: 4 }}>({triple[i - 1].preferences.length})</span>
              </div>
            ))}
          </div>
          {lockedRows.length === 0 && nonLockedRows.length === 0 && (
            <div style={{ ...metaText, padding: 16, textAlign: 'center' }}>
              {t('No preferences classified by the analyser.', 'Trình phân tích chưa phân loại sở thích nào.')}
            </div>
          )}
          {[...lockedRows, ...nonLockedRows].map(row => (
            <MatrixRow key={row.preference} row={row} />
          ))}
        </div>
      </div>

      {/* ── 4. SYNTHESIS — preceded by held/differed backbone ── */}
      <div style={{ ...stagger(3) }}>
        {(report.invariants.length > 0 || report.variances.length > 0) && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...miniLabel, marginBottom: 10 }}>{t('FINDINGS', 'PHÁT HIỆN')}</div>
            {report.invariants.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ ...miniLabelInner, color: '#7AB07A' }}>{t('HELD', 'GIỮ NGUYÊN')}</div>
                <ul style={findingsList}>
                  {report.invariants.map((inv, i) => (
                    <li key={i} style={findingItem}>
                      <span style={{ color: '#7AB07A' }}>✓</span>
                      <span style={{ color: '#E5D4C2' }}>{inv.preference}</span>
                      <span style={metaText}>— {inv.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.variances.length > 0 && (
              <div>
                <div style={{ ...miniLabelInner, color: '#D4B85A' }}>{t('DIFFERED', 'KHÁC BIỆT')}</div>
                <ul style={findingsList}>
                  {report.variances.map((v, i) => (
                    <li key={i} style={findingItem}>
                      <span style={typeTag(v.type)}>{v.type.toUpperCase()}</span>
                      <span style={{ color: '#E5D4C2' }}>{v.preference}</span>
                      <span style={metaText}>— {v.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {report.synthesis && (
          <div style={synthesisBlock}>
            <div style={{ ...miniLabel, marginBottom: 10 }}>{t('SYNTHESIS', 'TỔNG HỢP')}</div>
            <p style={synthesisProse}>{report.synthesis}</p>
          </div>
        )}
      </div>

      {/* ── 5. FOOTER ── */}
      <div style={{ ...reportFooter, ...stagger(4) }}>
        {t('Analysis compares the three captured runs in this session. Nothing is saved. Verdict is reproducible across re-runs; classification of borderline items may rephrase.', 'Phân tích so sánh ba lần chạy đã ghi lại trong phiên này. Không có gì được lưu. Kết luận có thể tái lập qua các lần chạy lại; cách phân loại các mục ở ranh giới có thể được diễn đạt lại.')}
      </div>
    </div>
  )
}

function VerdictReading({ tone, headline, verdict }: {
  tone: 'safety' | 'amber' | 'green'
  headline: string
  verdict: ConsistencyReport['verdict']
}) {
  const { t } = useLang()
  if (tone === 'safety') {
    return (
      <div style={verdictBarSafety}>
        <div style={{ ...miniLabel, color: '#FFFFFF', marginBottom: 6, letterSpacing: '0.18em' }}>
          {t('⛔ SAFETY INCONSISTENCY', '⛔ KHÔNG NHẤT QUÁN VỀ AN TOÀN')}
        </div>
        <div style={{
          fontFamily: "'Rampant Sans', serif", fontSize: 19, fontWeight: 500,
          color: '#FFFFFF', letterSpacing: '0.03em', lineHeight: 1.4,
        }}>
          {headline}
        </div>
        <div style={{
          marginTop: 6,
          fontFamily: "'Google Sans Code', monospace", fontSize: 11,
          color: '#FFFFFF', opacity: 0.92, letterSpacing: '0.04em',
        }}>
          {t('The medical and identity guardrails are enforced in code and cannot vary for the same input. This indicates a code defect — investigate immediately.', 'Các rào chắn y tế và danh tính được thực thi trong mã và không thể thay đổi với cùng một đầu vào. Điều này cho thấy một lỗi mã — hãy điều tra ngay lập tức.')}
        </div>
      </div>
    )
  }
  if (tone === 'amber') {
    return (
      <div style={verdictBarAmber}>
        <div style={{ ...miniLabel, color: '#D4B85A', marginBottom: 4 }}>
          {t('JUDGMENT VARIANCE', 'BIẾN THIÊN ĐÁNH GIÁ')}
        </div>
        <div style={{
          fontFamily: "'Rampant Sans', serif", fontSize: 17, fontWeight: 500,
          color: '#E5D4C2', letterSpacing: '0.04em',
        }}>
          {headline}
        </div>
      </div>
    )
  }
  // Stable — calm, low-contrast, single line.
  return (
    <div style={verdictBarStable}>
      <div style={{ ...miniLabel, color: '#7AB07A', marginBottom: 4 }}>
        {t('JUDGMENT STABLE', 'ĐÁNH GIÁ ỔN ĐỊNH')}
      </div>
      <div style={{
        fontFamily: "'Rampant Sans', serif", fontSize: 17, fontWeight: 500,
        color: '#E5D4C2', letterSpacing: '0.04em',
      }}>
        {headline}
      </div>
    </div>
  )
  void verdict
}

function MatrixLegend() {
  const { t } = useLang()
  return (
    <div style={matrixLegend}>
      <span style={legendItem}>
        <span style={legendMarker('#7AB07A', 'solid')} />
        {t('held identically', 'giữ nguyên y hệt')}
      </span>
      <span style={legendItem}>
        <span style={legendMarker('#D4B85A', 'solid')} />
        {t('moved factor (Δ)', 'yếu tố thay đổi (Δ)')}
      </span>
      <span style={legendItem}>
        <span style={legendMarker('#B2AA98', 'dashed')} />
        {t('granularity gap', 'khoảng trống độ chi tiết')}
      </span>
      <span style={legendItem}>
        <span style={legendMarker('#E58F4A', 'dashed')} />
        {t('matcher miss — alignment failure', 'khớp hụt — không căn được')}
      </span>
    </div>
  )
}

function MatrixRow({ row }: { row: MatrixRowData }) {
  const { t } = useLang()
  const [expanded, setExpanded] = useState(false)
  const hasDrift = row.driftedFactors.size > 0
  const hasMatcherMiss = row.cells.some(c => c.kind === 'matcher_miss')
  const rowDriftsOrGaps =
    hasDrift ||
    hasMatcherMiss ||
    row.cells.some(c => c.kind === 'granularity_gap')
  const tone: 'safety' | 'judgment' | 'granularity' | 'matcher' | 'stable' =
      row.classification === 'safety'      ? 'safety'
    : hasMatcherMiss                       ? 'matcher'
    : row.classification === 'judgment'    ? 'judgment'
    : row.classification === 'granularity' ? 'granularity'
    :                                        'stable'

  return (
    <>
      <div
        style={matrixRowStyle(tone)}
        onClick={() => rowDriftsOrGaps && setExpanded(e => !e)}
        title={rowDriftsOrGaps ? t('click to expand', 'nhấp để mở rộng') : ''}
      >
        <div style={matrixRowPrefCell}>
          {hasDrift && <span style={{ color: '#D4B85A', marginRight: 6 }}>Δ</span>}
          {row.classification === 'safety' && !hasDrift && <span style={{ color: '#C27070', marginRight: 6 }}>⚠</span>}
          {row.classification === 'granularity' && !hasDrift && !hasMatcherMiss && <span style={{ color: '#B2AA98', marginRight: 6 }}>⊘</span>}
          <span style={{ color: tone === 'stable' ? '#B2AA98' : '#E5D4C2' }}>
            {row.preference}
          </span>
          {rowDriftsOrGaps && (
            <span style={{ ...metaText, marginLeft: 6, fontSize: 9 }}>
              {expanded ? '▾' : '▸'}
            </span>
          )}
        </div>
        {row.cells.map((cell, i) => (
          <MatrixCellView key={i} cell={cell} deviance={row.deviance[i] || {}} />
        ))}
      </div>
      {expanded && rowDriftsOrGaps && (
        <div style={matrixDrilldown}>
          <div style={{ ...metaText, marginBottom: 10 }}>{row.detail}</div>
          <div style={drilldownGrid}>
            {row.cells.map((cell, i) => (
              <div key={i} style={drilldownCol}>
                <div style={{ ...miniLabel, marginBottom: 6 }}>{t('Run', 'Lần chạy')} {i + 1}</div>
                {cell.kind === 'present' ? (
                  <>
                    <div style={drilldownFactors}>
                      <div style={drilldownFactorRow}>
                        <span style={drilldownFactorLabel}>S₀</span>
                        <span style={drilldownFactorValue(row.deviance[i]?.s0 || false)}>{cell.pref.s0}</span>
                      </div>
                      <div style={drilldownFactorRow}>
                        <span style={drilldownFactorLabel}>C</span>
                        <span style={drilldownFactorValue(row.deviance[i]?.c || false)}>{cell.pref.confidence.toFixed(2)}</span>
                      </div>
                      <div style={drilldownFactorRow}>
                        <span style={drilldownFactorLabel}>λ</span>
                        <span style={drilldownFactorValue(row.deviance[i]?.lambda || false)}>{cell.pref.lambda.toFixed(3)}</span>
                      </div>
                      <div style={drilldownFactorRow}>
                        <span style={drilldownFactorLabel}>F</span>
                        <span style={drilldownFactorValue(row.deviance[i]?.f || false)}>{cell.pref.frequency.toFixed(1)}</span>
                      </div>
                    </div>
                    {rationaleSummary(cell.pref.rationale) && (
                      <div style={drilldownRationale}>
                        <span style={{ color: '#7E7864' }}>{t('rationale: ', 'lý giải: ')}</span>
                        {rationaleSummary(cell.pref.rationale)}
                      </div>
                    )}
                  </>
                ) : cell.kind === 'granularity_gap' ? (
                  <div style={drilldownAbsence('granularity')}>
                    <strong>{t('absent', 'vắng mặt')}</strong> {t('— split/merged differently in this run (cosmetic, expected)', '— được tách/gộp khác đi trong lần chạy này (hình thức, dự kiến)')}
                  </div>
                ) : (
                  <div style={drilldownAbsence('matcher')}>
                    <strong>{t('unmatched', 'không khớp')}</strong> {t("— analyser said this preference should be present here, but the UI couldn't confidently align a row by name. Not a system finding; a UI matcher limitation.", '— trình phân tích nói sở thích này lẽ ra phải có ở đây, nhưng giao diện không thể căn một dòng theo tên một cách chắc chắn. Không phải phát hiện của hệ thống; là giới hạn của bộ khớp giao diện.')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function MatrixCellView({ cell, deviance }: {
  cell: MatrixCell
  deviance: { s0?: boolean; c?: boolean; lambda?: boolean; f?: boolean }
}) {
  const { t } = useLang()
  if (cell.kind === 'granularity_gap') {
    return (
      <div style={matrixCellGap} title={t('absent — split/merged differently across runs (granularity)', 'vắng mặt — được tách/gộp khác đi giữa các lần chạy (độ chi tiết)')}>
        <span style={{ color: '#7E7864', letterSpacing: '0.4em' }}>· · ·</span>
      </div>
    )
  }
  if (cell.kind === 'matcher_miss') {
    return (
      <div
        style={matrixCellMatcherMiss}
        title={t("alignment failure — analyser said this preference should be present in this run, but the UI couldn't confidently match a row by name. Not a system inconsistency; a matcher limitation.", 'lỗi căn chỉnh — trình phân tích nói sở thích này lẽ ra phải có trong lần chạy này, nhưng giao diện không thể khớp một dòng theo tên một cách chắc chắn. Không phải sự không nhất quán của hệ thống; là giới hạn của bộ khớp.')}
      >
        <span style={{ color: '#E58F4A' }}>{t('unmatched', 'không khớp')}</span>
      </div>
    )
  }
  const p = cell.pref
  return (
    <div style={matrixCellPresent(p.lambda_origin)}>
      <span style={mono}>
        <span style={factorChar(deviance.s0 || false)}>{p.s0}</span>
        <span style={factorSep}>/</span>
        <span style={factorChar(deviance.c || false)}>{p.confidence.toFixed(2)}</span>
        <span style={factorSep}>/</span>
        <span style={factorChar(deviance.lambda || false)}>{p.lambda.toFixed(3)}</span>
      </span>
    </div>
  )
}

// ─── Breadth table ───────────────────────────────────────────────────────────

function BreadthTable({
  preferences, members, onPick,
}: {
  preferences: PreferenceRow[]
  members: MemberSummary[]
  onPick: (memberNo: string, prefId: string) => void
}) {
  const { t } = useLang()
  const statByMember = useMemo(() => {
    const m = new Map<string, MemberSummary>()
    for (const x of members) m.set(x.member_no, x)
    return m
  }, [members])

  const [sortBy, setSortBy] = useState<'category' | 'pst' | 'days' | 'origin'>('category')
  const [filterText, setFilterText] = useState('')

  const rows = useMemo(() => {
    const enriched = preferences.map(p => {
      const mem = statByMember.get(p.member_no) || null
      const r = computePSt({
        s0: p.s0, confidence: p.confidence, lambda: p.lambda, frequency: p.frequency,
        validationCount: p.validation_count,
        lastValidatedISO: p.last_validated || new Date().toISOString().slice(0, 10),
      }, { avgVisitsPerMonth: mem?.avg_visits_per_month ?? null })
      return {
        ...p,
        member_name: mem?.full_name || p.member_no,
        pst: r.pst,
        days: r.daysSince,
        needsRevalidation: r.needsRevalidation,
      }
    })

    const q = filterText.trim().toLowerCase()
    const filtered = q ? enriched.filter(r =>
      `${r.preference_name} ${r.category} ${r.member_name} ${r.lambda_origin || ''}`.toLowerCase().includes(q)
    ) : enriched

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'pst':      return b.pst - a.pst
        case 'days':     return b.days - a.days
        case 'origin':   return (a.lambda_origin || 'z').localeCompare(b.lambda_origin || 'z')
        default:         return a.category.localeCompare(b.category) || b.pst - a.pst
      }
    })
    return filtered
  }, [preferences, statByMember, sortBy, filterText])

  return (
    <>
      <div style={breadthControls}>
        <input
          type="text"
          placeholder={t('Filter by name, category, member, or origin…', 'Lọc theo tên, danh mục, hội viên, hoặc nguồn gốc…')}
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={breadthFilter}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['category', 'pst', 'days', 'origin'] as const).map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={sortBy === key ? sortChipActive : sortChip}
            >
              {key === 'category' ? t('category', 'danh mục') : key === 'days' ? t('days', 'ngày') : key === 'origin' ? t('origin', 'nguồn') : key}
            </button>
          ))}
        </div>
      </div>
      <div style={breadthScroll}>
        <table style={breadthTable}>
          <thead>
            <tr>
              <th style={thLeft}>{t('Preference', 'Sở thích')}</th>
              <th style={th}>{t('Member', 'Hội viên')}</th>
              <th style={th}>{t('Category', 'Danh mục')}</th>
              <th style={thNum}>λ</th>
              <th style={thNum}>{t('days', 'ngày')}</th>
              <th style={thNum}>PS(t)</th>
              <th style={th}>{t('origin', 'nguồn')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.preference_id} onClick={() => onPick(r.member_no, r.preference_id)} style={tr}>
                <td style={tdLeft}>
                  {r.preference_name}
                  {r.needsRevalidation && <span style={{ color: '#C27070', marginLeft: 6 }}>{t('·flag', '·cờ')}</span>}
                </td>
                <td style={td}>{r.member_name}</td>
                <td style={td}>{r.category}</td>
                <td style={tdNum}>{r.lambda.toFixed(3)}</td>
                <td style={tdNum}>{r.days}</td>
                <td style={tdNum}>
                  <span style={{ color: r.pst >= 0.7 * r.s0 ? '#E5D4C2' : '#C27070' }}>
                    {r.pst.toFixed(2)}
                  </span>
                </td>
                <td style={td}>
                  <span style={originPill(r.lambda_origin || '(null)')}>{(r.lambda_origin || t('none', 'không')).replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={metaText}>{rows.length} {t('row', 'dòng')}{rows.length === 1 ? '' : t('s', '')} · {t('click any row to focus the decomposition above.', 'nhấp bất kỳ dòng nào để tập trung phân rã ở trên.')}</div>
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 14px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 880, margin: 0,
}
const panel: React.CSSProperties = {
  marginTop: 24, padding: 24,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10,
}
const panelHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  marginBottom: 16, gap: 16, flexWrap: 'wrap',
}
const panelEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const panelTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', marginTop: 4,
}
const metaText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#7E7864',
}
const pickerRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18,
}
const pickerLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const pickerInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, outline: 'none',
}
const decompGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 24, alignItems: 'start',
}
const decompLeft: React.CSSProperties = { minWidth: 0 }
const decompRight: React.CSSProperties = { minWidth: 0 }
const prefCategoryBadge: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.10em', textTransform: 'uppercase',
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 3, marginRight: 6,
}
const prefName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', marginTop: 6,
}
const prefDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.85, marginTop: 4, lineHeight: 1.6,
}
const factorList: React.CSSProperties = {
  marginTop: 14, display: 'flex', flexDirection: 'column', gap: 2,
}
const factorRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '180px 100px 1fr',
  alignItems: 'baseline', padding: '6px 0',
  borderBottom: '1px solid rgba(229,212,194,0.05)',
}
const factorLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.06em',
}
const factorValue: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 13,
}
const factorNote: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.65,
}
const resultRow: React.CSSProperties = {
  marginTop: 14, padding: '12px 0',
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
  borderTop: '1px solid rgba(229,212,194,0.10)',
  borderBottom: '1px solid rgba(229,212,194,0.10)',
}
const resultMid: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 14,
  color: '#B2AA98', marginTop: 4,
}
const resultBig: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 600,
  color: '#D4B85A', marginTop: 4,
}
const flagRow: React.CSSProperties = {
  marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap',
}
const flagPill = (tone: 'gold' | 'red' | 'green'): React.CSSProperties => {
  const p = {
    gold:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.12)', bd: 'rgba(212,184,90,0.35)' },
    red:   { fg: '#C27070', bg: 'rgba(194,112,112,0.12)', bd: 'rgba(194,112,112,0.40)' },
    green: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.12)', bd: 'rgba(122,176,122,0.30)' },
  }[tone]
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 10,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '3px 8px',
    letterSpacing: '0.06em',
  }
}
function originPill(o: string): React.CSSProperties {
  const palette: Record<string, { fg: string; bg: string; bd: string }> = {
    ai_specific:                { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)', bd: 'rgba(212,184,90,0.30)' },
    category_baseline_learned:  { fg: '#7AB07A', bg: 'rgba(122,176,122,0.10)', bd: 'rgba(122,176,122,0.30)' },
    category_baseline_designed: { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.18)' },
    forced_medical:             { fg: '#C27070', bg: 'rgba(194,112,112,0.12)', bd: 'rgba(194,112,112,0.40)' },
    forced_identity:            { fg: '#D4B85A', bg: 'rgba(212,184,90,0.14)', bd: 'rgba(212,184,90,0.45)' },
    ai_permanent:               { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)', bd: 'rgba(212,184,90,0.50)' },
    '(null)':                   { fg: '#7E7864', bg: 'rgba(229,212,194,0.04)', bd: 'rgba(229,212,194,0.10)' },
  }
  const p = palette[o] || palette['(null)']
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '2px 7px',
    letterSpacing: '0.06em', textTransform: 'uppercase', display: 'inline-block',
  }
}
const chartCaption: React.CSSProperties = {
  marginTop: 8, fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const breadthControls: React.CSSProperties = {
  display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap',
}
const breadthFilter: React.CSSProperties = {
  flex: 1, minWidth: 220,
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, outline: 'none',
}
const sortChip: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
  textTransform: 'lowercase',
}
const sortChipActive: React.CSSProperties = {
  ...sortChip, color: '#D4B85A',
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.35)',
}
const breadthScroll: React.CSSProperties = {
  maxHeight: 480, overflowY: 'auto', overflowX: 'auto',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
  marginBottom: 8,
}
const breadthTable: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px',
  color: '#7E7864', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 9,
  background: 'rgba(5,46,32,0.6)', position: 'sticky', top: 0,
  borderBottom: '1px solid rgba(229,212,194,0.10)',
}
const thLeft: React.CSSProperties = { ...th, paddingLeft: 14 }
const thNum: React.CSSProperties = { ...th, textAlign: 'right' }
const tr: React.CSSProperties = {
  cursor: 'pointer',
}
const td: React.CSSProperties = {
  padding: '6px 10px', color: '#B2AA98',
  borderBottom: '1px solid rgba(229,212,194,0.04)',
}
const tdLeft: React.CSSProperties = { ...td, paddingLeft: 14, color: '#E5D4C2' }
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' }
const empty: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}

// Panel 2 styles
const posteriorCard: React.CSSProperties = {
  padding: 16,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8,
}
const catName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const posteriorGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14,
  marginBottom: 14,
}
const miniLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const posteriorBig: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 16,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const ciRail: React.CSSProperties = {
  position: 'relative', height: 20, marginTop: 6, marginBottom: 4,
  background: 'rgba(229,212,194,0.04)', borderRadius: 2,
}
const ciRailScale: React.CSSProperties = {
  position: 'absolute', top: 22, left: 0, right: 0,
  display: 'flex', justifyContent: 'space-between',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864',
}
const progressTrack: React.CSSProperties = {
  height: 6, background: 'rgba(229,212,194,0.06)', borderRadius: 3, overflow: 'hidden',
}
function posteriorStatusPill(s: 'active' | 'proposed' | 'insufficient_data' | 'no_fit_yet'): React.CSSProperties {
  const palette = {
    active:            { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
    proposed:          { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)',  bd: 'rgba(212,184,90,0.40)'  },
    insufficient_data: { fg: '#9E8FC4', bg: 'rgba(158,143,196,0.10)', bd: 'rgba(158,143,196,0.30)' },
    no_fit_yet:        { fg: '#7E7864', bg: 'rgba(229,212,194,0.04)', bd: 'rgba(229,212,194,0.10)' },
  }[s]
  return {
    background: palette.bg, color: palette.fg, border: `1px solid ${palette.bd}`,
    borderRadius: 3, padding: '2px 8px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}

// Panel 5 styles
const vitalsGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14,
}
const vitalsSubgrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14,
  marginTop: 14,
}
const vitalCard: React.CSSProperties = {
  padding: 14,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const vitalCardSm: React.CSSProperties = { ...vitalCard, padding: 12 }
const vitalBig: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 26, fontWeight: 600,
  letterSpacing: '0.02em', marginBottom: 4,
}
function catStatChip(s: 'active' | 'proposed' | 'insufficient_data' | 'no_fit_yet'): React.CSSProperties {
  return { ...posteriorStatusPill(s), fontSize: 9 }
}

// Transport pill + refresh button + demo gate pill styles
function transportPill(tone: 'green' | 'gold' | 'grey'): React.CSSProperties {
  const p = {
    green: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.12)', bd: 'rgba(122,176,122,0.40)' },
    gold:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.12)', bd: 'rgba(212,184,90,0.40)' },
    grey:  { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.18)' },
  }[tone]
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: "'Google Sans Code', monospace", fontSize: 10,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '4px 10px',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
}
function transportDot(tone: 'green' | 'gold' | 'grey'): React.CSSProperties {
  return {
    display: 'inline-block', width: 7, height: 7, borderRadius: 4,
    background: tone === 'green' ? '#7AB07A' : tone === 'gold' ? '#D4B85A' : '#B2AA98',
    boxShadow: tone === 'green' ? '0 0 6px rgba(122,176,122,0.7)' : 'none',
  }
}
const chevronBtn: React.CSSProperties = {
  background: 'transparent', color: '#7E7864',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  width: 28, height: 28, padding: 0,
  marginLeft: 'auto',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
const chevronGlyph: React.CSSProperties = {
  display: 'inline-block', fontSize: 12, lineHeight: 1,
  transition: 'transform 180ms ease-out',
}
const collapseAllBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.04em', cursor: 'pointer',
}
const refreshBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4,
  padding: '6px 14px', letterSpacing: '0.06em', cursor: 'pointer',
}
function refreshGlyph(busy: boolean): React.CSSProperties {
  return {
    display: 'inline-block', fontSize: 14,
    animation: busy ? 'rc-spin 0.8s linear infinite' : 'none',
    color: busy ? '#D4B85A' : '#B2AA98',
  }
}
const demoGatePill: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#C27070', background: 'rgba(194,112,112,0.10)',
  border: '1px solid rgba(194,112,112,0.35)', borderRadius: 3,
  padding: '4px 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
}

// Panel 3 styles
const baselineCard: React.CSSProperties = {
  padding: 14,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
  transition: 'all 0.3s ease',
}
const loopLede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.8, lineHeight: 1.7, margin: '0 0 14px',
  maxWidth: 880,
}
const demoBlock: React.CSSProperties = {
  marginTop: 6, padding: 16,
  background: 'rgba(194,112,112,0.04)',
  border: '1px dashed rgba(194,112,112,0.30)', borderRadius: 6,
}
const demoBlockClosed: React.CSSProperties = {
  marginTop: 6, padding: '10px 14px',
  background: 'rgba(229,212,194,0.02)',
  border: '1px dashed rgba(229,212,194,0.10)', borderRadius: 6,
}
const demoEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#C27070', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const demoControls: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end', marginTop: 10,
}
const demoBtn: React.CSSProperties = {
  background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 4,
  padding: '8px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
const demoBtnDanger: React.CSSProperties = {
  ...demoBtn, color: '#C27070',
  background: 'rgba(194,112,112,0.12)', border: '1px solid rgba(194,112,112,0.40)',
}
const demoActivePill: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#C27070', background: 'rgba(194,112,112,0.12)',
  border: '1px solid rgba(194,112,112,0.40)', borderRadius: 3,
  padding: '4px 10px', letterSpacing: '0.06em',
  animation: 'rc-pulse 1.2s ease-in-out infinite',
}

// Panel 4 styles
const emptyFeedBlock: React.CSSProperties = {
  padding: '32px 24px',
  background: 'rgba(229,212,194,0.02)',
  border: '1px dashed rgba(229,212,194,0.10)', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', maxWidth: 760,
}
const loopTicker: React.CSSProperties = {
  marginBottom: 14, padding: 14,
  background: 'rgba(122,176,122,0.06)',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6,
}
const loopTickerRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
  borderBottom: '1px solid rgba(122,176,122,0.10)',
}
const feedList: React.CSSProperties = {
  maxHeight: 480, overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 4,
  border: '1px solid rgba(229,212,194,0.06)', borderRadius: 6,
  padding: 8,
}
const feedRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '8px 10px',
  borderBottom: '1px solid rgba(229,212,194,0.04)',
}
const feedRowLoop: React.CSSProperties = {
  background: 'rgba(122,176,122,0.04)',
  borderLeft: '2px solid #7AB07A',
}
const feedDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 4, marginTop: 5,
  flexShrink: 0,
}
const feedLine1: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
}
const feedLine2: React.CSSProperties = {
  marginTop: 2,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.8, lineHeight: 1.5,
}

// Panel 6 styles
const demoControlsRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 10,
}
const demoTextarea: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: 14, background: 'rgba(5,46,32,0.5)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  lineHeight: 1.6, resize: 'vertical', outline: 'none',
  minHeight: 140,
}
const btnGhostDemo: React.CSSProperties = {
  background: 'rgba(229,212,194,0.10)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.15)', borderRadius: 4,
  padding: '8px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
const demoSummaryBanner: React.CSSProperties = {
  marginTop: 14, padding: '12px 16px',
  background: 'rgba(122,176,122,0.06)',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.7,
}
const demoExtractedList: React.CSSProperties = {
  marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8,
  maxHeight: 560, overflowY: 'auto',
  border: '1px solid rgba(229,212,194,0.06)', borderRadius: 6,
  padding: 10,
}
const demoPrefCard: React.CSSProperties = {
  padding: 14,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const demoIndex: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const demoPrefName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', marginTop: 4,
}
const demoPrefDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.85, marginTop: 4, lineHeight: 1.6,
}
const demoPrefQuote: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.75, fontStyle: 'italic',
  borderLeft: '2px solid rgba(212,184,90,0.30)',
  paddingLeft: 12, marginTop: 8, lineHeight: 1.6,
}
const demoFactorRow: React.CSSProperties = {
  display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10,
  paddingTop: 8, borderTop: '1px solid rgba(229,212,194,0.06)',
}
const demoFactor: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#7E7864', letterSpacing: '0.04em',
}
const liveTag: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.06em', fontStyle: 'italic',
}
// Probe edge flags — both rendered with dashed borders so they're visually
// distinct from the solid origin badges, and clearly read as ADVISORY
// (attention, not verdict). The medical-adjacent badge is deliberately NOT
// green — it does not certify the non-firing as correct, only flags it for
// the human to judge.
const attentionBadge: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', background: 'rgba(212,184,90,0.06)',
  border: '1px dashed rgba(212,184,90,0.45)',
  borderRadius: 3, padding: '2px 8px',
  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'help',
}
const attentionBadgeMedicalAdjacent: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#E58F4A', background: 'rgba(229,143,74,0.08)',
  border: '1px dashed rgba(229,143,74,0.50)',
  borderRadius: 3, padding: '2px 8px',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  cursor: 'help',
}
const rationaleToggle: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
}
const rationaleSummaryLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.6,
  paddingBottom: 8, marginBottom: 8,
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  fontStyle: 'italic',
}
const rationaleFactorRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '24px 56px 1fr', gap: 8,
  alignItems: 'baseline',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  lineHeight: 1.55,
}
const rationaleFactorRowForced: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '24px 56px 22px 1fr', gap: 6,
  alignItems: 'baseline',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  lineHeight: 1.55,
}
const rationaleFactorLabel: React.CSSProperties = {
  color: '#7E7864', letterSpacing: '0.06em',
}
const rationaleFactorValue: React.CSSProperties = {
  color: '#E5D4C2', fontWeight: 600,
}
const lockGlyph: React.CSSProperties = {
  fontSize: 10, opacity: 0.85,
}
const rationaleFactorText: React.CSSProperties = {
  color: '#B2AA98', lineHeight: 1.6,
}
const rationaleFactorTextForced: React.CSSProperties = {
  color: '#D4B85A', lineHeight: 1.6,
  fontStyle: 'italic',
}
const rationaleBlock: React.CSSProperties = {
  marginTop: 6, padding: '8px 12px',
  background: 'rgba(212,184,90,0.04)',
  border: '1px solid rgba(212,184,90,0.18)',
  borderLeft: '2px solid #D4B85A',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.6,
}
const droppedStrip: React.CSSProperties = {
  marginTop: 14, padding: 12,
  background: 'rgba(194,112,112,0.04)',
  border: '1px dashed rgba(194,112,112,0.30)', borderRadius: 6,
}
const droppedRow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  padding: '2px 0', lineHeight: 1.6,
}
// Probe runs + compare view
const probeRunsStrip: React.CSSProperties = {
  marginTop: 16, padding: 14,
  background: 'rgba(229,212,194,0.02)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const probeRunRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '4px 8px', borderRadius: 4,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.06)',
}
const probeRunButton: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'baseline', gap: 4,
  background: 'transparent', border: 'none',
  padding: '6px 4px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
  cursor: 'pointer', textAlign: 'left',
}
const probeCompareWrap: React.CSSProperties = {
  marginTop: 16, padding: 14,
  background: 'rgba(5,46,32,0.5)',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 6,
}
const probeCompareGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
}
const probeCompareCol: React.CSSProperties = {
  padding: 12,
  background: 'rgba(229,212,194,0.02)',
  border: '1px solid rgba(229,212,194,0.06)', borderRadius: 4,
}
const probeCompareHeader: React.CSSProperties = {
  marginBottom: 10, paddingBottom: 8,
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2',
}
const probeCompareCatBlock: React.CSSProperties = {
  padding: '8px 10px',
  background: 'rgba(5,46,32,0.3)',
  border: '1px solid rgba(229,212,194,0.05)', borderRadius: 4,
}
const probeCompareRow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  padding: '3px 0', lineHeight: 1.5,
}

// Consistency analyser
const consistencyControl: React.CSSProperties = {
  marginTop: 14, padding: 12,
  background: 'rgba(212,184,90,0.04)',
  border: '1px solid rgba(212,184,90,0.20)', borderRadius: 6,
}
const analysisBtn: React.CSSProperties = {
  background: 'rgba(212,184,90,0.16)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.50)', borderRadius: 4,
  padding: '8px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
  fontWeight: 600,
}
const consistencyReportWrap: React.CSSProperties = {
  marginTop: 14, padding: 20,
  background: 'rgba(5,46,32,0.55)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
}

// Staggered reveal — applied via inline style with animation-delay per section.
// Restrained: a brief 6px rise + fade-in. The keyframes are emitted alongside
// the existing rc-pulse/rc-spin keyframes at the top of the render.
function stagger(idx: number): React.CSSProperties {
  return {
    animation: 'rc-reveal 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
    animationDelay: `${idx * 80}ms`,
  }
}

// ── Verdict reading (three distinct registers) ──
const verdictBarStable: React.CSSProperties = {
  padding: '14px 18px',
  background: 'rgba(122,176,122,0.06)',
  border: '1px solid rgba(122,176,122,0.28)',
  borderLeft: '3px solid rgba(122,176,122,0.55)',
  borderRadius: 6,
}
const verdictBarAmber: React.CSSProperties = {
  padding: '14px 18px',
  background: 'rgba(212,184,90,0.06)',
  border: '1px solid rgba(212,184,90,0.35)',
  borderLeft: '3px solid #D4B85A',
  borderRadius: 6,
}
const verdictBarSafety: React.CSSProperties = {
  padding: '20px 22px',
  background: 'linear-gradient(135deg, #C27070 0%, #A85858 100%)',
  border: '2px solid #C27070',
  borderRadius: 6,
  marginLeft: -22, marginRight: -22, marginTop: -20,
  borderTopLeftRadius: 8, borderTopRightRadius: 8,
  boxShadow: '0 0 0 1px rgba(194,112,112,0.7), 0 0 22px rgba(194,112,112,0.45)',
  animation: 'rc-safety-attention 0.6s ease-out both',
}

// ── Evidence tally + counts line ──
const evidenceTally: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.06em',
}
function tallyValue(color: string): React.CSSProperties {
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 14,
    color, fontWeight: 600, marginRight: 4,
  }
}
const tallyDivider: React.CSSProperties = {
  color: '#5E6650', margin: '0 2px',
}
const countsLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}

// ── Safety + permanence sub-bands ──
// Two distinct severities, never collapsed into one. ⛔ / red / the word
// "safety" appears ONLY in the medical sub-band's alarm state. Permanence
// drift renders amber Δ at most; never red, never ⛔, never "safety."

function subBand(tone: 'calm' | 'amber' | 'alarm'): React.CSSProperties {
  if (tone === 'alarm') return {
    marginTop: 10, padding: 14,
    background: 'rgba(194,112,112,0.10)',
    border: '1px solid rgba(194,112,112,0.55)',
    borderLeft: '3px solid #C27070',
    borderRadius: 6,
  }
  if (tone === 'amber') return {
    marginTop: 10, padding: 14,
    background: 'rgba(212,184,90,0.05)',
    border: '1px solid rgba(212,184,90,0.30)',
    borderLeft: '3px solid #D4B85A',
    borderRadius: 6,
  }
  // calm
  return {
    marginTop: 10, padding: 14,
    background: 'rgba(122,176,122,0.04)',
    border: '1px solid rgba(122,176,122,0.28)',
    borderLeft: '3px solid rgba(122,176,122,0.55)',
    borderRadius: 6,
  }
}
const subBandHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
  marginBottom: 10,
}
function lockedRowStyle(tone:
  | 'medical_calm' | 'medical_alarm'
  | 'identity_calm' | 'identity_alarm'
  | 'permanence_calm' | 'permanence_amber'
): React.CSSProperties {
  const cfg =
      tone === 'medical_alarm'    ? { border: '#C27070',                bg: 'rgba(194,112,112,0.14)' }
    : tone === 'medical_calm'     ? { border: 'rgba(122,176,122,0.45)', bg: 'transparent' }
    : tone === 'identity_alarm'   ? { border: '#C27070',                bg: 'rgba(194,112,112,0.14)' }
    : tone === 'identity_calm'    ? { border: 'rgba(122,176,122,0.45)', bg: 'transparent' }
    : tone === 'permanence_amber' ? { border: '#D4B85A',                bg: 'rgba(212,184,90,0.06)' }
    :                               { border: 'rgba(122,176,122,0.45)', bg: 'transparent' }
  return {
    display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
    fontFamily: "'Google Sans Code', monospace", fontSize: 12,
    padding: '4px 8px',
    borderLeft: `2px solid ${cfg.border}`,
    background: cfg.bg,
    borderRadius: 3,
  }
}

// ── Matrix legend + table ──
const matrixLegend: React.CSSProperties = {
  display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10,
}
const legendItem: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.06em', textTransform: 'uppercase',
}
function legendMarker(color: string, kind: 'solid' | 'dashed'): React.CSSProperties {
  return {
    display: 'inline-block', width: 14, height: 2,
    background: kind === 'solid' ? color : 'transparent',
    borderTop: kind === 'dashed' ? `1.5px dashed ${color}` : 'none',
  }
}
const matrixWrap: React.CSSProperties = {
  marginTop: 6,
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 6,
  overflow: 'hidden',
  background: 'rgba(5,46,32,0.5)',
}
const matrixHeader: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(260px, 2.4fr) repeat(3, minmax(120px, 1fr))',
  background: 'rgba(5,46,32,0.7)',
  borderBottom: '1px solid rgba(229,212,194,0.10)',
}
const matrixHeaderCellPref: React.CSSProperties = {
  padding: '10px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.12em', textTransform: 'uppercase',
}
const matrixHeaderCellRun: React.CSSProperties = {
  padding: '10px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.12em', textTransform: 'uppercase',
  borderLeft: '1px solid rgba(229,212,194,0.06)',
  textAlign: 'left',
}
function matrixRowStyle(tone: 'safety' | 'judgment' | 'granularity' | 'matcher' | 'stable'): React.CSSProperties {
  const borderLeft =
      tone === 'safety'      ? '3px solid #C27070'
    : tone === 'matcher'     ? '3px dashed #E58F4A'
    : tone === 'judgment'    ? '3px solid #D4B85A'
    : tone === 'granularity' ? '3px dashed rgba(178,170,152,0.40)'
    :                          '3px solid transparent'
  const bg =
      tone === 'safety'      ? 'rgba(194,112,112,0.05)'
    : tone === 'matcher'     ? 'rgba(229,143,74,0.04)'
    : tone === 'judgment'    ? 'rgba(212,184,90,0.04)'
    : tone === 'granularity' ? 'rgba(229,212,194,0.02)'
    :                          'transparent'
  return {
    display: 'grid', gridTemplateColumns: 'minmax(260px, 2.4fr) repeat(3, minmax(120px, 1fr))',
    borderBottom: '1px solid rgba(229,212,194,0.05)',
    borderLeft, background: bg,
    cursor: tone === 'stable' ? 'default' : 'pointer',
  }
}
const matrixRowPrefCell: React.CSSProperties = {
  padding: '8px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.04em',
  display: 'flex', alignItems: 'baseline', gap: 0,
}
const matrixCellGap: React.CSSProperties = {
  padding: '8px 12px',
  borderLeft: '1px solid rgba(229,212,194,0.06)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  textAlign: 'left',
}
const matrixCellMatcherMiss: React.CSSProperties = {
  padding: '8px 12px',
  borderLeft: '1px solid rgba(229,212,194,0.06)',
  background: 'rgba(229,143,74,0.06)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.06em',
  textAlign: 'left',
}
function matrixCellPresent(origin: DemoExtractedPref['lambda_origin']): React.CSSProperties {
  // Subtle origin-coded left edge so a cell's lock status is readable at a glance,
  // without competing with the row-level drift highlight.
  const edge =
      origin === 'forced_medical'  ? 'inset 2px 0 0 rgba(194,112,112,0.25)'
    : origin === 'forced_identity' ? 'inset 2px 0 0 rgba(212,184,90,0.30)'
    : origin === 'ai_permanent'    ? 'inset 2px 0 0 rgba(212,184,90,0.25)'
    : origin === 'ai_specific'     ? 'inset 2px 0 0 rgba(212,184,90,0.10)'
    :                                'inset 2px 0 0 rgba(178,170,152,0.10)'
  return {
    padding: '8px 12px',
    borderLeft: '1px solid rgba(229,212,194,0.06)',
    fontFamily: "'Google Sans Code', monospace", fontSize: 12,
    letterSpacing: '0.04em',
    boxShadow: edge,
    color: '#E5D4C2',
  }
}
const mono: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace",
}
function factorChar(deviant: boolean): React.CSSProperties {
  if (deviant) return {
    color: '#D4B85A', fontWeight: 600,
    background: 'rgba(212,184,90,0.12)',
    padding: '0 4px', borderRadius: 2,
    borderBottom: '1.5px solid #D4B85A',
  }
  return { color: '#E5D4C2' }
}
const factorSep: React.CSSProperties = {
  color: '#5E6650', margin: '0 4px',
}

// ── Drill-down ──
const matrixDrilldown: React.CSSProperties = {
  padding: '14px 16px',
  background: 'rgba(5,46,32,0.7)',
  borderBottom: '1px solid rgba(229,212,194,0.05)',
}
const drilldownGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
}
const drilldownCol: React.CSSProperties = {
  padding: 12,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const drilldownFactors: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8,
}
const drilldownFactorRow: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const drilldownFactorLabel: React.CSSProperties = {
  color: '#7E7864', width: 18,
}
function drilldownFactorValue(deviant: boolean): React.CSSProperties {
  if (deviant) return {
    color: '#D4B85A', fontWeight: 600,
    background: 'rgba(212,184,90,0.12)',
    padding: '0 5px', borderRadius: 2,
    borderBottom: '1.5px solid #D4B85A',
  }
  return { color: '#E5D4C2' }
}
const drilldownRationale: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', lineHeight: 1.6,
  marginTop: 8, paddingTop: 8,
  borderTop: '1px solid rgba(229,212,194,0.06)',
}
function drilldownAbsence(kind: 'granularity' | 'matcher'): React.CSSProperties {
  return {
    padding: '10px 12px',
    background: kind === 'granularity' ? 'rgba(229,212,194,0.04)' : 'rgba(229,143,74,0.06)',
    border: kind === 'granularity' ? '1px dashed rgba(229,212,194,0.18)' : '1px dashed rgba(229,143,74,0.40)',
    borderRadius: 4,
    fontFamily: "'Google Sans Code', monospace", fontSize: 10,
    color: kind === 'granularity' ? '#B2AA98' : '#E58F4A',
    lineHeight: 1.6,
  }
}

// ── Findings backbone + synthesis ──
const miniLabelInner: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 6,
}
const findingsList: React.CSSProperties = {
  margin: 0, padding: 0, listStyle: 'none',
  display: 'flex', flexDirection: 'column', gap: 4,
}
const findingItem: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  padding: '3px 8px',
  borderLeft: '2px solid rgba(229,212,194,0.08)',
}
function typeTag(type: 'granularity' | 'judgment' | 'safety'): React.CSSProperties {
  const t =
      type === 'safety'    ? { fg: '#FFFFFF', bg: '#C27070', bd: '#C27070' }
    : type === 'judgment'  ? { fg: '#D4B85A', bg: 'rgba(212,184,90,0.12)', bd: 'rgba(212,184,90,0.45)' }
    :                        { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.20)' }
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: t.fg, background: t.bg, border: `1px solid ${t.bd}`,
    borderRadius: 3, padding: '2px 7px',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    flexShrink: 0,
  }
}
const synthesisBlock: React.CSSProperties = {
  marginTop: 18, padding: '18px 20px',
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 6,
}
const synthesisProse: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Rampant Sans', serif", fontSize: 14,
  color: '#E5D4C2', lineHeight: 1.75, letterSpacing: '0.02em',
}
const reportFooter: React.CSSProperties = {
  marginTop: 16, paddingTop: 12,
  borderTop: '1px solid rgba(229,212,194,0.06)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', lineHeight: 1.6, fontStyle: 'italic',
}
function originBadge(tone: 'red' | 'gold' | 'green' | 'grey' | 'amber'): React.CSSProperties {
  const p = {
    red:   { fg: '#C27070', bg: 'rgba(194,112,112,0.14)', bd: 'rgba(194,112,112,0.50)' },
    gold:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)',  bd: 'rgba(212,184,90,0.30)'  },
    green: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.12)', bd: 'rgba(122,176,122,0.30)' },
    grey:  { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.18)' },
    amber: { fg: '#D4B85A', bg: 'rgba(212,184,90,0.18)',  bd: 'rgba(212,184,90,0.55)'  },
  }[tone]
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '2px 8px',
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}
