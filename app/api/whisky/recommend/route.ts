import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { recommend, type StockInfo } from '@/lib/whisky/recommend'
import type { IndexRow, SetSpokes } from '@/lib/whisky/flavour-match'

// POST /api/whisky/recommend — member-delight-first whisky recs.
// Body (one of):
//   { member_no }  — staff: recs for that member's taste profile (ADMIN only)
//   { set }        — ad-hoc: recs for an expressed Finder shape {slug:level}
//   {}             — member self: recs for the caller's own taste profile
// Returns { recs, bestIsClose, profileEmpty, sources }. profileEmpty=true when
// the target profile has no data → the surface should ask for an expressed shape.

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  let body: { member_no?: unknown; set?: unknown; limit?: unknown }
  try { body = await req.json() } catch { body = {} }

  const sb = svc()
  let target: SetSpokes = {}
  let sources: unknown = null
  let resolvedMember: string | null = null

  if (body.set && typeof body.set === 'object') {
    // Ad-hoc expressed shape (Finder tap). Must be logged in.
    const sbCookie = await createServerSupabaseClient()
    const { data: { user } } = await sbCookie.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    for (const [k, v] of Object.entries(body.set as Record<string, unknown>)) {
      const n = Number(v); if (Number.isFinite(n) && n > 0) target[k] = n
    }
  } else {
    // Taste-profile path. Explicit member_no ⇒ admin; otherwise the caller's own.
    if (typeof body.member_no === 'string' && body.member_no) {
      if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      resolvedMember = body.member_no
    } else {
      const sbCookie = await createServerSupabaseClient()
      const { data: { user } } = await sbCookie.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { data: prof } = await sb.from('profiles').select('member_number').eq('id', user.id).maybeSingle()
      if (prof?.member_number == null) return NextResponse.json({ recs: [], bestIsClose: false, profileEmpty: true, reason: 'no_linked_member' })
      resolvedMember = 'TRC-M' + String(prof.member_number).padStart(3, '0')
    }
    const { data: tp } = await sb.from('member_taste_profiles').select('vector, sources').eq('member_no', resolvedMember).maybeSingle()
    if (tp?.vector) for (const [k, v] of Object.entries(tp.vector as Record<string, number>)) if (v > 0) target[k] = v
    sources = tp?.sources ?? null
  }

  if (Object.keys(target).length === 0) {
    return NextResponse.json({ recs: [], bestIsClose: false, profileEmpty: true, member_no: resolvedMember, sources })
  }

  // Build the mapped index + stock (known = a real fill reading exists).
  const [{ data: ints }, { data: ws }] = await Promise.all([
    sb.from('whisky_flavour_intensities').select('whisky_id,category_slug,intensity'),
    sb.from('whiskies').select('id,name,in_stock,current_fill_pct,last_fill_updated_at'),
  ])
  const spokesByW: Record<string, Record<string, number>> = {}
  for (const r of (ints || []) as { whisky_id: string; category_slug: string; intensity: number }[]) {
    ;(spokesByW[r.whisky_id] = spokesByW[r.whisky_id] || {})[r.category_slug] = r.intensity
  }
  const stockById = new Map<string, StockInfo>()
  const seen = new Set<string>()
  const index: IndexRow[] = []
  for (const w of (ws || []) as { id: string; name: string; in_stock: boolean; current_fill_pct: number | null; last_fill_updated_at: string | null }[]) {
    if (!spokesByW[w.id] || seen.has(w.name)) continue           // mapped only, dedup by name
    seen.add(w.name)
    index.push({ id: w.id, name: w.name, in_stock: w.in_stock, spokes: spokesByW[w.id] })
    stockById.set(w.id, { current_fill_pct: w.current_fill_pct, known: w.last_fill_updated_at != null })
  }

  const limit = Number.isFinite(Number(body.limit)) ? Math.max(1, Math.min(10, Number(body.limit))) : 5
  const { recs, bestIsClose } = recommend(target, index, stockById, { limit })
  return NextResponse.json({ recs, bestIsClose, profileEmpty: false, member_no: resolvedMember, target, sources })
}
