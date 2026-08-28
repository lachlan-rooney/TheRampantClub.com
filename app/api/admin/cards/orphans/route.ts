import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { fetchMembers } from '@/lib/member-roster'

// Lists member_cards rows whose member_number is no longer present in the
// members-table roster — i.e. credit accounts attached to ex-members.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sheet roster
  let sheetNumbers = new Set<string>()
  try {
    const all = await fetchMembers()
    for (const m of all) if (m['Member No.']) sheetNumbers.add(m['Member No.'])
  } catch { /* fall through; treat all rows as orphans */ }

  const supabase = await createServerSupabaseClient()
  const { data: rows, error } = await supabase
    .from('member_cards')
    .select('member_number, card_uid, credit_vnd, expires_at, linked_at, updated_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orphans = (rows || []).filter(r => !sheetNumbers.has(r.member_number))
  return NextResponse.json({ orphans, sheet_known: sheetNumbers.size })
}
