import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// The Return's data — the member's most recent visit in the last ~48h, with the
// drams poured if any consumption was logged. Member-safe fields ONLY (date, space,
// duration — never emotional_state / logged_by / notes, the 0d pattern). No recent
// visit → null → no card. Never invents detail.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ visit: null })

  const vnNow = new Date(Date.now() + 7 * 3600_000)
  const vnToday = vnNow.toISOString().slice(0, 10)
  const since = new Date(vnNow.getTime() - 2 * 86_400_000).toISOString().slice(0, 10)   // ~48h window

  const { data: visit } = await sb.from('visits')
    .select('visit_id, visit_date, space, duration_min')
    .eq('member_no', prof.member_no)
    .gte('visit_date', since).lte('visit_date', vnToday)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!visit) return NextResponse.json({ visit: null })

  // Drams poured that day (member-safe: the bottle name, or the catalogue name).
  const { data: cons } = await sb.from('member_consumption')
    .select('bottle_name, whiskies(name)')
    .eq('member_no', prof.member_no).eq('consumed_on', visit.visit_date)
  const drams = (cons || [])
    .map(c => c.bottle_name || (Array.isArray(c.whiskies) ? c.whiskies[0]?.name : (c.whiskies as { name?: string } | null)?.name))
    .filter((n): n is string => !!n)

  return NextResponse.json({
    visit: { date: visit.visit_date, space: visit.space, duration_min: visit.duration_min, drams },
  })
}
