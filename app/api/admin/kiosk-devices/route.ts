import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { isAdmin } from '@/lib/admin'
import { svc } from '@/lib/kiosk/server'

// Admin device enrolment + listing. Creating a device issues a short-lived PAIRING
// CODE (shown once to the admin, typed on the tablet at /kiosk/pair). The device
// token itself is generated server-side at pair time — never here. Admin-gated.

export const dynamic = 'force-dynamic'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = () => Array.from(randomBytes(6)).map(b => CHARS[b % CHARS.length]).join('')

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { data } = await svc().from('kiosk_devices')
    .select('id, label, enrolled_at, last_seen_at, revoked_at, pair_code, pair_expires_at, created_at')
    .order('created_at', { ascending: false })
  const now = Date.now()
  return NextResponse.json({
    devices: (data || []).map(d => ({
      id: d.id, label: d.label,
      status: d.revoked_at ? 'revoked' : d.enrolled_at ? 'enrolled' : 'pending',
      enrolled_at: d.enrolled_at, last_seen_at: d.last_seen_at,
      pair_code: !d.enrolled_at && !d.revoked_at && d.pair_expires_at && +new Date(d.pair_expires_at) > now ? d.pair_code : null,
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { label } = await req.json().catch(() => ({}))
  if (typeof label !== 'string' || !label.trim()) return NextResponse.json({ error: 'Name the device.' }, { status: 400 })
  const pair = code()
  const { error } = await svc().from('kiosk_devices').insert({
    label: label.trim(), pair_code: pair, pair_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  })
  if (error) return NextResponse.json({ error: 'Could not create.' }, { status: 500 })
  return NextResponse.json({ ok: true, pair_code: pair, expires_in_min: 15 })
}
