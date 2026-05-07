import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const member_number = req.nextUrl.searchParams.get('member_number')
  if (!member_number) return NextResponse.json({ error: 'member_number required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: card } = await supabase
    .from('member_cards')
    .select('card_uid, credit_vnd, expires_at, linked_at')
    .eq('member_number', member_number)
    .maybeSingle()

  const { data: txs } = await supabase
    .from('card_transactions')
    .select('id, amount_vnd, kind, note, staff_email, balance_after_vnd, created_at')
    .eq('member_number', member_number)
    .order('created_at', { ascending: false })
    .limit(8)

  return NextResponse.json({
    card: card || null,
    transactions: txs || [],
  })
}
