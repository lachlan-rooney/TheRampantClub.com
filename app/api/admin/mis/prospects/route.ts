import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// MIS Prospects — list + create endpoints.
// GET  /api/admin/mis/prospects[?stage=…&assigned_to=…&include_archived=true]
// POST /api/admin/mis/prospects                                          (create)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = svc()
  const stage = req.nextUrl.searchParams.get('stage')
  const assigned_to = req.nextUrl.searchParams.get('assigned_to')
  const includeArchived = req.nextUrl.searchParams.get('include_archived') === 'true'

  let q = sb.from('prospects_with_score')
    .select('*')
    .order('first_contact_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (stage)          q = q.eq('stage', stage)
  if (assigned_to)    q = q.eq('assigned_to', assigned_to)
  if (!includeArchived) q = q.is('archived_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prospects: data || [] })
}

interface CreatePayload {
  full_name?: unknown
  nickname?: unknown
  stage?: unknown
  referred_by_name?: unknown
  referred_by_member_no?: unknown
  referral_relationship?: unknown
  source_channel?: unknown
  contact_info?: unknown
  first_contact_date?: unknown
  next_action?: unknown
  next_action_date?: unknown
  assigned_to?: unknown
  notes?: unknown
  profession?: unknown
}

const ALLOWED_STAGES = [
  'Lead', 'Initial Contact', 'Interview Scheduled', 'Interview Complete',
  'Application Received', 'Onboarded', 'Declined', 'Withdrawn', 'On Hold',
]
const ALLOWED_SOURCES = ['Referral', 'Direct Approach', 'Event']

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: CreatePayload
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const full_name = body.full_name ? String(body.full_name).trim() : ''
  if (!full_name) return NextResponse.json({ error: 'full_name required' }, { status: 400 })

  const stage = body.stage && ALLOWED_STAGES.includes(String(body.stage)) ? String(body.stage) : 'Lead'
  const source_channel = body.source_channel && ALLOWED_SOURCES.includes(String(body.source_channel))
    ? String(body.source_channel) : null

  const sb = svc()

  // Mint the next P-xxx ID — find the current max and add 1. Locked to the
  // single-row insert so two concurrent creates produce different IDs.
  const { data: existing } = await sb.from('prospects').select('prospect_id')
  const nextNum = (existing || [])
    .map(r => {
      const m = String(r.prospect_id).match(/^(?:P|TRC)-?(\d+)$/i)
      return m ? parseInt(m[1], 10) : 0
    })
    .reduce((a, b) => Math.max(a, b), 0) + 1
  const prospect_id = `P-${String(nextNum).padStart(3, '0')}`

  const row = {
    prospect_id, stage, full_name,
    nickname:              body.nickname              ? String(body.nickname).slice(0, 200)              : null,
    referred_by_name:      body.referred_by_name      ? String(body.referred_by_name).slice(0, 200)      : null,
    referred_by_member_no: body.referred_by_member_no ? String(body.referred_by_member_no).slice(0, 12)  : null,
    referral_relationship: body.referral_relationship ? String(body.referral_relationship).slice(0, 200) : null,
    source_channel,
    contact_info:          body.contact_info          ? String(body.contact_info).slice(0, 1000)         : null,
    first_contact_date:    body.first_contact_date    ? String(body.first_contact_date)                  : null,
    next_action:           body.next_action           ? String(body.next_action).slice(0, 500)           : null,
    next_action_date:      body.next_action_date      ? String(body.next_action_date)                    : null,
    assigned_to:           body.assigned_to           ? String(body.assigned_to).slice(0, 200)           : null,
    notes:                 body.notes                 ? String(body.notes).slice(0, 5000)                : null,
    profession:            body.profession            ? String(body.profession).slice(0, 200)            : null,
  }

  const { data, error } = await sb.from('prospects').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sb.from('prospect_activity').insert({
    prospect_id,
    actor,
    event_type: 'created',
    to_value: stage,
    note: `Prospect added by ${actor}.`,
  })

  return NextResponse.json({ prospect: data })
}
