import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// MOST LOOKED-AT THIS MONTH — the shelf talking back.
//
// Reads the anonymous day counters and adds up the last thirty days. There is
// nothing per-member to read, because nothing per-member was ever written.
//
// It returns an EMPTY list rather than an error when the table is not there
// yet or nothing has been counted, and the panel that reads it draws nothing
// in that case. A club-wide "most looked-at" built from four looks would be a
// lie told with a chart, so there is a floor below which it says nothing.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DAYS = 30
const MIN_LOOKS = 5        // below this the list is noise, not a signal
const TOP = 6

export async function GET() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const since = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10)
  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data, error } = await a.from('whisky_interest_daily')
    .select('whisky_id, kind, n').gte('day', since)
  if (error || !data?.length) return NextResponse.json({ days: DAYS, bottles: [] })

  const total = new Map<string, number>()
  for (const r of data as { whisky_id: string; n: number }[]) {
    total.set(r.whisky_id, (total.get(r.whisky_id) ?? 0) + (r.n || 0))
  }
  const ranked = [...total.entries()]
    .filter(([, n]) => n >= MIN_LOOKS)
    .sort((x, y) => y[1] - x[1]).slice(0, TOP)
  if (!ranked.length) return NextResponse.json({ days: DAYS, bottles: [] })

  // The bottles themselves. In stock only: a list of things the bar cannot
  // pour is a worse answer than a shorter list.
  const { data: ws } = await a.from('whiskies')
    .select('id, name, distillery, region, age, in_stock')
    .in('id', ranked.map(([id]) => id)).eq('in_stock', true)
  const byId = new Map((ws || []).map(w => [w.id, w]))

  return NextResponse.json({
    days: DAYS,
    bottles: ranked.flatMap(([id, n]) => {
      const w = byId.get(id)
      return w ? [{ id, looks: n, name: (w.name || '').trim(), distillery: w.distillery, region: w.region, age: w.age }] : []
    }),
  })
}
