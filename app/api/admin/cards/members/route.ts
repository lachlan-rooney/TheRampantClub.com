import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { DEMO_MEMBERS } from '@/lib/demo-members'
import { fetchMemberSheet } from '@/lib/member-sheet'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Sheet members
  let sheetMembers: Record<string, string>[] = []
  try {
    sheetMembers = await fetchMemberSheet()
  } catch { /* empty fallback */ }

  // 2. Card links
  const supabase = await createServerSupabaseClient()
  const { data: links } = await supabase
    .from('member_cards')
    .select('member_number, card_uid, credit_vnd')

  const linkByNumber = new Map<string, { card_uid: string; credit_vnd: number }>()
  for (const l of links || []) {
    linkByNumber.set(l.member_number, { card_uid: l.card_uid, credit_vnd: l.credit_vnd })
  }

  const members = sheetMembers
    .filter(m => m['Member No.'])
    .map(m => ({
      member_number: m['Member No.'],
      full_name: m['Full Name'] || '',
      tier: m['Tier'] || '',
      card_uid: linkByNumber.get(m['Member No.'])?.card_uid || null,
      credit_vnd: linkByNumber.get(m['Member No.'])?.credit_vnd ?? 0,
    }))

  // 3. Demo members — hardcoded, not in the Sheet. Appended so admins can
  //    link a card to them without touching the real roster.
  const seen = new Set(members.map(m => m.member_number))
  for (const dm of DEMO_MEMBERS) {
    if (seen.has(dm.member_number)) continue
    seen.add(dm.member_number)
    members.push({
      member_number: dm.member_number,
      full_name: dm.full_name,
      tier: dm.tier,
      card_uid: linkByNumber.get(dm.member_number)?.card_uid || null,
      credit_vnd: linkByNumber.get(dm.member_number)?.credit_vnd ?? 0,
    })
  }

  // Overlay the members table: it holds pipeline-created members AND is where
  // tier is edited on the member record, so its tier is authoritative here.
  const { data: dbMembers } = await supabase.from('members').select('member_no, full_name, tier')
  for (const dm of dbMembers || []) {
    if (!dm.member_no) continue
    if (seen.has(dm.member_no)) {
      const row = members.find(m => m.member_number === dm.member_no)
      if (row && dm.tier) row.tier = dm.tier
      continue
    }
    seen.add(dm.member_no)
    members.push({
      member_number: dm.member_no,
      full_name: dm.full_name || '',
      tier: dm.tier || '',
      card_uid: linkByNumber.get(dm.member_no)?.card_uid || null,
      credit_vnd: linkByNumber.get(dm.member_no)?.credit_vnd ?? 0,
    })
  }

  return NextResponse.json({ members })
}
