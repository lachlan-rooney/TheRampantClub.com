import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { sendStaffTaskDigest } from '@/lib/ops/staff-digest'

// POST /api/admin/staff-digest  { team_member_id }
//
// "Send now", from Kiosk & Staff PINs. One named person, so the owner can see
// what actually lands in an inbox instead of waiting for the 09:00 cron and
// guessing. A button that mails the whole team at once is a button nobody dares
// press twice, so this route refuses to be one: team_member_id is required.
//
// It bypasses "already sent today" and the quiet hours — somebody is standing
// there waiting for it — and so it does NOT stamp last_digest_on, which would
// cancel that person's real digest in the morning.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { team_member_id } = await req.json().catch(() => ({}))
  if (typeof team_member_id !== 'string' || !team_member_id) {
    return NextResponse.json({ error: 'Pick one person.' }, { status: 400 })
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await sendStaffTaskDigest(sb, { only: team_member_id, force: true })
  if (!result.ran) return NextResponse.json({ error: result.reason || 'Could not send.' }, { status: 400 })
  return NextResponse.json(result)
}
