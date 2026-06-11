import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Your Whisky Journey — the member's OWN story over time, composed from real
// member-own data: the drams they've been poured (member_consumption) + the notes
// they've logged (tasting_notes), chronological; honest milestones; and palate
// DRIFT only when the timestamped data genuinely shows a trend. Member-safe fields
// only (the 0d pattern). Never another member's data. No fabrication — sparse →
// a warm invitation, not a barren page.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const FAMILY_WORD: Record<string, string> = {
  rich_dried_fruits: 'sherried', peated: 'peated', heavily_peated: 'heavily-peated', lightly_peated: 'lightly-peated',
  oily_coastal: 'coastal', spicy_sweet: 'spiced', spicy_dry: 'peppery', sweet_fruity_mellow: 'orchard-fruit',
  juicy_oak_vanilla: 'oak-and-vanilla', old_dignified: 'old-and-deep', light_delicate: 'delicate', young_spritely: 'bright', grain_rye: 'grain-and-rye',
}

interface Signal { date: string; fams: string[] }
// Honest drift: needs ≥6 timestamped flavour signals spanning ≥30 days. Split at the
// median date; the family whose share grew most (Δ>0.15) is the trend. Else null.
function computeDrift(signals: Signal[]): { family: string; word: string } | null {
  const s = signals.filter(x => x.date && x.fams.length).sort((a, b) => +new Date(a.date) - +new Date(b.date))
  if (s.length < 6) return null
  const spanDays = (+new Date(s[s.length - 1].date) - +new Date(s[0].date)) / 86_400_000
  if (spanDays < 30) return null
  const mid = Math.floor(s.length / 2)
  const share = (rows: Signal[]) => { const c: Record<string, number> = {}; let n = 0; for (const r of rows) for (const f of r.fams) { c[f] = (c[f] || 0) + 1; n++ }; for (const k in c) c[k] /= (n || 1); return c }
  const early = share(s.slice(0, mid)), recent = share(s.slice(mid))
  let best: { family: string; word: string } | null = null, bestDelta = 0.15
  for (const f of Object.keys(FAMILY_WORD)) { const d = (recent[f] || 0) - (early[f] || 0); if (d > bestDelta) { bestDelta = d; best = { family: f, word: FAMILY_WORD[f] } } }
  return best
}

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ has_history: false, timeline: [], milestones: [], drift: null, palate: {} })
  const mno = prof.member_no

  const [{ data: member }, { data: cons }, { data: notes }, { data: visits }, { data: tp }] = await Promise.all([
    sb.from('members').select('join_date').eq('member_no', mno).maybeSingle(),
    sb.from('member_consumption').select('whisky_id, bottle_name, consumed_on, whiskies(name, distillery)').eq('member_no', mno),
    sb.from('tasting_notes').select('whisky_id, note, flavour_tags, created_at, whiskies(name, distillery)').eq('author', user.id),
    sb.from('visits').select('visit_date, space').eq('member_no', mno),
    sb.from('member_taste_profiles').select('vector').eq('member_no', mno).maybeSingle(),
  ])
  const wname = (w: unknown) => Array.isArray(w) ? (w[0] as { name?: string })?.name : (w as { name?: string } | null)?.name
  const wdist = (w: unknown) => Array.isArray(w) ? (w[0] as { distillery?: string })?.distillery : (w as { distillery?: string } | null)?.distillery

  const timeline = [
    ...(cons || []).map(c => ({ kind: 'dram' as const, date: c.consumed_on, whisky_id: c.whisky_id, whisky_name: wname(c.whiskies) || c.bottle_name || 'a dram', distillery: wdist(c.whiskies) || null })),
    ...(notes || []).map(n => ({ kind: 'note' as const, date: n.created_at, whisky_id: n.whisky_id, whisky_name: wname(n.whiskies) || 'a whisky', distillery: wdist(n.whiskies) || null, note: n.note, flavour_tags: (n.flavour_tags || []) as string[] })),
  ].filter(t => t.date).sort((a, b) => +new Date(a.date) - +new Date(b.date))

  // distinct whiskies + top distillery (real, computed)
  const whiskyKeys = new Set<string>(), distCount: Record<string, number> = {}
  for (const t of timeline) { whiskyKeys.add(t.whisky_id || t.whisky_name); if (t.distillery) distCount[t.distillery] = (distCount[t.distillery] || 0) + 1 }
  const topDist = Object.entries(distCount).sort((a, b) => b[1] - a[1])[0]

  const milestones: { label: string; value: string }[] = []
  if (member?.join_date) {
    const months = Math.floor((Date.now() - +new Date(member.join_date)) / (30 * 86_400_000))
    milestones.push({ label: months >= 12 ? 'A member for' : 'With us', value: months >= 12 ? `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''}` : `${Math.max(1, months)} month${months === 1 ? '' : 's'}` })
  }
  if (whiskyKeys.size > 0) milestones.push({ label: 'Distinct drams met', value: String(whiskyKeys.size) })
  if (topDist && topDist[1] >= 2) milestones.push({ label: 'Most returned to', value: topDist[0] })
  if ((visits || []).length > 0) milestones.push({ label: 'Evenings at the club', value: String((visits || []).length) })

  const drift = computeDrift([
    ...(notes || []).map(n => ({ date: n.created_at, fams: (n.flavour_tags || []) as string[] })),
    // (consumption could add spoke-derived families here once the catalogue link is populated)
  ])

  return NextResponse.json({
    has_history: timeline.length > 0,
    timeline,
    milestones,
    drift: drift ? { ...drift, line: `Your ${drift.word} leaning has grown.` } : null,
    palate: (tp?.vector || {}) as Record<string, number>,
  })
}
