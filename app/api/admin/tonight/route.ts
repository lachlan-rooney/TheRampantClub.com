import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

function saigonToday(): string {
  const now = new Date()
  const local = new Date(now.getTime() + 7 * 3600 * 1000)
  return local.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const target = (typeof body.pick_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.pick_date))
    ? body.pick_date
    : saigonToday()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const payload = {
    pick_date: target,
    dram_label:  body.dram_label  ?? null,
    dram_note:   body.dram_note   ?? null,
    vinyl_label: body.vinyl_label ?? null,
    vinyl_note:  body.vinyl_note  ?? null,
    member_quote: body.member_quote ?? null,
    updated_by: user?.id || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('daily_picks')
    .upsert(payload, { onConflict: 'pick_date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const date = req.nextUrl.searchParams.get('date') || saigonToday()
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('daily_picks')
    .select('*')
    .eq('pick_date', date)
    .maybeSingle()
  return NextResponse.json({ pick: data, date })
}
