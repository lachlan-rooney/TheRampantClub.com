import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderDocument } from '@/lib/documents/render'

// THE CLUB'S PUBLIC LEGAL DOCUMENTS, FROM THE REGISTER.
//
// /privacy was 64 lines of English hardcoded in a page, headed "March 2026".
// The real Privacy Notice — "What We Keep, and Why", v1.1, 9,507 characters of
// English and 10,895 of Vietnamese — has been sitting in terms_versions since
// 9 September, and it is the one members actually consented to. So the public
// page was showing a document the club had replaced, in a language half its
// members do not read, while the true one was one query away.
//
// Reading it from the register also means the page follows the register: when
// the notice is next versioned, the public page is already correct.
//
// ── WHY THIS IS PUBLIC, AND WHAT CANNOT BE ────────────────────────────────
// A privacy notice has to be readable without signing in; that is most of its
// job. PUBLIC is an allow-list of one — the membership Terms are a document a
// prospective member is walked through during signing, not a page to leave open
// on the internet, and `marketing` is a consent text, not a notice.
//
// ── AND WHAT IS NOT SELECTED ──────────────────────────────────────────────
// Not body_url: it can hold a storage path, and a path on a public response is
// how a bucket gets probed. Not created_by. Not the version row's id. Only the
// words and the date they took effect. The signing RLS audit was exactly this
// mistake made the other way about — a route that returned more of a row than
// the surface needed.
//
// Service role, because terms_versions is admin-only under RLS and a published
// notice is not a secret. The allow-list above is what keeps that honest: this
// route can only ever read one named document.

export const dynamic = 'force-dynamic'

/** Documents the public may read. Anything not named here is 404, not 403 — a
 *  404 does not confirm that the other doc_keys exist. */
const PUBLIC = new Set(['privacy'])

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export async function GET(_req: Request, { params }: { params: Promise<{ doc_key: string }> }) {
  const { doc_key } = await params
  if (!PUBLIC.has(doc_key)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const a = svc()

  // THE CURRENT VERSION IS THE REGISTER'S ANSWER, not this route's. The same
  // function the members' surfaces and the signing flow use, so the public page
  // cannot drift onto a different version from the one being signed.
  const { data: currentId } = await a.rpc('current_terms_version', { p_doc_key: doc_key })

  const q = a.from('terms_versions')
    .select('doc_key, version, effective_date, title_en, title_vn, body, body_vn')
  const { data: row } = currentId
    ? await q.eq('id', currentId).maybeSingle()
    // No row in terms_documents to name a current version: fall back to the
    // highest effective_date for this key rather than showing nothing. A notice
    // that exists must be readable.
    : await q.eq('doc_key', doc_key).order('effective_date', { ascending: false })
        .order('version', { ascending: false }).limit(1).maybeSingle()

  if (!row?.body) return NextResponse.json({ error: 'Not published.' }, { status: 404 })

  return NextResponse.json({
    doc_key: row.doc_key,
    version: row.version,
    effective_date: row.effective_date,
    title_en: row.title_en,
    title_vn: row.title_vn,
    // Markdown rendered server-side with raw HTML OFF (lib/documents/render),
    // the same renderer the members' copy goes through. A stored <script> is
    // escaped to text, so there is no sanitiser to get wrong.
    html_en: renderDocument(row.body),
    // THE FALLBACK RULE, as everywhere else: a missing Vietnamese body falls
    // back to English, never to a blank page.
    html_vn: renderDocument(row.body_vn || row.body),
    has_vn: !!row.body_vn,
  }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } })
}
