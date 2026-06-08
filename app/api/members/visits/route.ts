import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/members/visits → the LOGGED-IN member's own visits.
// visits RLS is admin-only, so we resolve the session → profiles.member_no
// (the 0a FK) and return ONLY that member's rows via service-role. Member-safe
// fields only (no logged_by / notes / emotional_state internal columns).

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ visits: [] })   // unlinked → nothing

  const { data, error } = await sb.from('visits')
    .select('visit_id, visit_date, space, duration_min')
    .eq('member_no', prof.member_no)
    .order('visit_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ visits: data || [] })
}
