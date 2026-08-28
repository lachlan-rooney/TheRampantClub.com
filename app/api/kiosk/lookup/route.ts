import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEMO_MEMBERS_BY_NUMBER } from '@/lib/demo-members'
import { fetchMemberSheet } from '@/lib/member-sheet'

// Public-ish kiosk endpoint. Anyone with the physical card UID can fetch the
// associated member's display name + balance. No admin auth — by the time a UID
// can be presented, the cardholder is physically at the tablet.
//
// We deliberately do NOT return transactions or anything sensitive. Just enough
// to greet the member and show their balance briefly.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const normalised = uid.toUpperCase().replace(/[^A-F0-9]/g, '')
  if (!normalised) return NextResponse.json({ error: 'invalid uid' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: link } = await supabase
    .from('member_cards')
    .select('member_number, credit_vnd, expires_at')
    .eq('card_uid', normalised)
    .maybeSingle()

  if (!link) return NextResponse.json({ found: false })

  // Look up the member name from the Google Sheet — same source used elsewhere.
  let displayName: string | null = null
  try {
    {
      const all = await fetchMemberSheet()
      const m = all.find(x => x['Member No.'] === link.member_number)
      if (m) {
        const first = m['First Name'] || ''
        const last = m['Last Name'] || ''
        displayName = `${first} ${last}`.trim() || null
      }
    }
  } catch { /* fallback to member number */ }

  // Demo override — when the member isn't in the Google Sheet but lives in the
  // hardcoded demo list, surface that name. Keeps the real fetcher untouched.
  if (!displayName && DEMO_MEMBERS_BY_NUMBER[link.member_number]) {
    displayName = DEMO_MEMBERS_BY_NUMBER[link.member_number].full_name
  }

  // Log the presence (best-effort; failure shouldn't block the response).
  supabase.from('card_presence').insert({ member_number: link.member_number }).then(() => {}, () => {})

  return NextResponse.json({
    found: true,
    member_number: link.member_number,
    display_name: displayName,
    credit_vnd: link.credit_vnd,
    expires_at: link.expires_at,
  })
}
