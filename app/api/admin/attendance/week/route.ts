import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { weekAttendance } from '@/lib/attendance'

// GET /api/admin/attendance/week?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// The live attendance strip at the top of /admin/calendar (2026-09-15). Counts
// only — no names leave this route. What counts, and why, is in lib/attendance.ts.
// Polled every minute by the strip, so it is uncached and cheap: four reads.
export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const ISO = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  if (!ISO.test(from) || !ISO.test(to) || to < from) {
    return NextResponse.json({ error: 'from and to are required as YYYY-MM-DD, from ≤ to' }, { status: 400 })
  }
  // A week is what the strip asks for; a month is the most anyone should.
  const days = (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000
  if (days > 31) return NextResponse.json({ error: 'At most 31 days at a time.' }, { status: 400 })

  try {
    const data = await weekAttendance(svc(), from, to)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
