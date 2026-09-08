import { NextResponse } from 'next/server'
import { svc, deviceOk } from '@/lib/kiosk/server'

// Card tap → who to greet. DEVICE-GATED, and deliberately NOT /api/kiosk/lookup:
// that endpoint returns the full name AND the credit balance, which is right for
// the public display kiosk's transient arrival greeting and far too much for a PIN
// screen that sits open on a bar top while six digits are thumbed in.
//
// THIS RETURNS A FIRST NAME AND A MEMBERSHIP NUMBER. Nothing else — no balance, no
// visit history, no tier, no full name. The constraint is enforced by what the
// response CONTAINS, not by what the screen chooses to render.
//
// Not an enumeration oracle: possession of the physical linked card already proves
// the member exists, so has_pin here reveals nothing new. The TYPED path keeps
// kiosk_member_login's null-on-every-failure rule instead.

export const dynamic = 'force-dynamic'

/** Prefer the nickname — what we actually call them. First-token splitting is
 *  wrong for Vietnamese name order ("Nguyen Van Binh" would be greeted as the
 *  family name), so full_name is only the fallback. */
function firstName(nickname: string | null, fullName: string | null): string | null {
  const nick = (nickname || '').trim()
  if (nick) return nick.split(/\s+/)[0]
  const full = (fullName || '').trim()
  return full ? full.split(/\s+/)[0] : null
}

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const { uid } = await req.json().catch(() => ({}))
  if (typeof uid !== 'string' || !uid.trim()) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const a = svc()
  // Same normalisation the admin link/lookup uses, so a card linked there resolves here.
  const { data: card } = await a.from('member_cards')
    .select('member_number').eq('card_uid', uid.toUpperCase().trim()).maybeSingle()
  if (!card) return NextResponse.json({ found: false })

  const { data: m } = await a.from('members')
    .select('member_no, full_name, nickname').eq('member_no', card.member_number).maybeSingle()
  if (!m) return NextResponse.json({ found: false })

  const { data: pin } = await a.from('member_kiosk_pins')
    .select('member_no').eq('member_no', m.member_no).maybeSingle()

  return NextResponse.json({
    found: true,
    member_no: m.member_no,
    first_name: firstName(m.nickname, m.full_name),
    has_pin: !!pin,
  })
}
