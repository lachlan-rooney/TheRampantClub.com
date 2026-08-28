import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { fetchMemberSheet } from '@/lib/member-sheet'

// Admin-gated. This returns the club's full member roster (numbers + names), so
// it must never be public. Internal server routes call fetchMemberSheet()
// directly instead of hitting this endpoint; the only browser caller is the
// admin Quick-ref page, which carries the admin session cookie.
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await fetchMemberSheet())
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
