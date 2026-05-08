import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Logged every time a card tap successfully resolves to a member, so the
// members portal can show how many distinct people are currently in the
// clubhouse.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { member_number } = await req.json().catch(() => ({}))
  if (!member_number) {
    return NextResponse.json({ error: 'member_number required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('card_presence')
    .insert({ member_number: String(member_number).trim() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
