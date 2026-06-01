import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { OCCASIONS, CATEGORIES } from '@/lib/gifting'

// GET  /api/admin/gifts[?member_no&from&to&occasion&category]
// POST /api/admin/gifts  — create a gift entry
//
// The summary view (member_gifting_summary) is queried separately by the
// page; gifts here is the raw ledger.

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
  const memberNo = searchParams.get('member_no')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const occasion = searchParams.get('occasion')
  const category = searchParams.get('category')
  const limit    = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 100))

  const sb = svc()
  let q = sb.from('gifts').select('*').order('gift_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  if (memberNo) q = q.eq('member_no', memberNo)
  if (from)     q = q.gte('gift_date', from)
  if (to)       q = q.lte('gift_date', to)
  if (occasion) q = q.eq('occasion', occasion)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve member names for the ledger view.
  const list = data || []
  if (list.length === 0) return NextResponse.json({ gifts: [] })
  const memberNos = Array.from(new Set(list.map(g => g.member_no)))
  const { data: members } = await sb.from('members').select('member_no, full_name, tier').in('member_no', memberNos)
  const map = new Map((members || []).map(m => [m.member_no, m] as const))
  const enriched = list.map(g => ({ ...g, member: map.get(g.member_no) || null }))
  return NextResponse.json({ gifts: enriched })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const member_no = String(body.member_no || '').trim()
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const gift_date = String(body.gift_date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gift_date)) return NextResponse.json({ error: 'gift_date YYYY-MM-DD required' }, { status: 400 })

  const occasion = String(body.occasion || '')
  if (!(OCCASIONS as readonly string[]).includes(occasion)) return NextResponse.json({ error: 'invalid occasion' }, { status: 400 })

  const description = String(body.description || '').trim()
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const cost_vnd = Number(body.cost_vnd)
  if (!Number.isFinite(cost_vnd) || cost_vnd < 0) return NextResponse.json({ error: 'cost_vnd must be a non-negative number' }, { status: 400 })

  const category = typeof body.category === 'string' && (CATEGORIES as readonly string[]).includes(body.category)
    ? body.category : null

  const sb = svc()
  const { data: member } = await sb.from('members').select('member_no').eq('member_no', member_no).maybeSingle()
  if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })

  const { data, error } = await sb.from('gifts').insert({
    member_no,
    gift_date,
    occasion,
    category,
    description: description.slice(0, 2000),
    source: body.source ? String(body.source).slice(0, 200) : null,
    cost_vnd: Math.round(cost_vnd),
    expected_value: body.expected_value ? String(body.expected_value).slice(0, 2000) : null,
    given_by: actor,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    photo_url: body.photo_url ? String(body.photo_url).slice(0, 400) : null,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ gift: data })
}
