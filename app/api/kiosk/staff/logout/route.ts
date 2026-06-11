import { NextResponse } from 'next/server'
import { STAFF_COOKIE } from '@/lib/kiosk/server'

// Drop the acting staff (auto-logout / switch-user). The DEVICE session persists —
// only the attribution is cleared, returning the kiosk to the staff picker.
export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
