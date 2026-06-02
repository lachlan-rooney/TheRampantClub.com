'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  computePSt, decayCurve,
  type PrefInputs, type MemberEngagement,
} from '@/lib/mis/live-pst'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { OBSERVATORY_SAMPLES, type SampleTranscript } from '@/lib/observatory-samples'

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
    | 'ai_permanent'
  rationale: string | null
  uid: string
}
interface DemoReconciledSummary {
  count: number
  medicalForced: number
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
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [selectedPref, setSelectedPref] = useState<string | null>(null)
  const [tick, setTick] = useState(0)  // forces 1s recompute + countdown
  const [transport, setTransport] = useState<Transport>('probing')
  const [transportNote, setTransportNote] = useState<string>('probing supabase realtime…')
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
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | null>(null)
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'analysing' | 'done' | 'error'>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [demoTokens, setDemoTokens] = useState<{ input: number; output: number; cache_read: number; cache_created: number }>({ input: 0, output: 0, cache_read: 0, cache_created: 0 })
  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null])
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
      setDemoExtractError('Paste a transcript or load a sample first.')
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
            medicalForced: Number(payload.medicalForced) || 0,
            aiPermanent:   Number(payload.aiPermanent)   || 0,
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
    if (!analysableTriple) return
    setAnalysisError(null)
    setConsistencyReport(null)
    setAnalysisPhase('analysing')
    try {
      const r = await fetch('/api/admin/observatory/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runs: analysableTriple }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `analysis failed (${r.status})`)
      setConsistencyReport(j as ConsistencyReport)
      setAnalysisPhase('done')
    } catch (e) {
      setAnalysisError((e as Error).message)
      setAnalysisPhase('error')
    }
  }, [analysableTriple])

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
            setTransportNote('postgres_changes subscribed · live events arrive immediately')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            fallback(`realtime ${status.toLowerCase()} — falling back to 15s polling`)
          }
        })
      unsub = () => { try { sb.removeChannel(channel) } catch { /* ignore */ } }
    } catch (e) {
      fallback(`realtime init failed: ${(e as Error).message} — polling 15s`)
    }

    const timeoutId = setTimeout(
      () => fallback('realtime did not subscribe within 3s — polling 15s'),
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
  if (!snap) return <div style={empty}>Loading the live state…</div>

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rc-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes rc-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      ` }} />
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Intelligence · Live</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={pageTitle}>The Observatory</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
          A live, glass-box view of the system's mathematics. Every figure on this page traces to a real row.
          PS(t) is recomputed client-side from the stored inputs (λ, <code>last_validated</code>, validation
          count, member visit cadence) by the same formulas as the <code>preference_scores</code> SQL view,
          so the displayed number equals the system's number. The integer-day decay term only visibly steps
          at the UTC date boundary — the trajectory curve shows where the score is heading; the dot marks
          where it is now.
        </p>
      </div>

      {/* ─── Panel 1 — Live PS(t) decomposition ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 1 · Live decomposition</div>
            <div style={panelTitle}>PS(t) = S₀ · C · e<sup>−λt</sup> · F · R · M, capped at 5</div>
          </div>
        </div>

        <div style={pickerRow}>
          <label style={pickerLabel}>
            Member
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
                  {m.full_name} · {m.active_pref_count} prefs
                </option>
              ))}
            </select>
          </label>
          <label style={pickerLabel}>
            Preference
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
          <div style={empty}>This member has no active preferences.</div>
        )}
      </section>

      {/* ─── Panel 2 — Category decay posteriors ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 2 · Category posteriors</div>
            <div style={panelTitle}>Designed prior vs learned posterior, 95% credible interval, distance to event floor</div>
          </div>
          <div style={metaText}>
            {snap.vitals.category_status_counts.active} active ·
            {' '}{snap.vitals.category_status_counts.proposed} proposed ·
            {' '}{snap.vitals.category_status_counts.insufficient_data + snap.vitals.category_status_counts.no_fit_yet} awaiting evidence
          </div>
        </div>
        <CategoryPosteriorsTable categories={snap.categories} />
      </section>

      {/* ─── Panel 3 — Loop-closure / baseline inheritance ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 3 · Loop-closure · baseline inheritance</div>
            <div style={panelTitle}>What a new extraction would inherit right now</div>
          </div>
          {demoGate === 'open' && demoState !== 'idle' && (
            <span style={demoActivePill}>
              {demoState === 'promoting' ? 'promoting…' :
                demoState === 'reverting' ? 'reverting…' :
                  `DEMO ACTIVE · reverting in ${secondsLeft}s`}
            </span>
          )}
        </div>

        <p style={loopLede}>
          For each canonical category, this is the λ a new preference inherits when the AI doesn't emit a
          preference-specific signal. The source is <code>learned</code> when an active row exists in
          <code> learned_decay_constants</code> for that category, else <code>designed</code> (the prior
          centre from <code>lib/mis/decay-priors.ts</code>). This is what
          <code> buildCategoryBaselines(getActiveLearnedLambda(sb))</code> returns — the same call the
          intake route makes per request. Today every row reads <code>designed</code> because no proposal
          has been promoted yet.
        </p>

        <BaselineTable categories={snap.categories} demoCategory={demoState === 'active' ? demoCategory : null} />

        {/* Demo affordance */}
        {demoGate === 'open' ? (
          <div style={demoBlock}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={demoEyebrow}>DEV FIXTURE</span>
              <span style={metaText}>
                MIS_DEMO_ENABLED=1 detected. This promotes a real learned λ, shows what new extractions would
                inherit, then reverts. Not a mock.
              </span>
            </div>
            <div style={demoControls}>
              <label style={pickerLabel}>
                Category
                <select
                  value={demoCategory}
                  onChange={e => setDemoCategory(e.target.value)}
                  disabled={demoState !== 'idle'}
                  style={pickerInput}
                >
                  {snap.categories.map(c => (
                    <option key={c.category} value={c.category}>
                      {c.category} · designed {c.designed_lambda.toFixed(3)}{c.active ? ' · already active' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label style={pickerLabel}>
                Learned λ
                <select
                  value={demoLambda}
                  onChange={e => setDemoLambda(Number(e.target.value))}
                  disabled={demoState !== 'idle'}
                  style={pickerInput}
                >
                  {[0.002, 0.005, 0.010, 0.020].map(v => (
                    <option key={v} value={v}>{v.toFixed(3)} · half-life {Math.round(Math.LN2 / v)}d</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                {demoState === 'idle' && (
                  <button onClick={promoteDemo} style={demoBtn}>
                    Demonstrate the loop
                  </button>
                )}
                {demoState === 'active' && (
                  <button onClick={revertDemo} style={demoBtnDanger}>
                    Revert now
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
              {' '}Demo affordance disabled (<code>MIS_DEMO_ENABLED</code> not set to <code>1</code>).
              Baselines above are read-only; this guards production scoring from accidental promotion.
            </span>
          </div>
        ) : null}
      </section>

      {/* ─── Panel 4 — Live event stream + loop-closure ticker ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 4 · Live event stream</div>
            <div style={panelTitle}>Scoring events as they happen, with the mathematical consequence of each</div>
          </div>
          <div style={metaText}>
            {events.length === 0
              ? `watching… ${transport === 'realtime' ? 'Realtime subscribed' : transport === 'polling' ? 'polling every 15s' : 'probing transport'}`
              : `${events.length} event${events.length === 1 ? '' : 's'} · loop-closure: ${events.filter(e => e.loop_closure).length}`}
          </div>
        </div>
        <EventStream events={events} transport={transport} />
      </section>

      {/* ─── Panel 5 — Aggregate vitals ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 5 · Aggregate vitals</div>
            <div style={panelTitle}>What the system holds right now</div>
          </div>
        </div>
        <VitalsGrid vitals={snap.vitals} />
      </section>

      {/* ─── Panel 6 — Demo · Live extraction (gated, saves nothing) ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 6 · Demo · Live extraction</div>
            <div style={panelTitle}>Paste a transcript, watch the system extract preferences in real time</div>
          </div>
          {demoGate === 'open' && demoPhase !== 'idle' && demoPhase !== 'done' && (
            <span style={demoActivePill}>{demoPhase === 'streaming' ? 'extracting…' : demoPhase === 'reconciling' ? 'reconciling…' : 'error'}</span>
          )}
        </div>

        <p style={loopLede}>
          Demo runs the same engine as the live intake — same <code>buildSystemPrompt</code>, same
          <code> reconcile</code> from <code>lib/mis/extraction-decay.ts</code>, same Claude model, same SSE
          streaming. The only difference: there is no save path. Nothing reaches the database. <strong style={{ color: '#E5D4C2' }}>Demo runs on sample data. Nothing is saved.</strong>
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
                onCompareToggle={(id) => setCompareIds(([a, b]) => {
                  if (a === id) return [null, b]
                  if (b === id) return [a, null]
                  if (!a) return [id, b]
                  if (!b) return [a, id]
                  return [id, b]
                })}
              />
            )}
            {probeRuns.length > 0 && (
              <ConsistencyControl
                triple={analysableTriple}
                phase={analysisPhase}
                error={analysisError}
                onRun={runConsistencyAnalysis}
              />
            )}
            {consistencyReport && (
              <ConsistencyReportView report={consistencyReport} />
            )}
            {compareIds[0] && compareIds[1] && (
              <ProbeCompareView
                a={probeRuns.find(r => r.id === compareIds[0])!}
                b={probeRuns.find(r => r.id === compareIds[1])!}
                onClose={() => setCompareIds([null, null])}
              />
            )}
          </>
        ) : (
          <div style={demoBlockClosed}>
            <span style={demoEyebrow}>DEMO SURFACE</span>
            <span style={metaText}>
              {' '}Demo affordance disabled (<code>MIS_DEMO_ENABLED</code> not set to <code>1</code>).
              When enabled, this panel runs the live extraction pipeline on a bundled fictional
              transcript and streams the result here. No database write of any kind.
            </span>
          </div>
        )}
      </section>

      {/* ─── Breadth table — all active preferences ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Breadth · all {snap.preferences.length} active preferences</div>
            <div style={panelTitle}>Current PS(t) across the live profile</div>
          </div>
          <div style={metaText}>
            snapshot: {new Date(snap.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <BreadthTable preferences={snap.preferences} members={snap.members} onPick={(memberNo, prefId) => {
          setSelectedMember(memberNo)
          setSelectedPref(prefId)
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
        }} />
      </section>
    </>
  )
}

// ─── Decomposition card + trajectory SVG ─────────────────────────────────────

function Decomposition({ pref, member }: { pref: PreferenceRow; member: MemberSummary | null }) {
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
          {factorRow('S₀ — importance', pref.s0.toString())}
          {factorRow('C — confidence', pref.confidence.toFixed(2))}
          {factorRow('e^(−λt) — decay', r.decay.toFixed(4), `λ=${pref.lambda.toFixed(3)} · t=${r.daysSince}d (integer)`)}
          {factorRow('F — frequency', pref.frequency.toFixed(1))}
          {factorRow('R — reinforcement', r.reinforcement.toFixed(3), `vc=${pref.validation_count} · cap 1.30`)}
          {factorRow('M — engagement', r.engagement.toFixed(3),
            member?.avg_visits_per_month != null
              ? `avg ${member.avg_visits_per_month.toFixed(2)} visits/mo`
              : 'no visit history → neutral 1.0'
          )}
        </div>

        <div style={resultRow}>
          <div>
            <div style={factorLabel}>raw product</div>
            <div style={resultMid}>{r.rawProduct.toFixed(4)}</div>
          </div>
          <div>
            <div style={factorLabel}>PS(t) · capped at 5</div>
            <div style={resultBig}>{r.pst.toFixed(3)}</div>
          </div>
          <div>
            <div style={factorLabel}>0.7·S₀ threshold</div>
            <div style={resultMid}>{(0.7 * pref.s0).toFixed(2)}</div>
          </div>
        </div>

        <div style={flagRow}>
          {r.capped && <span style={flagPill('gold')}>cap binds — raw {r.rawProduct.toFixed(2)} {'>'} 5</span>}
          {r.needsRevalidation && <span style={flagPill('red')}>flagged for revalidation</span>}
          {pref.lambda === 0 && <span style={flagPill('red')}>medical · no decay</span>}
          {!r.capped && !r.needsRevalidation && pref.lambda > 0 && <span style={flagPill('green')}>healthy · within band</span>}
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
          Trajectory · {pref.lambda > 0 ? `half-life ≈ ${Math.round(Math.LN2 / pref.lambda)}d` : 'no decay'}
          {' · '}horizon 365d · dot = today (integer-day score)
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
        0.7·S₀ = {threshold.toFixed(2)} (revalidation line)
      </text>
      {/* trajectory */}
      <path d={pathD} fill="none" stroke="#D4B85A" strokeWidth={1.5} />
      {/* today line + dot */}
      <line x1={todayX} y1={padT} x2={todayX} y2={H - padB} stroke="rgba(212,184,90,0.30)" strokeWidth={1} />
      <circle cx={todayX} cy={todayY} r={4.5} fill="#E5D4C2" stroke="#052E20" strokeWidth={1.5} />
      <text x={todayX + 8} y={todayY - 6} fill="#E5D4C2" fontSize="10" fontFamily="Google Sans Code, monospace">
        today · {currentPst.toFixed(2)}
      </text>
    </svg>
  )
}

// ─── Transport pill — honest about how the page receives updates ────────────

function TransportPill({ transport, note, demoGate }: {
  transport: Transport; note: string; demoGate: DemoGate
}) {
  const tone = transport === 'realtime' ? 'green' : transport === 'polling' ? 'gold' : 'grey'
  const label = transport === 'realtime' ? 'live · Realtime'
    : transport === 'polling'  ? 'live · polling 15s'
    : 'probing transport…'
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
  return (
    <button onClick={onClick} disabled={busy} style={refreshBtn}>
      <span style={refreshGlyph(busy)}>↻</span>
      {busy ? 'refreshing…' : 'refresh'}
    </button>
  )
}

// ─── Panel 3 — Baseline inheritance table ────────────────────────────────────

function BaselineTable({ categories, demoCategory }: {
  categories: CategorySlice[]
  demoCategory: string | null
}) {
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
                {source}
                {isDemoTarget && ' ← FLIPPED'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'baseline' }}>
              <div>
                <div style={miniLabel}>baseline λ</div>
                <div style={{ ...posteriorBig, color: source === 'learned' ? '#7AB07A' : '#E5D4C2' }}>
                  {liveLambda.toFixed(4)}
                </div>
              </div>
              <div>
                <div style={miniLabel}>half-life</div>
                <div style={posteriorBig}>{Math.round(Math.LN2 / liveLambda)}d</div>
              </div>
            </div>
            {source === 'designed' && (
              <div style={metaText}>from <code>decay-priors.ts</code></div>
            )}
            {source === 'learned' && c.active && (
              <div style={metaText}>
                designed was {c.designed_lambda.toFixed(4)} · promoted {new Date(c.active.fit_timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                <span style={metaText}>live λ={liveLambda.toFixed(4)} · half-life {halfLifeLive}d</span>
              )}
            </div>

            <div style={posteriorGrid}>
              <div>
                <div style={miniLabel}>Designed prior</div>
                <div style={posteriorBig}>{c.designed_lambda.toFixed(4)}</div>
                <div style={metaText}>centre · {Math.round(Math.LN2 / c.designed_lambda)}d</div>
              </div>
              <div>
                <div style={miniLabel}>Posterior centre</div>
                <div style={{ ...posteriorBig, color: c.active ? '#7AB07A' : '#B2AA98' }}>
                  {latest ? latest.learned_lambda.toFixed(4) : c.designed_lambda.toFixed(4)}
                </div>
                <div style={metaText}>
                  {latest ? `Gamma(α+d, β+T) · n=${latest.n_observations}` : 'equals prior (no fit yet)'}
                </div>
              </div>
              <div>
                <div style={miniLabel}>95% credible interval</div>
                {latest?.lambda_ci_lower != null && latest?.lambda_ci_upper != null ? (
                  <>
                    <div style={posteriorBig}>
                      [{latest.lambda_ci_lower.toFixed(4)}, {latest.lambda_ci_upper.toFixed(4)}]
                    </div>
                    <div style={metaText}>
                      rel-width {latest.ci_relative_width != null ? latest.ci_relative_width.toFixed(2) : '—'}
                      {' '}({latest.ci_narrow_enough ? 'narrow enough' : 'too wide'})
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ ...posteriorBig, color: '#7E7864' }}>—</div>
                    <div style={metaText}>pending fit</div>
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
              }} title={`designed prior centre · λ=${c.designed_lambda.toFixed(4)}`} />
              <div style={{
                position: 'absolute', top: 0, height: 20, width: 2,
                left: `calc(${posteriorX}% - 1px)`,
                background: c.active ? '#7AB07A' : '#D4B85A',
              }} title={`posterior centre · λ=${(latest?.learned_lambda ?? c.designed_lambda).toFixed(4)}`} />
              <div style={ciRailScale}>
                <span>0</span>
                <span>{lambdaScaleMax.toFixed(3)}</span>
              </div>
            </div>

            {/* Distance to event floor */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={miniLabel}>Distance to event floor (contradictions)</span>
                <span style={metaText}>
                  {nEvents} / {EVENT_FLOOR} · {nEvents < EVENT_FLOOR ? `${EVENT_FLOOR - nEvents} to go` : 'floor met'}
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
        {stat('Active preferences', vitals.active_preferences.toString())}
        {stat('Total exposure accruing', `${vitals.total_exposure_days.toLocaleString()}d`,
          `${totalExpYears} prefs·years · the survival data the fit will see`)}
        {stat('Medical-locked', vitals.medical_locked.toString(),
          'λ=0 by content guardrail — never decay', vitals.medical_locked > 0 ? 'red' : undefined)}
        {stat('Flagged for revalidation', vitals.flagged_for_revalidation.toString(),
          'PS(t) < 0.7·S₀ or stale beyond category window',
          vitals.flagged_for_revalidation > 0 ? 'gold' : 'green')}
        {stat('Validation events', vitals.total_validation_events.toString(),
          vitals.total_validation_events === 0
            ? 'Tank empty — every fit reads insufficient_data until events accrue'
            : 'feeds the Bayesian fit')}
      </div>

      <div style={vitalsSubgrid}>
        <div style={vitalCardSm}>
          <div style={miniLabel}>Categories</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={catStatChip('active')}>{cs.active} active</span>
            <span style={catStatChip('proposed')}>{cs.proposed} proposed</span>
            <span style={catStatChip('insufficient_data')}>{cs.insufficient_data} insufficient</span>
            <span style={catStatChip('no_fit_yet')}>{cs.no_fit_yet} no fit yet</span>
          </div>
        </div>

        <div style={vitalCardSm}>
          <div style={miniLabel}>λ origin breakdown</div>
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

function consequenceText(e: FeedEvent): string {
  if (e.kind === 'validation') {
    const days = e.days_since_last_validation
    switch (e.subtype) {
      case 'confirmed':
        return `validation_count + 1, R recomputed (cap 1.30), spell clock reset, revalidation flag cleared${days != null ? ` · ${days}d since last validation` : ''}`
      case 'contradicted':
        return `fed to category exposure as an event (d+1); λ posterior updates at next monthly fit${days != null ? ` · ${days}d spell` : ''}`
      case 'revised':
        return `preference replaced; old row archived, new row inherits λ + lambda_origin`
      case 'invalidated':
        return `preference marked invalid; no longer scored`
      default:
        return `validation event`
    }
  }
  if (e.kind === 'preference_insert') {
    const origin = (e.lambda_origin || 'unknown').replace(/_/g, ' ')
    const lam = e.lambda != null ? `λ=${e.lambda.toFixed(4)}` : 'no λ'
    return `new preference written · ${lam} · origin: ${origin}${e.loop_closure ? ' · ← loop closed (inherited learned λ)' : ''}`
  }
  if (e.kind === 'promotion') {
    if (e.subtype === 'active') {
      const designed = e.designed_lambda != null ? e.designed_lambda.toFixed(4) : '—'
      const learned  = e.learned_lambda  != null ? e.learned_lambda.toFixed(4) : '—'
      return `λ PROMOTED · designed ${designed} → learned ${learned}${e.is_demo_fixture ? ' · DEMO fixture' : ''}`
    }
    return `learned_decay_constants ${e.subtype ?? 'updated'}`
  }
  return 'event'
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

function formatRelTime(iso: string): string {
  const now = Date.now()
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return iso
  const secs = Math.max(0, Math.floor((now - then) / 1000))
  if (secs < 60)    return `${secs}s ago`
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function EventStream({ events, transport }: { events: FeedEvent[]; transport: Transport }) {
  const loopClosure = events.filter(e => e.loop_closure)

  if (events.length === 0) {
    return (
      <div style={emptyFeedBlock}>
        <div style={{ fontSize: 14, color: '#E5D4C2', marginBottom: 8 }}>watching · no scoring events yet.</div>
        <div style={{ lineHeight: 1.7 }}>
          The subscription is live ({transport === 'realtime' ? 'postgres_changes' : transport === 'polling' ? '15s poll' : 'probing'}).
          When validation events, preference inserts, or λ promotions arrive, they appear here in real time, each annotated
          with what the system did because of it. This empty state is the honest one for an empty tank.
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
            <span style={{ ...demoEyebrow, color: '#7AB07A' }}>LOOP CLOSURE TICKER</span>
            <span style={metaText}>{loopClosure.length} event{loopClosure.length === 1 ? '' : 's'} where the system inherited a rate it learned</span>
          </div>
          {loopClosure.slice(0, 5).map(e => (
            <div key={`lc_${e.id}`} style={loopTickerRow}>
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: 4,
                background: '#7AB07A', boxShadow: '0 0 6px rgba(122,176,122,0.7)',
              }} />
              <span style={{ ...metaText, color: '#E5D4C2' }}>
                {e.kind === 'promotion'
                  ? `λ PROMOTED · ${e.category}`
                  : `${e.preference_name || 'preference'} · ${e.category}`}
              </span>
              <span style={metaText}>{consequenceText(e)}</span>
              <span style={{ ...metaText, marginLeft: 'auto' }}>{formatRelTime(e.timestamp)}</span>
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
                  {e.kind === 'validation'  ? `validation · ${e.subtype}` :
                   e.kind === 'preference_insert' ? 'preference · insert' :
                                                    `learned λ · ${e.subtype || 'change'}`}
                </span>
                {e.member_name && <span style={metaText}>· {e.member_name}</span>}
                {e.category    && <span style={metaText}>· {e.category}</span>}
                {e.preference_name && <span style={{ ...metaText, color: '#E5D4C2' }}>· {e.preference_name}</span>}
                {e.is_demo_fixture && <span style={demoGatePill}>DEMO</span>}
                <span style={{ ...metaText, marginLeft: 'auto' }}>{formatRelTime(e.timestamp)}</span>
              </div>
              <div style={feedLine2}>{consequenceText(e)}</div>
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
  const reconciled = phase === 'done' && summary !== null
  const baselineSummary = summary ? (() => {
    const learned = Object.entries(summary.baselines)
      .filter(([, b]) => b.source === 'learned').map(([cat]) => cat)
    return learned.length === 0
      ? 'all baselines designed (no learned λ promoted)'
      : `learned: ${learned.join(', ')} · rest designed`
  })() : null

  return (
    <>
      <div style={demoControlsRow}>
        <label style={pickerLabel}>
          Sample transcript
          <select
            value={sampleId}
            onChange={e => onLoadSample(e.target.value)}
            disabled={phase === 'streaming' || phase === 'reconciling'}
            style={pickerInput}
          >
            <option value="">— choose a sample —</option>
            {samples.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label style={pickerLabel}>
          Member name (for the prompt)
          <input
            type="text"
            value={memberName}
            onChange={e => onMemberNameChange(e.target.value)}
            disabled={phase === 'streaming' || phase === 'reconciling'}
            style={pickerInput}
            placeholder="Demo Member"
          />
        </label>
      </div>

      <textarea
        value={transcript}
        onChange={e => onTranscriptChange(e.target.value)}
        disabled={phase === 'streaming' || phase === 'reconciling'}
        placeholder="Load a bundled sample above, or paste a fictional transcript here. Real member transcripts have no business on this surface."
        rows={6}
        style={demoTextarea}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(phase === 'streaming' || phase === 'reconciling') ? (
          <button onClick={onCancel} style={btnGhostDemo}>Cancel</button>
        ) : (
          <button
            onClick={onRun}
            disabled={!transcript.trim()}
            style={{
              ...demoBtn,
              ...(transcript.trim() ? {} : { opacity: 0.4, cursor: 'not-allowed' }),
            }}
            title={transcript.trim() ? '' : 'Load a sample or paste a transcript first'}
          >
            {phase === 'done' || phase === 'error' ? 'Run extraction again' : 'Run extraction'}
          </button>
        )}
        {phase === 'streaming' && (
          <span style={metaText}>Claude is reading the transcript · {extracted.length} preference{extracted.length === 1 ? '' : 's'} so far…</span>
        )}
        {phase === 'reconciling' && (
          <span style={metaText}>Applying medical guardrail and baseline inheritance…</span>
        )}
        {phase === 'done' && summary && (
          <span style={metaText}>
            done · {summary.count} preference{summary.count === 1 ? '' : 's'} · {summary.medicalForced} medical-forced · {summary.dropped.length} dropped
          </span>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {reconciled && summary && (
        <div style={demoSummaryBanner}>
          <strong style={{ color: '#D4B85A' }}>{summary.count}</strong> preference{summary.count === 1 ? '' : 's'} ·
          {' '}<strong style={{ color: summary.medicalForced > 0 ? '#C27070' : '#B2AA98' }}>{summary.medicalForced}</strong> medical-forced ·
          {' '}<strong style={{ color: summary.aiPermanent  > 0 ? '#D4B85A' : '#B2AA98' }}>{summary.aiPermanent}</strong> permanent-locked ·
          {' '}<strong style={{ color: summary.dropped.length > 0 ? '#B2AA98' : '#7AB07A' }}>{summary.dropped.length}</strong> dropped
          {summary.dropped.length > 0 && (
            <span style={{ color: '#B2AA98', opacity: 0.75 }}> ({summary.dropped.map(d => d.reason).join(', ')})</span>
          )}
          <div style={{ marginTop: 4, color: '#B2AA98', opacity: 0.85 }}>
            baselines used: {baselineSummary}
          </div>
          <div style={{ marginTop: 6, color: '#7E7864', fontSize: 10, fontStyle: 'italic' }}>
            No database write occurred. The list below exists only in this browser session.
          </div>
        </div>
      )}

      {reconciled && summary && summary.dropped.length > 0 && (
        <div style={droppedStrip}>
          <div style={{ ...miniLabel, color: '#C27070', marginBottom: 6 }}>
            ⚠ DROPPED · {summary.dropped.length} row{summary.dropped.length === 1 ? '' : 's'} did not survive reconciliation
          </div>
          {summary.dropped.map((d, i) => (
            <div key={i} style={droppedRow}>
              <span style={{ color: '#C27070', marginRight: 8 }}>·</span>
              <span style={{ color: '#E5D4C2' }}>{d.item?.preference_name || '(unnamed)'}</span>
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
  // Streaming heuristic: AI-emitted λ=0 = the model thinks this is permanent.
  // Whether it's MEDICAL or PERMANENT depends on content-detection, which only
  // runs at reconcile. During streaming, render λ=0 as "PERMANENT — suspected"
  // (the conservative label); reconcile then upgrades to MEDICAL where the
  // content guardrail actually fires.
  const isReconciled = pref.lambda_origin != null
  const isMedical   = pref.lambda_origin === 'forced_medical'
  const isPermanent = pref.lambda_origin === 'ai_permanent'
  const isLocked    = isMedical || isPermanent || (!isReconciled && pref.lambda === 0)
  const originLabel: { text: string; tone: 'red' | 'gold' | 'green' | 'grey' | 'amber' } =
    isMedical                                           ? { text: 'MEDICAL — LOCKED',         tone: 'red'   } :
    isPermanent                                         ? { text: 'PERMANENT — LOCKED',       tone: 'amber' } :
    pref.lambda_origin === 'ai_specific'                ? { text: 'AI · SPECIFIC',             tone: 'gold'  } :
    pref.lambda_origin === 'category_baseline_learned'  ? { text: 'BASELINE · LEARNED',        tone: 'green' } :
    pref.lambda_origin === 'category_baseline_designed' ? { text: 'BASELINE · DESIGNED',       tone: 'grey'  } :
    isLocked                                            ? { text: 'PERMANENT — suspected',     tone: 'amber' } :
                                                          { text: 'LIVE · pending reconcile',  tone: 'grey'  }

  const borderColor = isMedical   ? '#C27070'
                    : isPermanent ? '#D4B85A'
                    : isLocked    ? '#D4B85A'
                    : null
  const cardBg = isMedical   ? 'rgba(194,112,112,0.04)'
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
            title="C ≤ 0.50 — the AI hedged this scoring (e.g. one-off mention, qualifier). Worth a closer look."
          >
            ⚠ LOW CONFIDENCE
          </span>
        )}
        {showMedicalAdjacentAttention && (
          <span
            style={attentionBadgeMedicalAdjacent}
            title={`Pattern-matched: contains medical-adjacent language (matched /medic|allerg|intoleran|epipen|anaphyla/i) and was NOT locked. The badge does NOT certify the non-firing as correct — the same pattern catches "medicinal tasting note" (correctly unlocked) AND a missed allergy (incorrectly unlocked). Verify which this is.`}
          >
            ⚠ MEDICAL-ADJACENT · UNLOCKED · VERIFY
          </span>
        )}
        {phase === 'streaming' && !isReconciled && <span style={liveTag}>· live</span>}
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
          <span style={demoFactor}>half-life <strong style={{ color: '#B2AA98' }}>{Math.round(Math.LN2 / pref.lambda)}d</strong></span>
        )}
        {pref.lambda === 0 && (
          <span style={demoFactor}><strong style={{ color: '#C27070' }}>never decays</strong></span>
        )}
      </div>

      {pref.rationale && (
        <div style={{ marginTop: 10 }}>
          <button onClick={onToggleExpand} style={rationaleToggle}>
            {expanded ? '▾' : '▸'} rationale
          </button>
          {expanded && (
            <div style={rationaleBlock}>
              <span style={{ color: '#7E7864' }}>AI: </span>
              {pref.rationale}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Probe runs (in-session) + compare view ──────────────────────────────────

function ProbeRunsStrip({ runs, onRestore, compareIds, onCompareToggle }: {
  runs: ProbeRun[]
  onRestore: (id: string) => void
  compareIds: [string | null, string | null]
  onCompareToggle: (id: string) => void
}) {
  return (
    <div style={probeRunsStrip}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ ...miniLabel, color: '#D4B85A' }}>PROBE RUNS · last {runs.length}</span>
        <span style={metaText}>
          click a run to restore · check 2 to compare side-by-side · kept for this session only, nothing is saved
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {runs.map((r, i) => {
          const selected = compareIds[0] === r.id || compareIds[1] === r.id
          return (
            <div key={r.id} style={{
              ...probeRunRow,
              ...(selected ? { background: 'rgba(212,184,90,0.10)', borderColor: 'rgba(212,184,90,0.45)' } : {}),
            }}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onCompareToggle(r.id)}
                style={{ marginRight: 6 }}
                title="select for compare"
              />
              <button onClick={() => onRestore(r.id)} style={probeRunButton}>
                <span style={{ color: '#7E7864', marginRight: 8 }}>#{runs.length - i}</span>
                <span style={{ color: '#E5D4C2' }}>{r.label}</span>
                <span style={metaText}> · {r.summary.count} prefs</span>
                {r.summary.medicalForced > 0 && <span style={{ ...metaText, color: '#C27070' }}> · {r.summary.medicalForced} medical</span>}
                {r.summary.aiPermanent  > 0 && <span style={{ ...metaText, color: '#D4B85A' }}> · {r.summary.aiPermanent} permanent</span>}
                {r.summary.dropped.length > 0 && <span style={metaText}> · {r.summary.dropped.length} dropped</span>}
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
  // Group preferences by category so both columns line up by topic.
  const allCats = Array.from(new Set([
    ...a.preferences.map(p => p.category),
    ...b.preferences.map(p => p.category),
  ])).sort()

  return (
    <div style={probeCompareWrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ ...miniLabel, color: '#D4B85A' }}>COMPARE</span>
        <span style={metaText}>category-aligned · locked rows highlighted in colour</span>
        <button onClick={onClose} style={{ ...btnGhostDemo, marginLeft: 'auto', padding: '4px 10px', fontSize: 10 }}>close</button>
      </div>
      <div style={probeCompareGrid}>
        <div style={probeCompareCol}>
          <div style={probeCompareHeader}>
            <strong>{a.label}</strong>
            <div style={metaText}>{a.summary.count} prefs · {a.summary.medicalForced} medical · {a.summary.aiPermanent} permanent · {a.summary.dropped.length} dropped</div>
          </div>
          <ProbeCompareCategoryList cats={allCats} prefs={a.preferences} />
        </div>
        <div style={probeCompareCol}>
          <div style={probeCompareHeader}>
            <strong>{b.label}</strong>
            <div style={metaText}>{b.summary.count} prefs · {b.summary.medicalForced} medical · {b.summary.aiPermanent} permanent · {b.summary.dropped.length} dropped</div>
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cats.map(cat => {
        const rows = prefs.filter(p => p.category === cat)
        if (rows.length === 0) {
          return (
            <div key={cat} style={probeCompareCatBlock}>
              <div style={{ ...miniLabel, marginBottom: 6 }}>{cat}</div>
              <div style={{ ...metaText, opacity: 0.5 }}>— no preferences in this category —</div>
            </div>
          )
        }
        return (
          <div key={cat} style={probeCompareCatBlock}>
            <div style={{ ...miniLabel, marginBottom: 6 }}>{cat}</div>
            {rows.map(r => {
              const locked = r.lambda_origin === 'forced_medical' || r.lambda_origin === 'ai_permanent'
              const tone = r.lambda_origin === 'forced_medical' ? '#C27070'
                         : r.lambda_origin === 'ai_permanent'   ? '#D4B85A'
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

function ConsistencyControl({ triple, phase, error, onRun }: {
  triple: ProbeRun[] | null
  phase: 'idle' | 'analysing' | 'done' | 'error'
  error: string | null
  onRun: () => void
}) {
  const enabled = triple !== null && phase !== 'analysing'
  const tooltip = !triple ? 'Run the same transcript three times to enable.' : ''
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
          {phase === 'analysing' ? 'Analysing…' : 'AI consistency analysis'}
        </button>
        {triple ? (
          <span style={metaText}>
            ready to analyse the 3 most-recent runs of <strong style={{ color: '#E5D4C2' }}>{triple[0].label}</strong> ·
            counts {counts}
          </span>
        ) : (
          <span style={metaText}>
            requires ≥ 3 runs of the same transcript · gate is hash-equality, not label
          </span>
        )}
      </div>
      {error && <div style={errorBox}>{error}</div>}
    </div>
  )
}

function ConsistencyReportView({ report }: { report: ConsistencyReport }) {
  const tone = report.verdict === 'safety_inconsistency' ? 'safety'
             : report.verdict === 'judgment_variance'   ? 'amber'
             : 'green'

  return (
    <div style={consistencyReportWrap}>
      {/* Headline verdict bar */}
      <div style={verdictBar(tone)}>
        {tone === 'safety' && (
          <div style={{ ...miniLabel, color: '#FFFFFF', marginBottom: 4 }}>⛔ SAFETY INCONSISTENCY</div>
        )}
        {tone === 'amber' && (
          <div style={{ ...miniLabel, color: '#D4B85A', marginBottom: 4 }}>⚠ JUDGMENT VARIANCE</div>
        )}
        {tone === 'green' && (
          <div style={{ ...miniLabel, color: '#7AB07A', marginBottom: 4 }}>✓ JUDGMENT STABLE</div>
        )}
        <div style={{
          fontFamily: "'Rampant Sans', serif", fontSize: 17, fontWeight: 500,
          color: tone === 'safety' ? '#FFFFFF' : '#E5D4C2',
          letterSpacing: '0.04em',
        }}>
          {report.headline}
        </div>
      </div>

      {/* Counts line */}
      <div style={{ ...metaText, marginTop: 12 }}>
        Preference counts: <strong style={{ color: '#E5D4C2' }}>{report.counts.join(' / ')}</strong>
        {tone !== 'safety' && (
          <> · spread {(() => {
            const lo = Math.min(...report.counts), hi = Math.max(...report.counts)
            return hi - lo
          })()} {report.verdict === 'stable' ? '(granularity-only)' : '(see variances)'}</>
        )}
      </div>

      {/* Invariants */}
      {report.invariants.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...miniLabel, color: '#7AB07A', marginBottom: 8 }}>WHAT HELD ACROSS ALL 3 RUNS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {report.invariants.map((inv, i) => (
              <div key={i} style={invariantRow}>
                <span style={{ color: '#7AB07A', marginRight: 8 }}>✓</span>
                <span style={{ color: '#E5D4C2' }}>{inv.preference}</span>
                <span style={{ ...metaText, marginLeft: 6 }}>— {inv.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variances */}
      {report.variances.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...miniLabel, marginBottom: 8 }}>WHAT DIFFERED</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {report.variances.map((v, i) => {
              const tag = v.type === 'safety'      ? { text: 'SAFETY',      fg: '#FFFFFF', bg: '#C27070', bd: '#C27070' }
                        : v.type === 'judgment'    ? { text: 'JUDGMENT',    fg: '#D4B85A', bg: 'rgba(212,184,90,0.12)', bd: 'rgba(212,184,90,0.40)' }
                        :                            { text: 'GRANULARITY', fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.18)' }
              return (
                <div key={i} style={varianceRow}>
                  <span style={{
                    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
                    color: tag.fg, background: tag.bg, border: `1px solid ${tag.bd}`,
                    borderRadius: 3, padding: '2px 7px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>{tag.text}</span>
                  <span style={{ color: '#E5D4C2' }}>{v.preference}</span>
                  <span style={{ ...metaText }}>— {v.detail}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Synthesis */}
      {report.synthesis && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(229,212,194,0.08)' }}>
          <div style={{ ...miniLabel, marginBottom: 6 }}>AI SYNTHESIS</div>
          <div style={{
            fontFamily: "'Google Sans Code', monospace", fontSize: 12,
            color: '#E5D4C2', lineHeight: 1.7,
          }}>
            {report.synthesis}
          </div>
        </div>
      )}

      <div style={{ ...metaText, marginTop: 14, opacity: 0.7, fontStyle: 'italic' }}>
        Analysis compares the three captured runs in this session. Nothing is saved.
      </div>
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
          placeholder="Filter by name, category, member, or origin…"
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
              {key}
            </button>
          ))}
        </div>
      </div>
      <div style={breadthScroll}>
        <table style={breadthTable}>
          <thead>
            <tr>
              <th style={thLeft}>Preference</th>
              <th style={th}>Member</th>
              <th style={th}>Category</th>
              <th style={thNum}>λ</th>
              <th style={thNum}>days</th>
              <th style={thNum}>PS(t)</th>
              <th style={th}>origin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.preference_id} onClick={() => onPick(r.member_no, r.preference_id)} style={tr}>
                <td style={tdLeft}>
                  {r.preference_name}
                  {r.needsRevalidation && <span style={{ color: '#C27070', marginLeft: 6 }}>·flag</span>}
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
                  <span style={originPill(r.lambda_origin || '(null)')}>{(r.lambda_origin || 'none').replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={metaText}>{rows.length} row{rows.length === 1 ? '' : 's'} · click any row to focus the decomposition above.</div>
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
  marginTop: 14, padding: 18,
  background: 'rgba(5,46,32,0.5)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
}
function verdictBar(tone: 'green' | 'amber' | 'safety'): React.CSSProperties {
  if (tone === 'safety') return {
    padding: '16px 18px',
    background: '#C27070',
    border: '2px solid #C27070',
    borderRadius: 6,
    boxShadow: '0 0 0 1px rgba(194,112,112,0.6), 0 0 18px rgba(194,112,112,0.40)',
  }
  if (tone === 'amber') return {
    padding: '14px 16px',
    background: 'rgba(212,184,90,0.10)',
    border: '1px solid rgba(212,184,90,0.45)', borderRadius: 6,
  }
  return {
    padding: '14px 16px',
    background: 'rgba(122,176,122,0.08)',
    border: '1px solid rgba(122,176,122,0.40)', borderRadius: 6,
  }
}
const invariantRow: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  padding: '4px 8px',
  background: 'rgba(122,176,122,0.04)',
  borderLeft: '2px solid rgba(122,176,122,0.30)',
  borderRadius: 3,
}
const varianceRow: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  padding: '4px 8px',
  borderRadius: 3,
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
