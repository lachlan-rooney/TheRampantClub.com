import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { member_number, expires_at } = await req.json().catch(() => ({}))
  if (!member_number) {
    return NextResponse.json({ error: 'member_number required' }, { status: 400 })
  }

  // expires_at: a YYYY-MM-DD date is treated as end-of-day in Saigon (UTC+7)
  // so a card set to expire on "31 Dec" stays valid throughout that day.
  // Other ISO strings are taken as-is.
  let value: string | null = null
  if (expires_at) {
    const dateOnly = typeof expires_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expires_at)
    value = dateOnly
      ? new Date(`${expires_at}T23:59:59+07:00`).toISOString()
      : new Date(expires_at).toISOString()
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('member_cards')
    .update({ expires_at: value, updated_at: new Date().toISOString() })
    .eq('member_number', String(member_number).trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, expires_at: value })
}
