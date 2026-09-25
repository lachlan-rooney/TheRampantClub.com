import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { readMenus } from '@/lib/menus/read'
import { SHOWCASE_COOKIE, verifyShowcasePass } from '@/lib/showcase/gate'

// THE MENU FOR THE SHOWCASE — the same read, behind a different door.
//
// It goes through readMenus() exactly as the room tablet's route does, which
// is the boundary that reads the two public VIEWS and never the base tables,
// so the cost columns cannot leave through here either. What it does NOT do is
// resolve a device: there is no room, no last_seen, and nothing this page can
// send. `room` is a label, not an enrolment.

export const dynamic = 'force-dynamic'

export async function GET() {
  const pass = (await cookies()).get(SHOWCASE_COOKIE)?.value
  if (!verifyShowcasePass(pass)) return NextResponse.json({ error: 'No showcase pass.' }, { status: 403 })

  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  try {
    const menus = await readMenus(a)
    return NextResponse.json({
      ...menus,
      room: 'Showcase',
      now: new Date().toISOString(),
      showcase: true,
    }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the menus.' }, { status: 500 })
  }
}
