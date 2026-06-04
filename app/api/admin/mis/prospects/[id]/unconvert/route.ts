import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/mis/prospects/[id]/unconvert
//
// The atomic inverse of convert/allocate-member: nulls prospects.converted_member_no,
// deletes the (provisional) members row, and returns the prospect to Lead — all in
// one transaction via unconvert_prospect(). The DB function carries a hard safety
// guard (Provisional / Pending-Signature only, and no real data) so a real Active
// member can NEVER be removed by this path. We re-assert the guard here as defence
// in depth before calling.

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Defence in depth: refuse before touching the DB if the linked member isn't
  // a removable provisional. (The function refuses too — this just gives a
  // cleaner message and avoids an exception round-trip.)
  const { data: prospect } = await sb.from('prospects')
    .select('converted_member_no')
    .eq('prospect_id', id)
    .maybeSingle()
  if (!prospect) return NextResponse.json({ error: 'prospect not found' }, { status: 404 })
  if (!prospect.converted_member_no) {
    return NextResponse.json({ error: 'This prospect is not linked to a member — nothing to un-convert.' }, { status: 400 })
  }
  const { data: member } = await sb.from('members')
    .select('status')
    .eq('member_no', prospect.converted_member_no)
    .maybeSingle()
  if (member && !['Provisional', 'Pending Signature'].includes(member.status)) {
    return NextResponse.json({
      error: `Refused — ${prospect.converted_member_no} is a ${member.status} member. Un-convert only removes provisional members.`,
    }, { status: 409 })
  }

  const { data, error } = await sb.rpc('unconvert_prospect', { p_prospect_id: id, p_actor: actor })
  if (error) {
    // The function RAISEs (e.g. the guard) → surface its message as a 409.
    return NextResponse.json({ error: error.message }, { status: 409 })
  }

  return NextResponse.json(data ?? { ok: true })
}
