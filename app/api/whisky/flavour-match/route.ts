import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { matchWhiskies, type IndexRow, type SetSpokes } from '@/lib/whisky/flavour-match'

// POST /api/whisky/flavour-match  — Flavour Finder match.
// Body: { set: { <category_slug>: 1..4, … } }  (only the spokes the member raised)
// Returns the top 3 closest MAPPED whiskies + honest match strength. Pure math
// on the existing intensity spokes — no LLM, no per-search cost.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: { set?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const raw = (body.set && typeof body.set === 'object') ? body.set as Record<string, unknown> : {}
  const set: SetSpokes = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 1 && n <= 4) set[k] = Math.round(n)
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ matches: [], bestIsClose: false })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [{ data: ints }, { data: ws }] = await Promise.all([
    sb.from('whisky_flavour_intensities').select('whisky_id,category_slug,intensity'),
    sb.from('whiskies').select('id,name,in_stock'),
  ])
  const nameById = Object.fromEntries((ws || []).map(w => [w.id, { name: w.name as string, in_stock: w.in_stock as boolean }]))
  const byW: Record<string, Record<string, number>> = {}
  for (const r of (ints || []) as { whisky_id: string; category_slug: string; intensity: number }[]) {
    ;(byW[r.whisky_id] = byW[r.whisky_id] || {})[r.category_slug] = r.intensity
  }

  // Build the mapped index, deduped by name (the catalogue has a few duplicate
  // bottle rows — show each whisky once).
  const seen = new Set<string>()
  const index: IndexRow[] = []
  for (const [id, spokes] of Object.entries(byW)) {
    const meta = nameById[id]
    if (!meta || seen.has(meta.name)) continue
    seen.add(meta.name)
    index.push({ id, name: meta.name, in_stock: meta.in_stock, spokes })
  }

  const { matches, bestIsClose } = matchWhiskies(set, index, 3)
  return NextResponse.json({ matches, bestIsClose })
}
