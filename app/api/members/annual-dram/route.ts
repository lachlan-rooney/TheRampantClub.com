import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { paletteSignature } from '@/lib/whisky/palate-signature'

// The Annual Dram — the member's year at the club, composed from real member-own
// data. Always available as "your year so far" (year-to-date); near year-end it
// reframes as "your {year}". A single elegant, shareable card — nothing private,
// nothing of others, no cost. Sparse → "your story is just beginning", never empty.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no, display_name').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ ready: false })
  const mno = prof.member_no

  const now = new Date()
  const year = now.getUTCFullYear()
  const jan1 = `${year}-01-01`
  const framing = now.getUTCMonth() >= 10 ? 'year_end' : 'so_far'   // Nov/Dec → "your {year}"

  const [{ data: member }, { data: visits }, { data: cons }, { data: notes }, { data: tp }] = await Promise.all([
    sb.from('members').select('nickname, full_name').eq('member_no', mno).maybeSingle(),
    sb.from('visits').select('visit_date, space').eq('member_no', mno).gte('visit_date', jan1),
    sb.from('member_consumption').select('whisky_id, bottle_name, whiskies(name)').eq('member_no', mno).gte('consumed_on', jan1),
    sb.from('tasting_notes').select('note, created_at, whiskies(name)').eq('author', user.id).gte('created_at', jan1).eq('visibility', 'snug'),
    sb.from('member_taste_profiles').select('vector').eq('member_no', mno).maybeSingle(),
  ])
  const wname = (w: unknown) => Array.isArray(w) ? (w[0] as { name?: string })?.name : (w as { name?: string } | null)?.name

  // dram of the year — most-poured bottle this year (real consumption only)
  const dramCount: Record<string, number> = {}
  for (const c of cons || []) { const k = wname(c.whiskies) || c.bottle_name; if (k) dramCount[k] = (dramCount[k] || 0) + 1 }
  const topDram = Object.entries(dramCount).sort((a, b) => b[1] - a[1])[0]
  const distinct = new Set<string>()
  for (const c of cons || []) distinct.add(wname(c.whiskies) || c.bottle_name || '?')

  // a standout shared note (their own, snug — safe to surface on a shareable card)
  const standout = (notes || []).filter(n => (n.note || '').length > 20).sort((a, b) => (b.note?.length || 0) - (a.note?.length || 0))[0]

  const palette = paletteSignature((tp?.vector || {}) as Record<string, number>)
  const visitCount = (visits || []).length
  const ready = visitCount > 0 || (cons || []).length > 0 || (notes || []).length > 0

  return NextResponse.json({
    ready: true,
    sparse: !ready,
    framing, year,
    member_name: member?.nickname || member?.full_name || prof.display_name || 'Member',
    member_no: mno.replace(/^TRC-M?/i, ''),
    visits: visitCount,
    distinct_drams: distinct.size,
    top_dram: topDram ? topDram[0] : null,
    palette: palette === 'still taking shape' ? null : palette,
    standout_note: standout ? { note: standout.note, whisky: wname(standout.whiskies) || null } : null,
  })
}
