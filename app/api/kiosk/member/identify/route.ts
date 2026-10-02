import { NextResponse } from 'next/server'
import { displayFirstName } from '@/lib/kiosk/name'
import { svc, deviceOk } from '@/lib/kiosk/server'
import { uidCandidates } from '@/lib/cards/uid'

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

// Moved to lib/kiosk/name (2026-10-02) when /api/kiosk/member/me turned out to
// have its own, worse answer to the same question — it greeted "Mr Rooney" as
// "Mr". This one already preferred the nickname; the shared version also drops
// honorifics and handles Vietnamese name order, which this one described in its
// comment and did not actually do.
const firstName = displayFirstName

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const { uid } = await req.json().catch(() => ({}))
  if (typeof uid !== 'string' || !uid.trim()) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const a = svc()
  // Same normalisation the admin link/lookup uses, so a card linked there resolves here.
  // A card typed in by the desk reader is a decimal number; the same card read
  // over NFC is hex. Match either (lib/cards/uid), or a tap never finds anyone.
  const { data: cards } = await a.from('member_cards')
    .select('member_number').in('card_uid', uidCandidates(uid))
  const card = (cards || [])[0]
  // The scanned code goes back with a miss so the screen can show WHAT it read —
  // a tap that silently does nothing is unreportable and unfixable.
  if (!card) return NextResponse.json({ found: false, scanned: uid.toUpperCase().trim() })

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
