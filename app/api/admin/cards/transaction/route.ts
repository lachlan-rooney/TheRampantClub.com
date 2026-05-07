import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

const KINDS = ['topup', 'charge', 'adjust', 'refund'] as const
type Kind = typeof KINDS[number]

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const member_number = String(body.member_number || '').trim()
  const kind = body.kind as Kind
  const amount = Number(body.amount_vnd)
  const note = body.note ? String(body.note).slice(0, 200) : null

  if (!member_number) return NextResponse.json({ error: 'member_number required' }, { status: 400 })
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
  if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: 'amount_vnd must be a non-zero number' }, { status: 400 })

  // Sign convention: topup/refund add, charge subtracts. adjust uses sign as given.
  let signed = Math.round(amount)
  if (kind === 'topup' || kind === 'refund') signed = Math.abs(signed)
  else if (kind === 'charge') signed = -Math.abs(signed)
  // 'adjust' keeps the sign caller passed.

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Read current card row.
  const { data: card, error: fetchErr } = await supabase
    .from('member_cards')
    .select('credit_vnd, expires_at')
    .eq('member_number', member_number)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!card) return NextResponse.json({ error: 'No card linked to this member' }, { status: 404 })

  // Block charges on expired credit; top-ups and adjustments are still allowed.
  if (kind === 'charge' && card.expires_at && new Date(card.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Credit has expired' }, { status: 400 })
  }

  const newBalance = (card.credit_vnd ?? 0) + signed
  if (newBalance < 0) {
    return NextResponse.json({ error: `Insufficient credit (balance ${card.credit_vnd} VND)` }, { status: 400 })
  }

  // Update balance.
  const { error: updErr } = await supabase
    .from('member_cards')
    .update({ credit_vnd: newBalance, updated_at: new Date().toISOString() })
    .eq('member_number', member_number)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Insert audit row.
  const { error: txErr } = await supabase
    .from('card_transactions')
    .insert({
      member_number,
      amount_vnd: signed,
      kind,
      note,
      staff_id: user?.id || null,
      staff_email: user?.email || null,
      balance_after_vnd: newBalance,
    })
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, balance_vnd: newBalance })
}
