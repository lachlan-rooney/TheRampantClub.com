import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/mis/visits/start
//
// Creates a fresh visit row at phase='overture' for the given member and
// returns its visit_id so the caller can route into the Guardian Angel
// cycle. This is the canonical entry point — the spec's Overture phase
// is where the brief assembles and the cycle begins.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: { member_no?: unknown; visit_date?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const member_no = typeof body.member_no === 'string' ? body.member_no.trim() : ''
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const visit_date = typeof body.visit_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.visit_date)
    ? body.visit_date
    : new Date().toISOString().slice(0, 10)

  const sb = svc()
  // Confirm the member exists so we get a clean error rather than a FK
  // failure downstream.
  const { data: member } = await sb.from('members').select('member_no').eq('member_no', member_no).maybeSingle()
  if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })

  const { data, error } = await sb.from('visits').insert({
    member_no,
    visit_date,
    phase: 'overture',
    overture_generated_at: new Date().toISOString(),
    logged_by: actor,
  }).select('visit_id, member_no, visit_date, phase').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ visit: data })
}
