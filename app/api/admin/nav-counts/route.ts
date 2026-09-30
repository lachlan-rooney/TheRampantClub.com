import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'

// WHAT IS WAITING, FOR THE SIDEBAR BADGES.
//
// Owner, 2026-10-01: "if there's a little notification on one of the admin
// tabs like room order, that would be handy too. Showing you where."
//
// WHY A ROUTE AND NOT THREE CLIENT QUERIES. menu_orders is revoked from
// `authenticated` outright — the room tablets write it through the service
// role and the admin page reads it the same way — so a browser asking for a
// count of open orders gets zero rather than an error, which is the worst
// possible answer: a badge that is silently always absent. The counts that
// CAN be read client-side are gathered here too, so all three arrive together
// and the sidebar makes one request a minute instead of three.
//
// Only queues. A badge that counts rows rather than work waiting is a number
// nobody reads twice, and one decorative badge makes the rest untrusted.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ counts: {} }, { status: 403 })
  const sb = svc()
  const today = vnDateString()

  // ACTIVE BOARDS ONLY for the overdue count. Across every board it reads 79,
  // because the Rampant Cup still holds 183 cards dated May; the timeline says
  // 8. A badge that disagrees with the page it points at teaches people to
  // ignore every badge.
  const { data: live } = await sb.from('projects').select('id').is('deleted_at', null).eq('status', 'active')
  const ids = (live || []).map(p => p.id)

  const [orders, overdue, reports] = await Promise.all([
    sb.from('menu_orders').select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'ordered']).is('cleared_at', null),
    ids.length
      ? sb.from('tasks').select('id', { count: 'exact', head: true })
          .eq('status', 'open').lt('due_date', today).in('project_id', ids)
      : Promise.resolve({ count: 0 }),
    sb.from('weekly_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
  ])

  return NextResponse.json({
    counts: {
      '/admin/orders': orders.count ?? 0,
      '/admin/ops': overdue.count ?? 0,
      '/admin/reports': reports.count ?? 0,
    },
  })
}
