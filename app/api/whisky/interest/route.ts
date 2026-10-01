import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { deviceOk } from '@/lib/kiosk/server'

// WHAT THE CLUB IS LOOKING AT — counts, never who.
//
// Owner, 2026-10-01, asked for the Flavour Compass to be made prominent with
// "top searched drams", and chose ANONYMOUS COUNTS ONLY when asked how much to
// record.
//
// This route takes a bottle and a kind and nothing else. There is nowhere to
// put a member id because there is no member column: the table behind it is a
// counter per bottle per DAY, incremented in place, so after the first look
// there is no new row to correlate against anything. db/whisky_interest_and_
// gallery_prompts.sql explains why dropping a member column from a timestamped
// log would NOT have been anonymity with sixteen members.
//
// WHO MAY COUNT: a signed-in member, or an enrolled club tablet. Not the open
// internet — otherwise the "most looked-at" list is whatever a script decides
// it should be. It is still only a popularity count, so the gate is a modest
// one and a failure here is silent: a member reading about whisky must never
// see an error because a counter did not increment.
//
// FIRE AND FORGET. The caller does not wait for this and does not care if it
// fails. It answers 204 either way.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KINDS = new Set(['bottle', 'finder', 'shelf'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const { whisky_id, kind } = await req.json().catch(() => ({}))
  if (typeof whisky_id !== 'string' || !UUID.test(whisky_id) || !KINDS.has(kind)) {
    return new NextResponse(null, { status: 204 })
  }

  // A member, or a club tablet. Checked in that order because the member case
  // is the common one.
  let allowed = false
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    allowed = !!user
  } catch { /* fall through to the device check */ }
  if (!allowed) { try { allowed = await deviceOk() } catch { allowed = false } }
  if (!allowed) return new NextResponse(null, { status: 204 })

  try {
    const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await a.rpc('whisky_interest_bump', { p_whisky: whisky_id, p_kind: kind })
  } catch { /* the SQL may not be run yet; a counter is never worth an error */ }

  return new NextResponse(null, { status: 204 })
}
