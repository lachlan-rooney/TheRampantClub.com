import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// PATCH  /api/admin/tier-budgets/[tier]   — update dues / gifting % / notes
// DELETE /api/admin/tier-budgets/[tier]   — remove a custom tier (keeps gifts intact)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ tier: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tier } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('annual_dues_vnd' in body) {
    const n = Number(body.annual_dues_vnd)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'annual_dues_vnd must be non-negative' }, { status: 400 })
    patch.annual_dues_vnd = Math.round(n)
  }
  if ('gifting_pct' in body) {
    const n = Number(body.gifting_pct)
    if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: 'gifting_pct must be 0..100' }, { status: 400 })
    patch.gifting_pct = n
  }
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 1000) || null

  const sb = svc()
  const { data, error } = await sb.from('tier_budgets').update(patch).eq('tier', tier).select('tier')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'tier not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ tier: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tier } = await ctx.params
  const sb = svc()
  const { error } = await sb.from('tier_budgets').delete().eq('tier', tier)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
