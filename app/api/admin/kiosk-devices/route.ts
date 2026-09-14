import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { isAdmin } from '@/lib/admin'
import { svc } from '@/lib/kiosk/server'
import { isMissingSchema } from '@/lib/guests'

// Admin device enrolment + listing. Creating a device issues a short-lived PAIRING
// CODE (shown once to the admin, typed on the tablet at /kiosk/pair). The device
// token itself is generated server-side at pair time — never here. Admin-gated.

export const dynamic = 'force-dynamic'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = () => Array.from(randomBytes(6)).map(b => CHARS[b % CHARS.length]).join('')

type DeviceRow = { id: string; label: string; room: string | null; purpose?: string; enrolled_at: string | null; last_seen_at: string | null; revoked_at: string | null; pair_code: string | null; pair_expires_at: string | null }
const COLS = 'id, label, room, enrolled_at, last_seen_at, revoked_at, pair_code, pair_expires_at, created_at'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  // purpose (room | door) arrives with db/guest_signin.sql. Until then the select
  // with it errors — list the devices without it rather than list none at all.
  const withPurpose = await svc().from('kiosk_devices').select(`${COLS}, purpose`).order('created_at', { ascending: false })
  const door_ready = !withPurpose.error
  const data = (door_ready
    ? withPurpose.data
    : (await svc().from('kiosk_devices').select(COLS).order('created_at', { ascending: false })).data) as DeviceRow[] | null
  // The room list comes from space_tables, never a hardcoded array. A form list
  // drifts from the seed the moment one is edited and not the other, and the board
  // then joins nothing — silently. (The DB trigger refuses a bad room regardless.)
  const { data: spaces } = await svc().from('space_tables').select('space')
  const rooms = [...new Set((spaces || []).map(r => r.space))].sort()
  const now = Date.now()
  return NextResponse.json({
    rooms,
    door_ready,
    devices: (data || []).map(d => ({
      id: d.id, label: d.label, room: d.room, purpose: d.purpose || 'room',
      status: d.revoked_at ? 'revoked' : d.enrolled_at ? 'enrolled' : 'pending',
      enrolled_at: d.enrolled_at, last_seen_at: d.last_seen_at,
      pair_code: !d.enrolled_at && !d.revoked_at && d.pair_expires_at && +new Date(d.pair_expires_at) > now ? d.pair_code : null,
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { label, room, purpose } = await req.json().catch(() => ({}))
  if (typeof label !== 'string' || !label.trim()) return NextResponse.json({ error: 'Name the device.' }, { status: 400 })
  // THE DOOR (2026-09-14): the guest sign-in iPad at the entrance. Same pairing,
  // same revocation, but it stands in no room — the trigger refuses one — and
  // pairing lands it on /kiosk/door instead of the board.
  const isDoor = purpose === 'door'
  const pair = code()
  const { error } = await svc().from('kiosk_devices').insert({
    label: label.trim(),
    // Stored VERBATIM as the join key. Floor 1 displays as "The Library Bar" but
    // its space string is "Library Bar" — storing the display name joins nothing.
    room: !isDoor && typeof room === 'string' && room ? room : null,
    ...(isDoor ? { purpose: 'door' } : {}),
    pair_code: pair, pair_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  })
  if (error) {
    const msg = isDoor && isMissingSchema(error) ? 'The door iPad needs db/guest_signin.sql to be run first.'
      : error.message.includes('space_tables') ? 'That room is not a bookable space.' : 'Could not create.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true, pair_code: pair, expires_in_min: 15, purpose: isDoor ? 'door' : 'room' })
}
