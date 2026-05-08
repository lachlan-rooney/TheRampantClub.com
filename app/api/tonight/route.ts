import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SEED_DRAMS, SEED_VINYLS, SEED_QUOTES, dayIndex } from '@/lib/tonight-seed'

// Saigon UTC+7. Today's local date (YYYY-MM-DD) drives the seed pick.
function saigonToday(): string {
  const now = new Date()
  const local = new Date(now.getTime() + 7 * 3600 * 1000)
  return local.toISOString().slice(0, 10)
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const today = saigonToday()
  const supabase = await createServerSupabaseClient()
  const { data: row } = await supabase
    .from('daily_picks')
    .select('*')
    .eq('pick_date', today)
    .maybeSingle()

  const dramSeed   = SEED_DRAMS[dayIndex(0) % SEED_DRAMS.length]
  const vinylSeed  = SEED_VINYLS[dayIndex(7) % SEED_VINYLS.length]
  const quoteSeed  = SEED_QUOTES[dayIndex(13) % SEED_QUOTES.length]

  return NextResponse.json({
    date: today,
    dram: {
      label: row?.dram_label || dramSeed.label,
      note:  row?.dram_note  || dramSeed.note,
      curated: !!row?.dram_label,
    },
    vinyl: {
      label: row?.vinyl_label || vinylSeed.label,
      note:  row?.vinyl_note  || vinylSeed.note,
      curated: !!row?.vinyl_label,
    },
    quote: row?.member_quote || quoteSeed,
    quote_curated: !!row?.member_quote,
  })
}
