import { NextResponse } from 'next/server'
import { svc } from '@/lib/kiosk/server'

// Spend a reset link and set the code. The DATABASE decides whether the code is
// acceptable — kiosk_pin_rejected is shared with the portal path, so the weak-code
// and date-of-birth rules cannot be missed here. This route only maps the reason
// to copy; it does not re-implement the rules, which is how the two paths drift.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { token, pin } = await req.json().catch(() => ({}))
  if (typeof token !== 'string' || typeof pin !== 'string') {
    return NextResponse.json({ error: 'Something is missing.' }, { status: 400 })
  }
  const { data: reason, error } = await svc().rpc('set_kiosk_pin_via_reset', { p_token: token, p_pin: pin })
  if (error) return NextResponse.json({ error: 'Could not set your code.' }, { status: 500 })

  if (reason === null) return NextResponse.json({ ok: true })
  const copy: Record<string, string> = {
    token:  'That link has expired or has already been used. Ask for a new one at the kiosk.',
    format: 'Your code must be exactly six digits.',
    weak:   'That code is too easy to guess — avoid runs, repeats and obvious patterns.',
    dob:    'We know that’s your birthday. Odds are, someone else will too.',
  }
  return NextResponse.json({ error: copy[reason as string] || 'Could not set your code.' }, { status: 400 })
}
