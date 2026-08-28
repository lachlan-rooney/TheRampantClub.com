import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { vnDateString } from '@/lib/datetime'

// POST /api/kiosk/start-visit
// Body: { uid }
//
// Public-ish kiosk endpoint with the same physical-presence trust model
// as /api/kiosk/lookup: by the time a card UID can be presented, the
// cardholder is physically at the tablet. The kiosk fires this on every
// card tap as a fire-and-forget so staff get an Overture-phase visit
// row to greet the member at.
//
// Idempotent — if a visit is already in flight today (phase != closed),
// returns that visit_id rather than starting a second one.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  let body: { uid?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const raw = typeof body.uid === 'string' ? body.uid : ''
  // Match the admin link/lookup normalisation (upper-case, no character
  // stripping) so kiosk resolves exactly what the admin stored.
  const uid = raw.toUpperCase().trim()
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const sb = svc()

  // Resolve the card to a member_no. If the card isn't linked, return
  // 200 with found=false so the kiosk doesn't surface a noisy error.
  const { data: card } = await sb.from('member_cards').select('member_number').eq('card_uid', uid).maybeSingle()
  if (!card) return NextResponse.json({ ok: true, found: false })

  const member_no = card.member_number

  // Idempotency check — reuse any open visit for today.
  const today = vnDateString()
  const { data: existing } = await sb.from('visits')
    .select('visit_id, phase')
    .eq('member_no', member_no)
    .eq('visit_date', today)
    .neq('phase', 'closed')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.visit_id) {
    return NextResponse.json({ ok: true, found: true, visit_id: existing.visit_id, reused: true })
  }

  const { data: rows, error } = await sb.rpc('start_visit_for_member', {
    p_member_no: member_no,
    p_actor:     'kiosk',
  })
  if (error) {
    // Don't expose the error to the kiosk UI — it shouldn't surface
    // backend hiccups to the member. Log on the server side via console.
    console.error('kiosk start-visit RPC failed:', error)
    return NextResponse.json({ ok: false, found: true })
  }

  const row = Array.isArray(rows) ? rows[0] : rows
  return NextResponse.json({
    ok: true,
    found: true,
    visit_id: row?.visit_id || null,
    reused: false,
  })
}
