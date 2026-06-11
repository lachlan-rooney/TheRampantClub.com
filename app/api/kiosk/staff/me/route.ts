import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'

// Who's acting on this kiosk right now (device-gated). null = show the picker.
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const id = await actingStaffId()
  if (!id) return NextResponse.json({ staff: null })
  const { data: tm } = await svc().from('team_members').select('id, display_name, role_title').eq('id', id).maybeSingle()
  return NextResponse.json({ staff: tm || null })
}
