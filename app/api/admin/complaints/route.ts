import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/complaints           — list (?status= optional)
// POST /api/admin/complaints           — log new complaint

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const sb = svc()
  let q = sb.from('complaints').select('*').order('reported_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ complaints: data || [] })
}

const CATEGORIES = ['service', 'product', 'facility', 'billing', 'other']

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const reported_by = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const summary = String(body.summary || '').trim()
  if (!summary) return NextResponse.json({ error: 'summary required' }, { status: 400 })

  const severityRaw = Number(body.severity)
  const severity = Number.isInteger(severityRaw) && severityRaw >= 1 && severityRaw <= 5 ? severityRaw : 2

  const row: Record<string, unknown> = {
    summary: summary.slice(0, 500),
    severity,
    category: typeof body.category === 'string' && CATEGORIES.includes(body.category) ? body.category : null,
    details: body.details ? String(body.details).slice(0, 4000) : null,
    member_no: body.member_no ? String(body.member_no).slice(0, 12) : null,
    member_name: body.member_name ? String(body.member_name).slice(0, 200) : null,
    reported_by,
  }

  const sb = svc()
  const { data, error } = await sb.from('complaints').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, complaint: data })
}
