import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { resolveMemberRecipients } from '@/lib/newsletter/recipients'

// List newsletters + settings + the LIVE member recipient count (drives the
// "SEND-ALL-<count>" confirmation and the send-safety UI).
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const a = svc()
  const [{ data: newsletters }, { data: settings }] = await Promise.all([
    a.from('newsletters').select('id, period_start, period_end, subject, status, sent_at, recipient_count, token_view_count, updated_at').order('period_start', { ascending: false }),
    a.from('newsletter_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  const recipients = await resolveMemberRecipients(a, settings?.suppress || [])
  return NextResponse.json({ newsletters: newsletters || [], settings: settings || null, recipient_count: recipients.length })
}
