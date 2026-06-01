import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET   /api/admin/tier-budgets        — list every tier with dues + gifting %
// PATCH /api/admin/tier-budgets/[tier]  — handled in the [tier] route

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const { data, error } = await sb.from('tier_budgets').select('*').order('annual_dues_vnd', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: data || [] })
}

export async function POST(req: NextRequest) {
  // Allow creating a new tier row from the page so the founder can add a
  // future tier without a migration. Existing rows refuse via the
  // upsert's conflict — use PATCH on /[tier] for updates.
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const tier = typeof body.tier === 'string' ? body.tier.trim().slice(0, 20) : ''
  if (!tier) return NextResponse.json({ error: 'tier required' }, { status: 400 })

  const annual_dues_vnd = Number(body.annual_dues_vnd)
  if (!Number.isFinite(annual_dues_vnd) || annual_dues_vnd < 0) {
    return NextResponse.json({ error: 'annual_dues_vnd must be a non-negative number' }, { status: 400 })
  }
  const gifting_pct = Number(body.gifting_pct ?? 10)
  if (!Number.isFinite(gifting_pct) || gifting_pct < 0 || gifting_pct > 100) {
    return NextResponse.json({ error: 'gifting_pct must be 0..100' }, { status: 400 })
  }

  const sb = svc()
  const { error } = await sb.from('tier_budgets').insert({
    tier,
    annual_dues_vnd: Math.round(annual_dues_vnd),
    gifting_pct,
    notes: body.notes ? String(body.notes).slice(0, 1000) : null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
