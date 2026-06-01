import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/mis/members/[member_no]/activity[?limit=100]
//
// Consolidated "what's happened with this member" feed. Merges from:
//   - visits        (visit logged, phase changes)
//   - preferences   (created)
//   - validation_events (confirmed / contradicted / revised / invalidated)
//   - preference_candidates (proposed, accepted, rejected)
//   - gifts         (given)
//   - harmony_observations (per-visit observation, captured in Accord)
//   - complaints    (raised, resolved)
//
// Each entry has a stable shape so the page renders one timeline regardless
// of source.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface TimelineEntry {
  id: string
  kind: 'visit' | 'preference_created' | 'validation_event' | 'candidate' | 'gift' | 'observation' | 'complaint'
  at: string                       // ISO timestamp
  title: string
  detail: string | null
  meta: Record<string, unknown>    // kind-specific
  href: string | null              // where to click for more
}

// Helper to swallow query errors so a missing table doesn't 500 the whole feed.
function safe<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  return Promise.resolve(p).then(r => r.data ?? []).catch(() => [])
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ member_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { member_no } = await ctx.params
  const { searchParams } = new URL(req.url)
  const limit = Math.min(500, Math.max(10, Number(searchParams.get('limit')) || 200))

  const sb = svc()

  const [visits, preferences, validations, candidates, gifts, observations, complaints] = await Promise.all([
    safe<{ visit_id: string; visit_date: string; phase: string; space: string | null; duration_min: number | null; emotional_state: string | null; notes: string | null; logged_by: string | null; arrival_time: string | null; departure_time: string | null; continuum_completed_at: string | null; created_at: string; archived_at: string | null }>(
      sb.from('visits').select('visit_id, visit_date, phase, space, duration_min, emotional_state, notes, logged_by, arrival_time, departure_time, continuum_completed_at, created_at, archived_at').eq('member_no', member_no).is('archived_at', null).order('visit_date', { ascending: false }).limit(limit)
    ),
    safe<{ preference_id: string; preference_name: string; category: string; subcategory: string | null; detail: string | null; s0: number; created_date: string | null; logged_by: string | null }>(
      sb.from('preferences').select('preference_id, preference_name, category, subcategory, detail, s0, created_date, logged_by').eq('member_no', member_no).order('created_date', { ascending: false, nullsFirst: false }).limit(limit)
    ),
    safe<{ event_id: string; preference_id: string; event_type: string; event_timestamp: string; confidence_before: number | null; confidence_after: number | null; notes: string | null; staff_id: string | null }>(
      sb.from('validation_events').select('event_id, preference_id, event_type, event_timestamp, confidence_before, confidence_after, notes, staff_id').eq('member_no', member_no).order('event_timestamp', { ascending: false }).limit(limit)
    ),
    safe<{ candidate_id: string; suggested_name: string | null; suggested_category: string | null; status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null; promoted_preference_id: string | null; source: string }>(
      sb.from('preference_candidates').select('candidate_id, suggested_name, suggested_category, status, created_at, reviewed_at, reviewed_by, promoted_preference_id, source').eq('member_no', member_no).order('created_at', { ascending: false }).limit(limit)
    ),
    safe<{ id: string; gift_date: string; occasion: string; category: string | null; description: string; cost_vnd: number; given_by: string | null; created_at: string }>(
      sb.from('gifts').select('id, gift_date, occasion, category, description, cost_vnd, given_by, created_at').eq('member_no', member_no).order('gift_date', { ascending: false }).limit(limit)
    ),
    safe<{ observation_id: string; visit_id: string; category: string | null; observation: string; sentiment: string; score: number | null; spawned_candidate: boolean; links_to_preference_id: string | null; logged_by: string | null; created_at: string }>(
      sb.from('harmony_observations').select('observation_id, visit_id, category, observation, sentiment, score, spawned_candidate, links_to_preference_id, logged_by, created_at').eq('member_no', member_no).order('created_at', { ascending: false }).limit(limit)
    ),
    safe<{ id: string; severity: number; summary: string; status: string; reported_at: string; resolved_at: string | null; reported_by: string | null; resolved_by: string | null }>(
      sb.from('complaints').select('id, severity, summary, status, reported_at, resolved_at, reported_by, resolved_by').eq('member_no', member_no).order('reported_at', { ascending: false }).limit(limit)
    ),
  ])

  const entries: TimelineEntry[] = []

  for (const v of visits) {
    // Use the most informative timestamp available.
    const at = v.continuum_completed_at || v.departure_time || v.arrival_time || v.created_at
    const phaseLabel = v.phase === 'closed' ? 'Visit completed'
                      : v.phase === 'continuum' ? 'Visit in Continuum'
                      : v.phase === 'accord' ? 'Visit in Accord'
                      : 'Overture started'
    const spaceLine = [v.space, v.duration_min ? `${v.duration_min} min` : null, v.emotional_state].filter(Boolean).join(' · ')
    entries.push({
      id: `visit-${v.visit_id}`,
      kind: 'visit',
      at,
      title: phaseLabel,
      detail: spaceLine || v.notes || null,
      meta: { phase: v.phase, visit_date: v.visit_date, logged_by: v.logged_by },
      href: `/admin/mis/visits/${v.visit_id}`,
    })
  }

  for (const p of preferences) {
    const at = p.created_date ? `${p.created_date}T00:00:00+07:00` : new Date().toISOString()
    entries.push({
      id: `pref-${p.preference_id}`,
      kind: 'preference_created',
      at,
      title: `Preference added · ${p.preference_name}`,
      detail: p.detail || (p.category ? `${p.category}${p.subcategory ? ` · ${p.subcategory}` : ''}` : null),
      meta: { s0: p.s0, category: p.category, logged_by: p.logged_by },
      href: null,
    })
  }

  for (const e of validations) {
    const verbs: Record<string, string> = {
      confirmed:     'Preference confirmed',
      contradicted:  'Preference contradicted',
      revised:       'Preference revised',
      invalidated:   'Preference invalidated',
    }
    entries.push({
      id: `validation-${e.event_id}`,
      kind: 'validation_event',
      at: e.event_timestamp,
      title: verbs[e.event_type] || `Preference ${e.event_type}`,
      detail: e.notes || (e.confidence_before != null && e.confidence_after != null
        ? `Confidence ${e.confidence_before.toFixed(2)} → ${e.confidence_after.toFixed(2)}`
        : null),
      meta: { event_type: e.event_type, preference_id: e.preference_id, staff_id: e.staff_id },
      href: null,
    })
  }

  for (const c of candidates) {
    const at = c.reviewed_at || c.created_at
    const statusLabel = c.status === 'pending'  ? 'Preference candidate proposed'
                     : c.status === 'accepted'  ? 'Candidate accepted → preference'
                     : c.status === 'rejected'  ? 'Candidate rejected'
                     : `Candidate ${c.status}`
    entries.push({
      id: `candidate-${c.candidate_id}`,
      kind: 'candidate',
      at,
      title: statusLabel,
      detail: c.suggested_name || c.suggested_category || null,
      meta: { status: c.status, source: c.source, reviewed_by: c.reviewed_by, promoted_preference_id: c.promoted_preference_id },
      href: c.status === 'pending' ? '/admin/mis/candidates' : null,
    })
  }

  for (const g of gifts) {
    const at = `${g.gift_date}T12:00:00+07:00`
    const occLabel = g.occasion.replace(/_/g, ' ')
    entries.push({
      id: `gift-${g.id}`,
      kind: 'gift',
      at,
      title: `Gift · ${occLabel}`,
      detail: g.description,
      meta: { cost_vnd: g.cost_vnd, category: g.category, given_by: g.given_by },
      href: null,
    })
  }

  for (const o of observations) {
    entries.push({
      id: `obs-${o.observation_id}`,
      kind: 'observation',
      at: o.created_at,
      title: o.sentiment === 'excellence' ? '★ Excellence observed'
           : o.sentiment === 'grievance'  ? '⚠ Grievance observed'
           : 'Observation recorded',
      detail: o.observation,
      meta: { sentiment: o.sentiment, score: o.score, category: o.category, spawned_candidate: o.spawned_candidate, links_to_preference_id: o.links_to_preference_id },
      href: `/admin/mis/visits/${o.visit_id}`,
    })
  }

  for (const c of complaints) {
    const at = c.resolved_at || c.reported_at
    entries.push({
      id: `complaint-${c.id}`,
      kind: 'complaint',
      at,
      title: c.status === 'resolved' ? `Complaint resolved · S${c.severity}`
           : c.status === 'dismissed' ? `Complaint dismissed · S${c.severity}`
           : `Complaint open · S${c.severity}`,
      detail: c.summary,
      meta: { severity: c.severity, status: c.status, reported_by: c.reported_by, resolved_by: c.resolved_by },
      href: '/admin/mx-daily',
    })
  }

  // Sort descending by timestamp.
  entries.sort((a, b) => b.at.localeCompare(a.at))

  return NextResponse.json({ entries: entries.slice(0, limit) })
}
