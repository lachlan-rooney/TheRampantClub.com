import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/entries/attachment/[id]
//
// THE ONE PLACE THAT DECIDES WHO MAY SEE A FILE. The bucket is private, so an
// object is unreachable except through here, and here checks the ENTRY'S
// visibility before minting a short-lived signed URL.
//
// This is why entry_attachments has no member-facing RLS policy: a read policy
// would be a second, weaker answer to the same question, and the two would drift.
//
// A staff-only calendar entry's file is therefore not reachable by a member —
// not obscured, not unlinked: refused.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'entry-attachments'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const cookieSb = await createServerSupabaseClient()
  const { data: { user } } = await cookieSb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const sb = svc()
  const { data: row } = await sb.from('entry_attachments')
    .select('entity_type, entity_id, storage_path, mime, filename, verified_kind')
    .eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  const admin = profile?.is_admin === true

  if (!admin) {
    if (row.entity_type === 'calendar_entry') {
      // The gate. A staff-only entry is invisible to members by RLS, and its
      // file must be too — otherwise the attachment becomes the way round the
      // policy protecting the entry.
      const { data: entry } = await sb.from('calendar_entries')
        .select('visibility').eq('id', row.entity_id).maybeSingle()
      if (entry?.visibility !== 'member') return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    } else {
      // Fixtures are readable by any authenticated user (see db/fixtures.sql),
      // so a signed-in member may see the file; an unknown id may not.
      const { data: fx } = await sb.from('fixtures').select('id').eq('id', row.entity_id).maybeSingle()
      if (!fx) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
  }

  // A PDF is handed over as a FILE, never rendered inline. Two reasons, and the
  // first is not a preference: the site's CSP sets object-src 'none', so an
  // inline PDF embed never fires anywhere on this site. The second is that a
  // download cannot execute in a page context.
  const download = row.verified_kind === 'pdf' ? (row.filename || 'attachment.pdf') : undefined

  const { data: signed, error } = await sb.storage.from(BUCKET)
    .createSignedUrl(row.storage_path, 300, download ? { download } : undefined)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: 'Could not open the file.' }, { status: 500 })

  // Short-lived (5 min) and on the STORAGE origin, which has no access to an app
  // session — so a leaked link is neither durable nor privileged.
  const res = NextResponse.redirect(signed.signedUrl, 307)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
