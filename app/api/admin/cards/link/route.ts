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
  const { data: { user } } = await supabase.auth.getUser()
  const normalisedUid = String(uid).toUpperCase()
  const memberKey = String(member_number).trim()

  // Was this UID already on someone? If so we need to detach + audit it.
  const { data: prev } = await supabase
    .from('member_cards')
    .select('member_number, credit_vnd')
    .eq('card_uid', normalisedUid)
    .neq('member_number', memberKey)
    .maybeSingle()

  if (prev) {
    await supabase
      .from('member_cards')
      .update({ card_uid: null, linked_at: null, updated_at: new Date().toISOString() })
      .eq('member_number', prev.member_number)

    await supabase.from('card_transactions').insert({
      member_number: prev.member_number,
      amount_vnd: 0,
      kind: 'unlink',
      note: `Card ${normalisedUid} reassigned to member ${memberKey}`,
      staff_id: user?.id || null,
      staff_email: user?.email || null,
      balance_after_vnd: prev.credit_vnd ?? 0,
    })
  }

  // Upsert the link for this target member.
  const { data: existing } = await supabase
    .from('member_cards')
    .select('credit_vnd, card_uid')
    .eq('member_number', memberKey)
    .maybeSingle()

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

  // Audit the link. If the same UID was already on this member there's
  // nothing meaningful to record.
  if (existing?.card_uid !== normalisedUid) {
    await supabase.from('card_transactions').insert({
      member_number: memberKey,
      amount_vnd: 0,
      kind: 'link',
      note: existing?.card_uid
        ? `Card swapped: ${existing.card_uid} → ${normalisedUid}`
        : `Card linked: ${normalisedUid}`,
      staff_id: user?.id || null,
      staff_email: user?.email || null,
      balance_after_vnd: existing?.credit_vnd ?? 0,
    })
  }

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
  const { data: { user } } = await supabase.auth.getUser()

  // Find the row first so we can decide between hard-delete (zero balance,
  // nothing to preserve) and soft-unlink (credit retained for re-issue).
  const sel = supabase
    .from('member_cards')
    .select('member_number, card_uid, credit_vnd')
  const { data: card } = uid
    ? await sel.eq('card_uid', String(uid).toUpperCase()).maybeSingle()
    : await sel.eq('member_number', String(member_number).trim()).maybeSingle()

  if (!card) return NextResponse.json({ ok: true, action: 'noop' })

  // Audit the unlink.
  await supabase.from('card_transactions').insert({
    member_number: card.member_number,
    amount_vnd: 0,
    kind: 'unlink',
    note: card.card_uid ? `Card unlinked: ${card.card_uid}` : 'Account unlinked',
    staff_id: user?.id || null,
    staff_email: user?.email || null,
    balance_after_vnd: card.credit_vnd ?? 0,
  })

  if ((card.credit_vnd ?? 0) === 0) {
    // No credit to preserve — drop the row entirely.
    const { error } = await supabase
      .from('member_cards')
      .delete()
      .eq('member_number', card.member_number)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'deleted' })
  }

  const { error } = await supabase
    .from('member_cards')
    .update({ card_uid: null, linked_at: null, updated_at: new Date().toISOString() })
    .eq('member_number', card.member_number)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: 'soft-unlinked' })
}
