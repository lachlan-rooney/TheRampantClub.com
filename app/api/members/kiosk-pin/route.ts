import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
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
    // The DATABASE is the authority on what a code may be — kiosk_pin_rejected is
    // shared with the reset path so neither can drift. This only maps its verdict
    // to copy; it does not keep a second copy of the rules.
    const m = error.message
    const copy =
      /date of birth/i.test(m)      ? 'We know that\u2019s your birthday. Odds are, someone else will too.'
    : /too easily guessed/i.test(m) ? 'That code is too easy to guess — avoid runs, repeats and obvious patterns.'
    : /6 digits/i.test(m)           ? 'Your code must be exactly six digits.'
    : /no member linked/i.test(m)   ? 'Your account is not linked to a membership yet. Speak to the team.'
    :                                 'Could not set your code.'
    return NextResponse.json({ error: copy }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
