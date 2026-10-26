'use client'

import { useEffect, useRef, useState } from 'react'

// ASK SQL WHAT THE ROW WILL SCORE. Do not work it out here.
//
// This hook is the client half of /api/admin/mis/preview-score, which calls
// mis_preview_ps(), which calls mis_ps_t() — the same function the
// preference_scores view calls. There is one copy of PS(t) and it is in the
// database. Nothing in this file multiplies anything.
//
// It exists because two pages needed the same thing and, left to themselves,
// wrote two different versions of the formula: the profile page dropped the
// decay term, the intake page dropped decay, R and M, and both pinned M to 1.0
// behind a comment saying visits was empty. M is never 1.0 for any member
// now, so the hardcode had no remaining case at all.
//
//
// MEASURED: the preview mis-predicted the save on 146 of 159 rows, by up to
// 0.91 points of 5, over-promising on 98 and under-promising on 48. The cause
// is M alone: a preview is always at t = 0, so the decay term is e^0 = 1 on
// both sides and the omitted decay was dead code rather than a live error.
// (An earlier note here said "156 rows, 3.5 points". That compared the preview
// against the row's CURRENT score, which has decayed for up to 190 days - a
// different quantity, and not the preview's error.)
//
// ── WHY A DEBOUNCE AND NOT A MEMO ─────────────────────────────────────────
// A select fires on every change and a slider would fire per pixel. 220ms is
// below the threshold where a number feels laggy and well above a keystroke,
// so the preview still reads as live while the database is asked once per
// settled edit rather than once per event. The whole open editor set goes in
// one request, so N open rows is still one round trip.

export interface PsDraft {
  s0: number
  confidence: number
  lambda: number
  frequency: number
  /** What validation_count will BE after the save — the edit form passes current + 1. */
  validation_count?: number
  /** Defaults to 0 server-side: a save refreshes last_validated, so a preview is at t = 0. */
  days_since?: number
}

export interface PsPreview {
  idx: number
  ps_t: number
  score_health_pct: number
  r_reinforce: number
  m_engage: number
  avg_visits_per_month: number | null
}

interface State {
  scores: PsPreview[] | null
  loading: boolean
  /** Set when the database could not be asked. The caller shows a dash, never a guess. */
  error: string | null
}

/**
 * Prices a batch of uncommitted drafts. Pass null (or an empty array) when
 * there is nothing open and no request is made.
 */
export function usePreviewPs(memberNo: string, drafts: PsDraft[] | null, debounceMs = 220): State {
  const [state, setState] = useState<State>({ scores: null, loading: false, error: null })

  // The drafts array is rebuilt on every render, so the effect has to depend
  // on its VALUE rather than its identity or it would re-fetch forever.
  const key = drafts && drafts.length ? JSON.stringify(drafts) : ''
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    if (!memberNo || !key) { setState({ scores: null, loading: false, error: null }); return }

    setState(s => ({ ...s, loading: true }))
    const timer = setTimeout(async () => {
      const ac = new AbortController()
      abortRef.current = ac
      try {
        const r = await fetch('/api/admin/mis/preview-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_no: memberNo, drafts: JSON.parse(key) }),
          signal: ac.signal,
          cache: 'no-store',
        })
        const j = await r.json().catch(() => ({}))
        if (ac.signal.aborted) return
        if (!r.ok) { setState({ scores: null, loading: false, error: j.error || `HTTP ${r.status}` }); return }
        setState({ scores: j.scores || [], loading: false, error: null })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        setState({ scores: null, loading: false, error: 'Could not reach the scorer.' })
      }
    }, debounceMs)

    return () => { clearTimeout(timer); abortRef.current?.abort() }
  }, [memberNo, key, debounceMs])

  return state
}
