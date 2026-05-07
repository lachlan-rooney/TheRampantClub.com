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

  // Detach this UID from any other member it might be on (soft unlink — keeps
  // their credit balance and history intact).
  await supabase
    .from('member_cards')
    .update({ card_uid: null, linked_at: null, updated_at: new Date().toISOString() })
    .eq('card_uid', normalisedUid)
    .neq('member_number', memberKey)

  // Upsert the link for this target member. If they already have a row (e.g.
  // from a previous card with credit) we just attach the new UID; credit and
  // expiry are preserved because we only set the columns we provide.
  const { error } = await supabase
    .from('member_cards')
    .upsert(
      {
        member_number: memberKey,
        card_uid: normalisedUid,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
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

  // Soft unlink: null out the card UID but keep credit + history. Re-linking
  // a new card to the same member preserves the balance.
  const supabase = await createServerSupabaseClient()
  const update = supabase
    .from('member_cards')
    .update({ card_uid: null, linked_at: null, updated_at: new Date().toISOString() })
  const { error } = uid
    ? await update.eq('card_uid', String(uid).toUpperCase())
    : await update.eq('member_number', String(member_number).trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
