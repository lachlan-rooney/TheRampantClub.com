import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// The member's kiosk PIN — set and changed BY THE MEMBER, here, where they are
// already authenticated. Deliberately NOT service-role: both calls run as the
// member, and the DB functions derive member_no from auth.uid(), so member_no is
// never a parameter and a caller cannot set a PIN for anybody else.
//
// No admin path anywhere sets or reveals a value. An admin-issued PIN would be
// known to staff at the moment of issuance — and it is the same staff who hold
// the tablet.

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  const { data, error } = await sb.rpc('my_kiosk_pin_state')
  if (error) return NextResponse.json({ error: 'Could not read PIN state.' }, { status: 500 })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ has_pin: !!row?.has_pin, set_at: row?.set_at ?? null })
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const { pin } = await req.json().catch(() => ({}))
  if (typeof pin !== 'string' || !/^[0-9]{6}$/.test(pin)) {
    return NextResponse.json({ error: 'Your PIN must be exactly six digits.' }, { status: 400 })
  }
  const { error } = await sb.rpc('set_my_kiosk_pin', { p_pin: pin })
  if (error) {
    // The DB is the authority on weak PINs; surface its judgement, not a second
    // copy of the rules that could drift from it.
    const weak = /too easily guessed/i.test(error.message)
    return NextResponse.json({
      error: weak
        ? 'That PIN is too easy to guess — avoid runs, repeats and obvious patterns.'
        : /no member linked/i.test(error.message)
          ? 'Your account is not linked to a membership yet. Speak to the team.'
          : 'Could not set your PIN.',
    }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
