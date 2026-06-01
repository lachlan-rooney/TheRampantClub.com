import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET    /api/admin/mis/prospects/[id]       — full record + activity log
// PATCH  /api/admin/mis/prospects/[id]       — partial update; logs activity per field
// DELETE /api/admin/mis/prospects/[id]       — soft archive (?restore=true to undo)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STAGES = [
  'Lead', 'Initial Contact', 'Interview Scheduled', 'Interview Complete',
  'Application Received', 'Onboarded', 'Declined', 'Withdrawn', 'On Hold',
]
const ALLOWED_SOURCES = ['Referral', 'Direct Approach', 'Event']
const ALLOWED_DECISION = ['Approved', 'Declined', 'Pending', 'Deferred']

const SCORE_FIELDS = ['cultural_fit', 'social_compatibility', 'commercial_potential', 'whisky_interest', 'brand_alignment', 'community_value'] as const

function snapScore(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  return n
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const sb = svc()
  const [{ data: prospect, error: pErr }, { data: activity }, { data: invitations }] = await Promise.all([
    sb.from('prospects_with_score').select('*').eq('prospect_id', id).maybeSingle(),
    sb.from('prospect_activity').select('*').eq('prospect_id', id).order('created_at', { ascending: false }).limit(100),
    sb.from('signing_invitations')
      .select('id, token, full_name, email, status, member_no, created_at, viewed_at, view_count, last_reminded_at, reminder_count, revoked_at')
      .eq('prospect_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!prospect) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ prospect, activity: activity || [], invitations: invitations || [] })
}

const TEXT_FIELDS = [
  'nickname', 'referred_by_name', 'referral_relationship', 'contact_info',
  'next_action', 'assigned_to', 'notes', 'interviewer', 'interview_location',
  'interview_duration', 'interview_notes', 'red_flags', 'profession',
  'diversity_contribution', 'committee_notes',
] as const
const DATE_FIELDS = [
  'first_contact_date', 'last_contact_date', 'next_action_date',
  'interview_date', 'decision_date',
] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sb = svc()
  const { data: before } = await sb.from('prospects').select('*').eq('prospect_id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const activityRows: Array<{ event_type: string; from_value: string | null; to_value: string | null; note: string | null }> = []

  // Stage
  if (typeof body.stage === 'string' && ALLOWED_STAGES.includes(body.stage) && body.stage !== before.stage) {
    patch.stage = body.stage
    activityRows.push({ event_type: 'stage_changed', from_value: before.stage, to_value: body.stage, note: null })
  }

  // Source channel
  if (typeof body.source_channel === 'string' && (ALLOWED_SOURCES.includes(body.source_channel) || body.source_channel === '')) {
    const v = body.source_channel || null
    if (v !== before.source_channel) {
      patch.source_channel = v
      activityRows.push({ event_type: 'source_changed', from_value: before.source_channel, to_value: v, note: null })
    }
  }

  // Decision
  if (typeof body.decision === 'string' && (ALLOWED_DECISION.includes(body.decision) || body.decision === '')) {
    const v = body.decision || null
    if (v !== before.decision) {
      patch.decision = v
      activityRows.push({ event_type: 'decision_changed', from_value: before.decision, to_value: v, note: null })
    }
  }

  // Letter sent toggle
  if (typeof body.letter_sent === 'boolean' && body.letter_sent !== before.letter_sent) {
    patch.letter_sent = body.letter_sent
    if (body.letter_sent) patch.letter_sent_at = new Date().toISOString()
    activityRows.push({
      event_type: body.letter_sent ? 'letter_sent' : 'letter_unsent',
      from_value: String(before.letter_sent),
      to_value: String(body.letter_sent),
      note: null,
    })
  }

  // Free-text fields
  for (const f of TEXT_FIELDS) {
    if (f in body) {
      const v = body[f] == null || body[f] === '' ? null : String(body[f]).slice(0, 5000)
      if (v !== (before as Record<string, unknown>)[f]) patch[f] = v
    }
  }
  // Date fields (YYYY-MM-DD or null)
  for (const f of DATE_FIELDS) {
    if (f in body) {
      const raw = body[f]
      const v = raw == null || raw === '' ? null : String(raw)
      if (v !== (before as Record<string, unknown>)[f]) patch[f] = v
    }
  }
  // Scores
  let scoreChanged = false
  for (const f of SCORE_FIELDS) {
    if (f in body) {
      const v = snapScore(body[f])
      if (v !== (before as Record<string, unknown>)[f]) {
        patch[f] = v
        scoreChanged = true
      }
    }
  }
  if (scoreChanged) {
    activityRows.push({ event_type: 'scored', from_value: null, to_value: null, note: null })
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ ok: true, no_changes: true })
  }

  const { error } = await sb.from('prospects').update(patch).eq('prospect_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (activityRows.length > 0) {
    await sb.from('prospect_activity').insert(
      activityRows.map(r => ({ prospect_id: id, actor, ...r }))
    )
  }

  return NextResponse.json({ ok: true, patched: Object.keys(patch).length - 1 })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const restore = req.nextUrl.searchParams.get('restore') === 'true'

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  const sb = svc()
  const { error } = await sb.from('prospects')
    .update({ archived_at: restore ? null : new Date().toISOString() })
    .eq('prospect_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sb.from('prospect_activity').insert({
    prospect_id: id,
    actor,
    event_type: restore ? 'restored' : 'archived',
    note: null,
  })

  return NextResponse.json({ ok: true, archived: !restore })
}
