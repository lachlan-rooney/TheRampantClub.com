import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

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

  // Sheet member
  let member: Record<string, string> | null = null
  try {
    const url = new URL('/api/member-profiles', req.nextUrl.origin)
    const r = await fetch(url, { cache: 'no-store' })
    if (r.ok) {
      const all = await r.json() as Record<string, string>[]
      member = all.find(m => m['Member No.'] === link.member_number) || null
    }
  } catch { /* leave member null */ }

  // Recent transactions (last 10)
  const { data: transactions } = await supabase
    .from('card_transactions')
    .select('id, amount_vnd, kind, note, staff_email, balance_after_vnd, created_at')
    .eq('member_number', link.member_number)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ link, member, transactions: transactions || [] })
}
