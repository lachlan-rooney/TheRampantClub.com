import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { svc } from '@/lib/kiosk/server'

/** The six-digit codes a birthday yields. A date of birth is the first thing
 *  anyone guesses, and unlike a weak-pattern PIN it is specific to the member —
 *  it is also written on the membership record, so it is not even a secret. */
function birthdayCodes(iso: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return []
  const [, yyyy, mm, dd] = m
  const yy = yyyy.slice(2)
  return [
    `${dd}${mm}${yy}`, `${mm}${dd}${yy}`, `${yy}${mm}${dd}`,
    `${yyyy}${mm}`,    `${mm}${yyyy}`,    `${dd}${mm}${yyyy}`.slice(0, 6),
  ]
}

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
  // Refuse the member's own date of birth. Checked against their own record only,
  // resolved from their authenticated session — never a value anyone supplies.
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (prof?.member_no) {
    const { data: mem } = await svc().from('members').select('birthday').eq('member_no', prof.member_no).maybeSingle()
    if (mem?.birthday && birthdayCodes(String(mem.birthday)).includes(pin)) {
      // THE REFUSAL LINE. It appears only once they have actually tried it, which
      // is the moment it means something — pre-emptively it would be in the wrong
      // tense, warning about a thing they had not yet done. The advance copy stays
      // plain for that reason; this is where the club has just proved the point.
      //
      // Wording is the owner's, chosen deliberately over a version that pointed at
      // the guesser rather than at us. It is the first time the MIS speaks to a
      // member in its own voice, so it was worth choosing on purpose.
      //
      // TODO (Miss Châu, asking 2026-09-09): the Vietnamese half. A literal
      // rendering loses the dryness entirely — this wants an ear, not a translation.
      return NextResponse.json({
        error: 'We know that’s your birthday. Odds are, someone else will too.',
      }, { status: 400 })
    }
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
