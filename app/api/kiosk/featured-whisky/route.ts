import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Returns one in-stock whisky to feature on the Rampant Room kiosk.
// Deterministic per day so it doesn't flicker between refreshes.

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 min

function saigonDayIndex(): number {
  const now = new Date()
  const local = new Date(now.getTime() + 7 * 3600 * 1000)
  const startOfYear = new Date(Date.UTC(local.getUTCFullYear(), 0, 0))
  return Math.floor((local.getTime() - startOfYear.getTime()) / 86400000)
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('whiskies')
    .select('id, name, region, distillery, abv, age, tasting_notes')
    .eq('in_stock', true)
    .order('id', { ascending: true })

  if (error || !data || data.length === 0) {
    return NextResponse.json({ whisky: null })
  }

  const pick = data[saigonDayIndex() % data.length]
  return NextResponse.json({ whisky: pick })
}
