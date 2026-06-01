import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'

// POST /api/admin/mis/prospects/[id]/convert
//
// Converts a prospect to a member. If the prospect already has a provisional
// member_no allocated (because their interview transcript was processed),
// we flip that member's status to 'Active'. Otherwise we mint a fresh
// TRC-Mxxx via the mint_member_no() Postgres function.
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

  const { data: prospect } = await sb.from('prospects').select('*').eq('prospect_id', id).maybeSingle()
  if (!prospect) return NextResponse.json({ error: 'prospect not found' }, { status: 404 })

  let member_no: string

  if (prospect.converted_member_no) {
    // Flip the existing provisional member to Active.
    member_no = prospect.converted_member_no
    const { error } = await sb.from('members').update({
      status: 'Active',
      tier,
      nickname: body.nickname ? String(body.nickname).slice(0, 200) : prospect.nickname,
    }).eq('member_no', member_no)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Mint a fresh member_no and create the row.
    const { data: minted, error: mintErr } = await sb.rpc('mint_member_no')
    if (mintErr || !minted) return NextResponse.json({ error: mintErr?.message || 'mint failed' }, { status: 500 })
    member_no = String(minted)

    const { error: insErr } = await sb.from('members').insert({
      member_no,
      full_name: prospect.full_name,
      nickname:  body.nickname ? String(body.nickname).slice(0, 200) : prospect.nickname,
      tier,
      status: 'Active',
      join_date: vnDateString(),
      referred_by: prospect.referred_by_name,
    })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Flip the prospect to Onboarded.
  await sb.from('prospects').update({
    stage: 'Onboarded',
    decision: 'Approved',
    decision_date: vnDateString(),
    converted_member_no: member_no,
    updated_at: new Date().toISOString(),
  }).eq('prospect_id', id)

  await sb.from('prospect_activity').insert({
    prospect_id: id,
    actor,
    event_type: 'converted',
    to_value: member_no,
    note: `Converted to ${tier} member ${member_no}.`,
  })

  return NextResponse.json({ ok: true, member_no, tier })
}
