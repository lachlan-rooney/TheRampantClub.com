import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Permanently deletes a member's card account: the member_cards row AND every
// card_transactions row for that member_number. Use for resignations or
// cleaning up zombie zero-balance rows. Confirmation is the caller's job.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { member_number } = await req.json().catch(() => ({}))
  if (!member_number) {
    return NextResponse.json({ error: 'member_number required' }, { status: 400 })
  }
  const memberKey = String(member_number).trim()

  const supabase = await createServerSupabaseClient()
  const { error: txErr } = await supabase
    .from('card_transactions')
    .delete()
    .eq('member_number', memberKey)
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  const { error: cardErr } = await supabase
    .from('member_cards')
    .delete()
    .eq('member_number', memberKey)
  if (cardErr) return NextResponse.json({ error: cardErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
