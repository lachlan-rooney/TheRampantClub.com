import { createClient } from '@supabase/supabase-js'

// The roster, from the `members` table — the single source of truth for member
// identity now that everything runs through the in-app pipeline (the Google
// Sheet is retired for roster purposes). Returns rows in the SAME sheet-shaped
// form the old fetchMemberSheet() produced, so it's a drop-in for the roster
// consumers (cards, membership, kiosk, lookups). Server-only (service role).
//
// NOTE: the sheet also held member PREFERENCES (allergies, whisky profile, …)
// which are NOT in the members table — that's a separate surface (quickref) and
// still reads the sheet via lib/member-sheet.

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function fetchMembers(): Promise<Record<string, string>[]> {
  const { data } = await svc().from('members').select('member_no, full_name, nickname, tier').order('member_no')
  return (data || []).filter(m => m.member_no).map(m => {
    const full = (m.full_name || '').trim()
    const sp = full.indexOf(' ')
    return {
      'Member No.': m.member_no,
      'Full Name': full,
      'First Name': sp > 0 ? full.slice(0, sp) : full,
      'Last Name': sp > 0 ? full.slice(sp + 1).trim() : '',
      'Nickname': m.nickname || '',
      'Tier': m.tier || '',
    }
  })
}
