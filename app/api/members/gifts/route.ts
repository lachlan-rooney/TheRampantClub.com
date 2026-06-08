import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/members/gifts → gifts the LOGGED-IN member has RECEIVED.
// gifts RLS is admin-only; resolve session → profiles.member_no (0a FK) and
// return only that member's gifts via service-role. Member-safe fields only —
// NO cost_vnd, expected_value, given_by, or internal notes (those are staff-only).

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ gifts: [] })

  const { data, error } = await sb.from('gifts')
    .select('id, gift_date, occasion, category, description, photo_url')
    .eq('member_no', prof.member_no)
    .order('gift_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gifts: data || [] })
}
