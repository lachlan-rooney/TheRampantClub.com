import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { DESIGNED_LAMBDA, CANONICAL_CATEGORIES } from '@/lib/mis/extraction-decay'

// ⚠ DEV FIXTURE — closed-loop demonstration only. NOT a feature.
//
// Promotes a throwaway learned-λ row for one category so the Pass-4 closed
// loop can be demonstrated on a single transcript:
//   - Re-run the intake before/after this fires
//   - Confirm a non-medical Whisky row's lambda_origin flips from
//     'category_baseline_designed' → 'category_baseline_learned'
//   - Revert via the action='revert' branch when done
//
// Safeguards (per Pass-4 spec):
//   1. Gated behind MIS_DEMO_ENABLED=1 in the environment. Without the flag
//      every call is rejected, regardless of admin status. Production has
//      no business enabling this; the flag is a deliberate trip-wire.
//   2. The fixture row is tagged with notes='__DEMO_FIXTURE__'. The revert
//      path verifies that tag before flipping anything — it CANNOT mark a
//      real promoted row as superseded by accident.
//   3. Promote refuses if any active row already exists for the category
//      (real OR fixture). The partial-unique index in mis_pass3_hardening.sql
//      would reject the insert anyway; this check returns a friendlier
//      error and means the demo only operates in the empty-state regime
//      where the proof is meaningful.
//   4. Promote creates a NEW row — does not touch any existing 'proposed'
//      or 'rejected' rows. The decay-fit accept path is the only way a real
//      proposal can move to active; this endpoint is structurally separate.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FIXTURE_TAG = '__DEMO_FIXTURE__'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function gateOpen(): boolean {
  return process.env.MIS_DEMO_ENABLED === '1'
}

export async function POST(req: NextRequest) {
  if (!gateOpen()) {
    return NextResponse.json({
      error: 'demo affordance disabled',
      detail: 'Set MIS_DEMO_ENABLED=1 in the environment to enable. This endpoint is a closed-loop fixture, not a feature.',
    }, { status: 403 })
  }
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string; category?: string; lambda?: number; id?: string; max_age_seconds?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const action = body.action
  if (action !== 'promote' && action !== 'revert' && action !== 'sweep') {
    return NextResponse.json({ error: "action must be 'promote', 'revert', or 'sweep'" }, { status: 400 })
  }

  const sb = svc()

  // ── action: 'sweep' — clean up stale fixtures ─────────────────────────
  // Called by the Observatory on load to make sure a dead-client demo run
  // can't leave a learned λ live forever. Two independent verifications
  // before any row is touched:
  //   - notes === '__DEMO_FIXTURE__' (tag check — same as revert uses)
  //   - fit_timestamp older than max_age_seconds (default 300s = 5min)
  // Either condition's absence means the row is not eligible. Real promoted
  // rows have neither the tag NOR an age relevant here, so they're
  // structurally protected.
  if (action === 'sweep') {
    const maxAge = Number.isFinite(body.max_age_seconds) ? Number(body.max_age_seconds) : 300
    const cutoff = new Date(Date.now() - maxAge * 1000).toISOString()

    const { data: stale, error: findErr } = await sb
      .from('learned_decay_constants')
      .select('id, category, fit_timestamp, notes')
      .eq('status', 'active')
      .eq('notes', FIXTURE_TAG)
      .lt('fit_timestamp', cutoff)
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

    const stalRows = stale || []
    if (stalRows.length === 0) {
      return NextResponse.json({ ok: true, action: 'sweep', reverted: 0, cutoff })
    }

    const ids = stalRows.map(r => r.id)
    const { error: updErr } = await sb
      .from('learned_decay_constants')
      .update({ status: 'superseded' })
      .in('id', ids)
      .eq('notes', FIXTURE_TAG)  // belt-and-braces — double-check the tag at write
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      action: 'sweep',
      reverted: stalRows.length,
      cutoff,
      categories: stalRows.map(r => r.category),
    })
  }

  if (action === 'promote') {
    const category = String(body.category || '').trim()
    if (!CANONICAL_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `category must be one of the 9 canonical: got "${category}"` }, { status: 400 })
    }
    const lambda = Number(body.lambda)
    if (!Number.isFinite(lambda) || lambda <= 0) {
      return NextResponse.json({ error: 'lambda must be a positive number' }, { status: 400 })
    }

    // Safeguard: refuse if any active row exists for this category.
    // The unique index would reject the insert anyway, but a friendly error
    // here means the demo path doesn't pretend to be production accept-flow.
    const { data: existing } = await sb
      .from('learned_decay_constants')
      .select('id, learned_lambda, notes')
      .eq('category', category)
      .eq('status', 'active')
      .maybeSingle()
    if (existing) {
      return NextResponse.json({
        error: `category "${category}" already has an active learned λ (id ${existing.id}). The demo only operates in the empty-state regime; supersede the existing active row via /admin/decay-fit first, or pick a different category.`,
      }, { status: 409 })
    }

    const { data: inserted, error } = await sb
      .from('learned_decay_constants')
      .insert({
        category,
        learned_lambda:  lambda,
        designed_lambda: DESIGNED_LAMBDA[category],
        n_observations:  0,
        n_events:        0,
        fit_timestamp:   new Date().toISOString(),
        status:          'active',
        notes:           FIXTURE_TAG,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      action: 'promote',
      fixture_id: inserted.id,
      category,
      lambda,
      reminder: 'Call this endpoint again with { action: "revert", id: <fixture_id> } to clear the fixture.',
    })
  }

  // action === 'revert'
  const id = String(body.id || '').trim()
  if (!id) return NextResponse.json({ error: 'id required for revert' }, { status: 400 })

  const { data: row, error: getErr } = await sb
    .from('learned_decay_constants')
    .select('id, category, status, notes, learned_lambda')
    .eq('id', id)
    .single()
  if (getErr || !row) return NextResponse.json({ error: 'row not found' }, { status: 404 })

  // Hard safeguard: revert is allowed ONLY on fixture-tagged rows. Any
  // accidental call against a real promoted row is refused outright.
  if (row.notes !== FIXTURE_TAG) {
    return NextResponse.json({
      error: 'refusing to revert: row is not a demo fixture',
      detail: 'Only rows tagged with notes=__DEMO_FIXTURE__ can be reverted by this endpoint. Real promotions must be managed via /admin/decay-fit.',
    }, { status: 403 })
  }
  if (row.status !== 'active') {
    return NextResponse.json({
      error: `fixture row is already ${row.status} (no-op)`,
    }, { status: 400 })
  }

  const { error: updErr } = await sb
    .from('learned_decay_constants')
    .update({ status: 'superseded' })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    action: 'revert',
    fixture_id: id,
    category: row.category,
    reverted_from_lambda: row.learned_lambda,
  })
}
