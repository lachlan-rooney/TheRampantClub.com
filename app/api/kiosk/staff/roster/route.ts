import { NextResponse } from 'next/server'
import { svc, deviceOk } from '@/lib/kiosk/server'

// The staff picker roster — names only (NOT member PII). Device-gated: only an
// enrolled tablet may read it (defence in depth atop the middleware page-gate).

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const { data } = await svc().rpc('kiosk_staff_roster')
  return NextResponse.json({ staff: data || [] })
}
