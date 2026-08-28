import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { demoAsSheetMember } from '@/lib/demo-members'
import { fetchMembers } from '@/lib/member-roster'

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const uid = req.nextUrl.searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: link, error } = await supabase
    .from('member_cards')
    .select('member_number, card_uid, credit_vnd, expires_at, linked_at')
    .eq('card_uid', uid.toUpperCase())
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!link) return NextResponse.json({ link: null, member: null, transactions: [] })

  // Roster member (members table)
  let member: Record<string, string> | null = null
  try {
    const all = await fetchMembers()
    member = all.find(m => m['Member No.'] === link.member_number) || null
  } catch { /* leave member null */ }

  // Demo override — surface hardcoded demo members so admin sees the right name.
  if (!member) member = demoAsSheetMember(link.member_number)

  // Recent transactions (last 10)
  const { data: transactions } = await supabase
    .from('card_transactions')
    .select('id, amount_vnd, kind, note, staff_email, balance_after_vnd, created_at')
    .eq('member_number', link.member_number)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ link, member, transactions: transactions || [] })
}
