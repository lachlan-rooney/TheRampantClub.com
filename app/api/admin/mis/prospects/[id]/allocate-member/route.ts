import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/mis/prospects/[id]/allocate-member
//
// Mints a provisional member_no for a prospect that doesn't have one yet,
// creates a members row with status='Provisional', and links it back via
// prospects.converted_member_no. The provisional member becomes the FK
// target for any preferences extracted during the interview phase.
//
// Idempotent: if the prospect already has a converted_member_no, returns it.

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

  const { data: prospect } = await sb.from('prospects')
    .select('prospect_id, full_name, nickname, converted_member_no, stage')
    .eq('prospect_id', id)
    .maybeSingle()
  if (!prospect) return NextResponse.json({ error: 'prospect not found' }, { status: 404 })

  if (prospect.converted_member_no) {
    return NextResponse.json({ member_no: prospect.converted_member_no, already: true })
  }

  const { data: minted, error: mintErr } = await sb.rpc('mint_member_no')
  if (mintErr || !minted) return NextResponse.json({ error: mintErr?.message || 'mint failed' }, { status: 500 })
  const member_no = String(minted)

  const { error: insErr } = await sb.from('members').insert({
    member_no,
    full_name: prospect.full_name,
    nickname:  prospect.nickname,
    tier:      'Pioneer',          // placeholder; real tier set at conversion
    status:    'Provisional',
    join_date: null,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  await sb.from('prospects').update({
    converted_member_no: member_no,
    updated_at: new Date().toISOString(),
  }).eq('prospect_id', id)

  await sb.from('prospect_activity').insert({
    prospect_id: id,
    actor,
    event_type: 'member_no_allocated',
    to_value: member_no,
    note: `Provisional ${member_no} allocated for interview intake.`,
  })

  return NextResponse.json({ member_no, already: false })
}
