import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Publish a document version. This is the ONLY way a document body enters the
// system — nobody should be inserting rows by hand, and no document text lives in
// the app. Runs as the admin's session so the DB's own is_admin_uid() gates it.
//
// A published version is IMMUTABLE (trigger + insert-only policy), so a correction
// is a new version, never an edit. That is what makes a member's recorded
// agreement mean something: it points at a body that cannot have moved.

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const sb = await createServerSupabaseClient()
  const [{ data: docs }, { data: versions }] = await Promise.all([
    sb.from('terms_documents').select('*').order('sort'),
    sb.from('terms_versions').select('id, doc_key, version, effective_date, title_en, created_at').order('effective_date', { ascending: false }),
  ])
  return NextResponse.json({ documents: docs || [], versions: versions || [] })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  for (const k of ['doc_key', 'version', 'effective_date', 'body']) {
    if (typeof b[k] !== 'string' || !b[k].trim()) {
      return NextResponse.json({ error: `${k} is required.` }, { status: 400 })
    }
  }
  const sb = await createServerSupabaseClient()
  const { data, error } = await sb.rpc('publish_terms_version', {
    p_doc_key: b.doc_key, p_version: b.version, p_effective: b.effective_date,
    p_title_en: b.title_en ?? null, p_title_vn: b.title_vn ?? null,
    p_body: b.body, p_body_vn: b.body_vn ?? null,
  })
  if (error) {
    return NextResponse.json({
      error: /unknown document/i.test(error.message)
        ? 'That document is not registered. Add it to terms_documents first.'
        : /duplicate key/i.test(error.message)
          ? 'That version already exists. Publish a new version number.'
          : 'Could not publish.',
    }, { status: 400 })
  }
  return NextResponse.json({ ok: true, id: data })
}
