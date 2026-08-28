import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Members-only — count of distinct members tapped in within the last 4 hours.
// The raw card_presence table is admin-only under RLS (attendance history is
// private); this endpoint reads it under SERVICE ROLE but returns ONLY a
// 4-hour, count-bounded view, so a member can't reach the full history.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const session = await createServerSupabaseClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  const { data: rows } = await svc()
    .from('card_presence')
    .select('member_number, seen_at')
    .gte('seen_at', since)
    .order('seen_at', { ascending: false })

  const distinct = new Map<string, string>()
  for (const r of rows || []) {
    if (!distinct.has(r.member_number)) distinct.set(r.member_number, r.seen_at)
  }

  return NextResponse.json({
    count: distinct.size,
    members: [...distinct.keys()],
    since,
  })
}
