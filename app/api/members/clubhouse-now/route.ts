import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Members-only — count of distinct members tapped in within the last 4 hours.
// Returns { count, names: [...] } where names are first-name only and
// shuffled to avoid easy identification of who's in.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  const { data: rows } = await supabase
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
