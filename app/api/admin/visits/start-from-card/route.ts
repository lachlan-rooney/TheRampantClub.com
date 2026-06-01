import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/visits/start-from-card
// Body: { uid: string }
//
// Tap-to-start hook for the kiosk. Resolves the card UID → member_no via
// member_cards, then calls start_visit_for_member RPC which atomically:
//   1. Creates a fresh visit at phase='overture' (overture_generated_at +
//      arrival_time both stamped to now)
//   2. If exactly one confirmed/pending booking exists today, links the
//      booking to the visit and flips booking.status to 'arrived'
//
// Returns the visit_id so the kiosk can route the staff straight to the
// Guardian Angel detail page.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'kiosk'

  let body: { uid?: unknown; member_no?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sb = svc()
  let member_no: string | null = null

  // Path 1 — explicit member_no (calendar "Start visit" button).
  if (typeof body.member_no === 'string' && body.member_no.trim()) {
    member_no = body.member_no.trim()
  }

  // Path 2 — card UID lookup (kiosk tap).
  if (!member_no && typeof body.uid === 'string' && body.uid.trim()) {
    const uid = body.uid.trim().toUpperCase()
    const { data: card } = await sb.from('member_cards').select('member_number').eq('card_uid', uid).maybeSingle()
    if (!card) return NextResponse.json({ error: 'card not linked to a member' }, { status: 404 })
    member_no = card.member_number
  }

  if (!member_no) return NextResponse.json({ error: 'uid or member_no required' }, { status: 400 })

  // Confirm member exists (avoid an FK error inside the RPC).
  const { data: member } = await sb.from('members').select('member_no, full_name').eq('member_no', member_no).maybeSingle()
  if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })

  const { data: rows, error } = await sb.rpc('start_visit_for_member', {
    p_member_no: member_no,
    p_actor:     actor,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = Array.isArray(rows) ? rows[0] : rows
  if (!row?.visit_id) return NextResponse.json({ error: 'RPC returned no visit_id' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    visit_id: row.visit_id,
    booking_id: row.booking_id || null,
    member: { member_no: member.member_no, full_name: member.full_name },
  })
}
