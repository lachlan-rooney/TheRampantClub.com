import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { signatureCutoffIso } from '@/lib/guests'

// GET /api/admin/guest-visits/[id]/signature → the PNG, while it still exists.
//
// THE SEVEN-DAY RULE IS ENFORCED HERE, ON READ, not only by the cron. The query
// itself refuses a row signed more than 7 days ago, so a late or failed purge
// changes nothing a viewer can see: past the cutoff there is no image, full stop.
// Served as bytes (not a data URL in the list JSON) so the attendance list stays
// small, and with no-store so no browser keeps a copy past its week.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const PREFIX = 'data:image/png;base64,'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data } = await svc().from('guest_visits')
    .select('signature_data_url')
    .eq('id', id)
    .gt('signed_in_at', signatureCutoffIso())
    .is('signature_deleted_at', null)
    .maybeSingle()
  const url = data?.signature_data_url as string | null | undefined
  if (!url || !url.startsWith(PREFIX)) return NextResponse.json({ error: 'No signature — deleted after 7 days, or never taken.' }, { status: 404 })
  return new NextResponse(Buffer.from(url.slice(PREFIX.length), 'base64'), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' },
  })
}
