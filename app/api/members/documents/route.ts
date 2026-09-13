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

  let rows = (state || []) as Array<Record<string, unknown>>

  // ── AN ACCOUNT WITH NO MEMBERSHIP LINK STILL GETS TO READ THE AGREEMENT ────
  // my_consent_state() is member-scoped on purpose: it returns NOTHING when the
  // profile has no member_no, because consent is recorded against a membership.
  // Every staff and admin account is in exactly that position — admin routes
  // never check for a member_no, so a staff account without one is the normal
  // case, not a fault.
  //
  // The effect was that /members/terms told all five of them "The agreement is
  // not published yet. Please ask the Membership Team." It IS published; they
  // are simply not members. A published document is not member-only reading.
  //
  // So when the state comes back empty, list the documents themselves, with
  // needs_action FALSE and granted NULL: readable, never actionable. Nothing
  // about the gate changes — middleware.ts calls my_consent_state() directly
  // and never reads this endpoint, so this cannot gate anyone.
  if (rows.length === 0) {
    const { data: docs } = await sb
      .from('terms_documents')
      .select('doc_key, name_en, name_vn, required, satisfied_by, sort')
      .order('sort')
    const ids = await Promise.all((docs || []).map(async d => {
      const { data } = await sb.rpc('current_terms_version', { p_doc_key: d.doc_key })
      return { ...d, current_version_id: data as string | null }
    }))
    rows = ids.map(d => ({
      doc_key: d.doc_key, name_en: d.name_en, name_vn: d.name_vn,
      required: d.required, satisfied_by: d.satisfied_by,
      current_version_id: d.current_version_id,
      needs_action: false, granted: null,
    }))
  }

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
