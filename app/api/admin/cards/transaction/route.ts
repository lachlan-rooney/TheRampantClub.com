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

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.rpc('apply_card_transaction', {
    p_member_number: member_number,
    p_kind: kind,
    p_amount_vnd: Math.round(amount),
    p_note: note,
    p_staff_id: user?.id || null,
    p_staff_email: user?.email || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  // rpc returns an array; take the first row
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    ok: true,
    balance_vnd: row?.balance_after_vnd ?? 0,
    transaction_id: row?.transaction_id || null,
  })
}
