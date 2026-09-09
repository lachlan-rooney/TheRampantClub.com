import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { renderDocument } from '@/lib/documents/render'

// What this member still has to read, and the documents themselves.
//
// Nothing here knows the names of any documents — the list comes from
// terms_documents via my_consent_state(), so publishing Schedule Part 1 or 2 later
// is a row, not a deploy.

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const { data: state, error } = await sb.rpc('my_consent_state')
  if (error) return NextResponse.json({ error: 'Could not read your documents.' }, { status: 500 })

  const rows = (state || []) as Array<Record<string, unknown>>
  const wanted = rows.filter(r => r.current_version_id)
  const { data: versions } = wanted.length
    ? await sb.from('terms_versions')
        .select('id, doc_key, version, effective_date, title_en, title_vn, body, body_vn')
        .in('id', wanted.map(r => r.current_version_id as string))
    : { data: [] }

  const byId = new Map((versions || []).map(v => [v.id, v]))
  return NextResponse.json({
    documents: rows.map(r => {
      const v = byId.get(r.current_version_id as string)
      return {
        doc_key: r.doc_key, name_en: r.name_en, name_vn: r.name_vn,
        required: r.required, satisfied_by: r.satisfied_by,
        needs_action: r.needs_action, granted: r.granted,
        version: v?.version ?? null, effective_date: v?.effective_date ?? null,
        title_en: v?.title_en ?? null, title_vn: v?.title_vn ?? null,
        // Rendered server-side so the browser never handles the raw body.
        html_en: v ? renderDocument(v.body) : null,
        html_vn: v ? renderDocument(v.body_vn) : null,
        markdown_en: v?.body ?? null, markdown_vn: v?.body_vn ?? null,   // for download
      }
    }),
  })
}
