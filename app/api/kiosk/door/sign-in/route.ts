import { NextResponse } from 'next/server'
import { svc } from '@/lib/kiosk/server'
import { doorDevice } from '@/lib/kiosk/door'
import { cleanGuestName, doorClock, greetingName, matchTokens, namesMatch } from '@/lib/guests'

// POST /api/kiosk/door/sign-in   { name, signature }  — the door iPad only.
//
// ONE CALL, NAME AND SIGNATURE TOGETHER. The obvious design checks the name
// first and asks for the signature second. That turns the door into an oracle:
// type a name, learn whether it is on tonight's list, repeat. Here nothing is
// learned without a drawn signature, every attempt leaves a guest_visits row the
// staff can see, and the device is capped per minute on top.
//
// The response never names the host and never says whether the name was on the
// list — only "welcome" or "please wait". Who the host is, and why the guest is
// waiting, is shown to the duty manager AFTER their PIN (/review).
export const dynamic = 'force-dynamic'

const PER_MINUTE = 6
const MAX_SIGNATURE_CHARS = 400_000
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function validSignature(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 200 || s.length > MAX_SIGNATURE_CHARS) return false
  const prefix = 'data:image/png;base64,'
  if (!s.startsWith(prefix)) return false
  try { return Buffer.from(s.slice(prefix.length, prefix.length + 16), 'base64').subarray(0, 4).equals(PNG_MAGIC) } catch { return false }
}

export async function POST(req: Request) {
  const dev = await doorDevice()
  if (!dev) return NextResponse.json({ error: 'This tablet is not the door.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const name = cleanGuestName(body?.name)
  if (!name || matchTokens(name).join('').length < 2) return NextResponse.json({ error: 'name' }, { status: 400 })
  if (!validSignature(body?.signature)) return NextResponse.json({ error: 'signature' }, { status: 400 })

  const a = svc()

  // Rate cap, per device. Counted from the rows this device has written — the
  // attempts ARE the visits, so there is no separate counter to drift.
  const { count } = await a.from('guest_visits').select('id', { count: 'exact', head: true })
    .eq('device_id', dev.id).gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((count ?? 0) >= PER_MINUTE) return NextResponse.json({ error: 'busy' }, { status: 429 })

  const clock = doorClock()

  // Tonight's expected guests: bookings on the service date that are still on.
  const { data: bookings } = await a.from('bookings')
    .select('booking_id, member_no').eq('booking_date', clock.serviceDate).in('status', ['pending', 'confirmed', 'arrived'])
  const bookingIds = (bookings || []).map(b => b.booking_id as string)
  const hostOf = new Map((bookings || []).map(b => [b.booking_id as string, b.member_no as string]))

  let match: { id: string; booking_id: string } | null = null
  let alreadyIn = false
  if (bookingIds.length) {
    const { data: listed } = await a.from('booking_guests').select('id, booking_id, guest_name').in('booking_id', bookingIds)
    const candidates = ((listed || []) as { id: string; booking_id: string; guest_name: string }[]).filter(g => namesMatch(name, g.guest_name))
    if (candidates.length) {
      // The same name on two bookings (two Johns): prefer one not yet signed in.
      const { data: prior } = await a.from('guest_visits')
        .select('booking_guest_id, referred_reason, decision').in('booking_guest_id', candidates.map(c => c.id))
      const inside = new Set(((prior || []) as { booking_guest_id: string; referred_reason: string | null; decision: string | null }[])
        .filter(v => v.decision === 'admitted' || (!v.referred_reason && v.decision == null)).map(v => v.booking_guest_id))
      match = candidates.find(c => !inside.has(c.id)) || candidates[0]
      alreadyIn = inside.has(match.id)
    }
  }

  // Why the duty manager is needed, if they are. After 22:30 wins: House Rule 9
  // applies whether or not the name was given, and on_list records the rest.
  const referred_reason = clock.afterLastEntry ? 'after_last_entry'
    : !match ? 'not_on_list'
    : alreadyIn ? 'already_signed_in'
    : null

  const { data: row, error } = await a.from('guest_visits').insert({
    guest_name: name,
    host_member_no: match ? hostOf.get(match.booking_id) || null : null,
    visit_date: clock.serviceDate,
    party_size: 1,
    logged_by: `door · ${dev.label}`.slice(0, 120),
    booking_id: match?.booking_id || null,
    booking_guest_id: match?.id || null,
    signed_in_at: new Date().toISOString(),
    signature_data_url: body.signature,
    on_list: !!match,
    referred_reason,
    device_id: dev.id,
  }).select('id').single()
  if (error || !row) return NextResponse.json({ error: 'save' }, { status: 500 })

  // Housekeeping, best-effort: the daily cron is the schedule, this is the
  // belt-and-braces. A failure here must never cost a guest their welcome.
  try { await a.rpc('guest_signatures_purge') } catch { /* the cron will */ }

  if (referred_reason) return NextResponse.json({ status: 'awaiting', visit_id: row.id })
  return NextResponse.json({ status: 'welcome', first_name: greetingName(name) })
}
