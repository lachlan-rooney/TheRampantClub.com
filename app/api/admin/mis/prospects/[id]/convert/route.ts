import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/mis/prospects/[id]/convert
//
// Converts a prospect to a member. If the prospect already has a provisional
// member_no allocated (because their interview transcript was processed),
// we flip that member's status to 'Active'. Otherwise we mint a fresh
// TRC-Mxxx. All writes (mint/flip member + link + stage Onboarded + audit)
// run in ONE transaction via convert_prospect() so it can't half-fail.
//
// Body: { tier: 'Founding'|'Legacy'|'Pioneer'|'Corporate'|'Honorary' }

export const dynamic = 'force-dynamic'

const ALLOWED_TIERS = ['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: { tier?: unknown; nickname?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const tier = String(body.tier || '').trim()
  if (!ALLOWED_TIERS.includes(tier)) {
    return NextResponse.json({ error: `tier must be one of ${ALLOWED_TIERS.join(', ')}` }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Atomic: mint/flip the member, link it, stage the prospect Onboarded, and
  // log it — as ONE transaction, so the forward direction can't half-fail.
  const nickname = body.nickname ? String(body.nickname).slice(0, 200) : null
  const { data, error } = await sb.rpc('convert_prospect', {
    p_prospect_id: id,
    p_tier: tier,
    p_nickname: nickname,
    p_actor: actor,
  })
  if (error) {
    const status = /not found/i.test(error.message) ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  const member_no = (data as { member_no?: string } | null)?.member_no
  return NextResponse.json({ ok: true, member_no, tier })
}
