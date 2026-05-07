import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { uid, member_number } = await req.json().catch(() => ({}))
  if (!uid || !member_number) {
    return NextResponse.json({ error: 'uid and member_number required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const normalisedUid = String(uid).toUpperCase()
  const memberKey = String(member_number).trim()

  // Detach this UID from any other member it might be on.
  await supabase.from('member_cards').delete().eq('card_uid', normalisedUid)

  // Upsert the link for this member (replacing any existing card on them).
  const { error } = await supabase
    .from('member_cards')
    .upsert(
      { member_number: memberKey, card_uid: normalisedUid, linked_at: new Date().toISOString() },
      { onConflict: 'member_number' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { uid, member_number } = await req.json().catch(() => ({}))
  if (!uid && !member_number) {
    return NextResponse.json({ error: 'uid or member_number required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const q = supabase.from('member_cards').delete()
  const { error } = uid
    ? await q.eq('card_uid', String(uid).toUpperCase())
    : await q.eq('member_number', String(member_number).trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
