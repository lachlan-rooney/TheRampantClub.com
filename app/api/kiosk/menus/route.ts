import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { readMenus } from '@/lib/menus/read'
import { menuForSpace } from '@/lib/kiosk/floors'

// THE MENU, FOR A TABLET WITH NO IDENTITY.
//
// A room kiosk has a device token and nothing else — no member session, so it
// cannot read the menu views under `authenticated` the way the members' portal
// does. So the device token is checked here, and the read is done with the
// service role.
//
// That makes this route the boundary, and it reads the same two views
// everything else does. The base tables (and the cost columns on them) are
// never touched. A future change that starts selecting from `menu_items`
// directly would be the bug to catch in review.

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'No device.' }, { status: 403 })

  const a = svc()

  // The token must still resolve to an enrolled room — a cookie left on a
  // tablet that has since been unpaired is not a device.
  const { data } = await a.rpc('kiosk_board', { p_device_token: token })
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.room) return NextResponse.json({ error: 'Not enrolled.' }, { status: 403 })

  try {
    const menus = await readMenus(a)
    return NextResponse.json({
      ...menus,
      room: row.room,
      // The room's own printed menu, if it has one. It used to be the whole of
      // the Menu tab; now it sits underneath the live menu as a link.
      printed: menuForSpace(row.room),
    })
  } catch (e) {
    // Never answer "the menu is empty" when the truth is "the read failed" —
    // during service that reads as the kitchen being closed.
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 })
  }
}
