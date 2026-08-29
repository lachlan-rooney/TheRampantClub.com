import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { matchWhiskies, type IndexRow, type SetSpokes } from '@/lib/whisky/flavour-match'

// POST /api/whisky/flavour-match  — Flavour Finder match.
// Body: { set: { <category_slug>: 1..4, … }, in_stock_only?: boolean }
// Returns the top 3 closest MAPPED whiskies + honest match strength. Pure math
// on the existing intensity spokes — no LLM, no per-search cost.
// PUBLIC + unauthenticated (the members' finder and the public /cup kiosk both
// hit it), so it's IP rate-limited to blunt scripted abuse of the service-role
// query. Public surfaces pass in_stock_only to hard-filter to pourable bottles.

export const dynamic = 'force-dynamic'

// Simple in-memory sliding-window limiter (per instance) — enough to stop a
// tight loop hammering the unauthenticated endpoint. 40 matches / minute / IP.
const HITS = new Map<string, number[]>()
const LIMIT = { n: 40, ms: 60_000 }
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (HITS.get(ip) || []).filter(t => now - t < LIMIT.ms)
  arr.push(now); HITS.set(ip, arr)
  if (HITS.size > 5000) for (const [k, v] of HITS) if (!v.some(t => now - t < LIMIT.ms)) HITS.delete(k)
  return arr.length > LIMIT.n
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: { set?: unknown; in_stock_only?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const inStockOnly = body.in_stock_only === true
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
    if (inStockOnly && !meta.in_stock) continue      // public surfaces: only what the bar can pour
    seen.add(meta.name)
    index.push({ id, name: meta.name, in_stock: meta.in_stock, spokes })
  }

  const { matches, bestIsClose } = matchWhiskies(set, index, 3)
  return NextResponse.json({ matches, bestIsClose })
}
