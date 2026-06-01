import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/dashboard
//
// Single round-trip aggregator that powers the data-centre dashboard.
// Each block is independent — if one table is missing we degrade to []
// for that block instead of 500-ing the whole page.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Promise that never rejects — wraps a supabase query so Promise.all is safe.
// Extracts data and swallows errors; if the table doesn't exist or the query
// fails, returns an empty array of the requested row type.
function safeData<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  return Promise.resolve(p)
    .then(r => r.data ?? [])
    .catch(() => [])
}

interface PrefRow { member_no: string; ps_t: number | string; s0: number; needs_revalidation: string }
interface MemberRow {
  member_no: string; full_name: string; tier: string; status: string;
  birthday: string | null; join_date: string | null;
}
interface ProspectRow { stage: string; source_channel: string | null; referred_by_name: string | null; referred_by_member_no: string | null; created_at: string; archived_at: string | null }
interface SigningInv { id: string; status: string; created_at: string }
interface ComplaintRow { severity: number; status: string }
interface LockerRow { status: string; member_no: string | null }
interface LockerContentsRow { fill_pct: number }
interface WhiskyRow { id: string; in_stock: boolean; region: string | null }
interface CardTxRow { kind: string; amount_vnd: number; created_at: string; member_number: string }
interface CardRow { member_number: string; credit_vnd: number }
interface ProspectActivityRow {
  id: string; prospect_id: string; actor: string | null; event_type: string;
  from_value: string | null; to_value: string | null; created_at: string;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const d7  = new Date(now.getTime() - 7  * 86400000).toISOString()
  const d365 = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10)

  const [
    members, profiles, prospects, invitations, complaints,
    lockers, contents, whiskies, cardTx, cards,
    activity, prefScores, stats,
  ] = await Promise.all([
    safeData<MemberRow>(sb.from('members').select('member_no, full_name, tier, status, birthday, join_date')),
    safeData<{ id: string; is_admin: boolean }>(sb.from('profiles').select('id, is_admin').eq('is_admin', true)),
    safeData<ProspectRow>(sb.from('prospects').select('stage, source_channel, referred_by_name, referred_by_member_no, created_at, archived_at')),
    safeData<SigningInv>(sb.from('signing_invitations').select('id, status, created_at')),
    safeData<ComplaintRow>(sb.from('complaints').select('severity, status')),
    safeData<LockerRow>(sb.from('lockers').select('status, member_no')),
    safeData<LockerContentsRow>(sb.from('locker_contents').select('fill_pct')),
    safeData<WhiskyRow>(sb.from('whiskies').select('id, in_stock, region')),
    safeData<CardTxRow>(sb.from('card_transactions').select('kind, amount_vnd, created_at, member_number').gte('created_at', d7)),
    safeData<CardRow>(sb.from('member_cards').select('member_number, credit_vnd')),
    safeData<ProspectActivityRow>(sb.from('prospect_activity').select('id, prospect_id, actor, event_type, from_value, to_value, created_at').order('created_at', { ascending: false }).limit(12)),
    safeData<PrefRow>(sb.from('preference_scores').select('member_no, ps_t, s0, needs_revalidation')),
    safeData<{ member_no: string; last_visit: string | null; days_since_visit: number | null; total_visits: number }>(sb.from('member_stats').select('member_no, last_visit, days_since_visit, total_visits')),
  ])

  const adminCount = profiles.length

  // ── KPI tiles ───────────────────────────────────────────────────────
  const activeMembers = members.filter(m => m.status === 'Active').length
  const activeMembers30dDelta = members.filter(m => m.status === 'Active' && m.join_date && m.join_date >= d30).length

  const pipelineCount = prospects.filter(p => p.archived_at == null && p.stage !== 'Onboarded' && !['Declined', 'Withdrawn'].includes(p.stage)).length
  const prospectsLastWeek = prospects.filter(p => p.created_at >= d7).length

  const pendingInvitations = invitations.filter(i => i.status === 'pending')
  const pendingSignatures = pendingInvitations.length
  const oldestPending = pendingInvitations
    .map(i => Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000))
    .sort((a, b) => b - a)[0] ?? null

  const openComplaints = complaints.filter(c => ['open', 'acknowledged'].includes(c.status))
  const avgSeverity = openComplaints.length
    ? Math.round((openComplaints.reduce((s, c) => s + c.severity, 0) / openComplaints.length) * 10) / 10
    : 0

  const lockerTotal = lockers.length
  const lockerOccupied = lockers.filter(l => l.status === 'occupied').length
  const lockerUtilization = lockerTotal ? Math.round((lockerOccupied / lockerTotal) * 100) : 0
  const bottleCount = contents.length

  const whiskyInStock = whiskies.filter(w => w.in_stock).length
  const whiskyOutOfStock = whiskies.length - whiskyInStock

  // ── Member tier donut ──────────────────────────────────────────────
  const tierOrder = ['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']
  const tierCounts = tierOrder.map(t => ({
    tier: t,
    count: members.filter(m => m.tier === t && m.status === 'Active').length,
  }))
  const otherTier = members.filter(m => m.status === 'Active' && !tierOrder.includes(m.tier)).length
  if (otherTier) tierCounts.push({ tier: 'Other', count: otherTier })

  // ── PS(t) health distribution (per member, mean of active prefs) ────
  const psSumByMember = new Map<string, { sum: number; n: number; revFlags: number }>()
  for (const p of prefScores) {
    const v = Number(p.ps_t)
    if (!Number.isFinite(v)) continue
    const cur = psSumByMember.get(p.member_no) || { sum: 0, n: 0, revFlags: 0 }
    cur.sum += v
    cur.n += 1
    if (p.needs_revalidation === 'true' || p.needs_revalidation === 't') cur.revFlags += 1
    psSumByMember.set(p.member_no, cur)
  }
  const psBuckets = { strong: 0, healthy: 0, drift: 0, decay: 0, lapsed: 0, none: 0 }
  for (const m of members.filter(x => x.status === 'Active')) {
    const agg = psSumByMember.get(m.member_no)
    if (!agg || agg.n === 0) { psBuckets.none += 1; continue }
    const avg = agg.sum / agg.n
    if (avg >= 4)   psBuckets.strong  += 1
    else if (avg >= 3) psBuckets.healthy += 1
    else if (avg >= 2) psBuckets.drift   += 1
    else if (avg >= 1) psBuckets.decay   += 1
    else               psBuckets.lapsed  += 1
  }

  // ── Joins over 12 months ───────────────────────────────────────────
  const joinsBucket = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    joinsBucket.set(key, 0)
  }
  for (const m of members) {
    if (!m.join_date) continue
    if (m.join_date < d365) continue
    const key = m.join_date.slice(0, 7)
    if (joinsBucket.has(key)) joinsBucket.set(key, (joinsBucket.get(key) || 0) + 1)
  }
  const joins12m = Array.from(joinsBucket.entries()).map(([month, count]) => ({ month, count }))

  // ── Pipeline funnel by stage ───────────────────────────────────────
  const stageOrder = ['Lead', 'Initial Contact', 'Interview Scheduled', 'Interview Complete', 'Application Received', 'Onboarded']
  const liveProspects = prospects.filter(p => p.archived_at == null)
  const stageCounts = stageOrder.map(s => ({ stage: s, count: liveProspects.filter(p => p.stage === s).length }))
  const lead = stageCounts[0].count
  const onboarded = stageCounts[5].count
  const overallConversion = (lead + onboarded) ? Math.round((onboarded / (lead + onboarded)) * 100) : 0

  // ── Pipeline source attribution ────────────────────────────────────
  const sourceOrder = ['Referral', 'Direct Approach', 'Event']
  const sourceCounts = sourceOrder.map(s => ({ source: s, count: liveProspects.filter(p => p.source_channel === s).length }))
  const unknownSource = liveProspects.filter(p => !sourceOrder.includes(p.source_channel || '')).length
  if (unknownSource) sourceCounts.push({ source: 'Unknown', count: unknownSource })

  // ── Referrer leaderboard (top 5 referring members or names) ────────
  const referrerTally = new Map<string, number>()
  for (const p of liveProspects) {
    const key = p.referred_by_member_no || p.referred_by_name
    if (!key) continue
    referrerTally.set(key, (referrerTally.get(key) || 0) + 1)
  }
  const referrers = Array.from(referrerTally.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── Lapsed radar ───────────────────────────────────────────────────
  const statByMember = new Map(stats.map(s => [s.member_no, s] as const))
  const lapsedRows = members
    .filter(m => m.status === 'Active')
    .map(m => statByMember.get(m.member_no)?.days_since_visit)
    .filter((d): d is number => typeof d === 'number')
  const lapsed = {
    b30: lapsedRows.filter(d => d >= 30 && d < 60).length,
    b60: lapsedRows.filter(d => d >= 60 && d < 90).length,
    b90: lapsedRows.filter(d => d >= 90).length,
  }

  // ── This week's touchpoints (birthdays + anniversaries) ────────────
  function daysUntilMMDD(mmdd: string): number {
    const [mm, dd] = mmdd.split('-').map(Number)
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let target = new Date(now.getFullYear(), mm - 1, dd)
    if (target < t) target = new Date(now.getFullYear() + 1, mm - 1, dd)
    return Math.round((target.getTime() - t.getTime()) / 86400000)
  }
  const thisWeek: Array<{ kind: 'birthday' | 'anniversary'; member_no: string; name: string; days: number; years?: number }> = []
  for (const m of members.filter(m => m.status === 'Active')) {
    if (m.birthday && m.birthday.length >= 10) {
      const d = daysUntilMMDD(m.birthday.slice(5, 10))
      if (d <= 7) thisWeek.push({ kind: 'birthday', member_no: m.member_no, name: m.full_name, days: d })
    }
    if (m.join_date && m.join_date.length >= 10) {
      const d = daysUntilMMDD(m.join_date.slice(5, 10))
      if (d <= 7) {
        const ann = new Date()
        ann.setDate(ann.getDate() + d)
        const years = ann.getFullYear() - Number(m.join_date.slice(0, 4))
        if (years >= 1) thisWeek.push({ kind: 'anniversary', member_no: m.member_no, name: m.full_name, days: d, years })
      }
    }
  }
  thisWeek.sort((a, b) => a.days - b.days)

  // ── Bottle fill distribution ───────────────────────────────────────
  const fillDist = [
    { bucket: '0–25',  count: contents.filter(c => c.fill_pct <= 25).length },
    { bucket: '26–50', count: contents.filter(c => c.fill_pct > 25 && c.fill_pct <= 50).length },
    { bucket: '51–75', count: contents.filter(c => c.fill_pct > 50 && c.fill_pct <= 75).length },
    { bucket: '76–100',count: contents.filter(c => c.fill_pct > 75).length },
  ]

  // ── Whisky inventory by region ─────────────────────────────────────
  const regionTally = new Map<string, number>()
  for (const w of whiskies) {
    if (!w.in_stock) continue
    const key = w.region || 'Unknown'
    regionTally.set(key, (regionTally.get(key) || 0) + 1)
  }
  const whiskyByRegion = Array.from(regionTally.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // ── Card volume — last 7 days ──────────────────────────────────────
  const cardDays = new Map<string, { topups: number; charges: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
    cardDays.set(d, { topups: 0, charges: 0 })
  }
  for (const t of cardTx) {
    const d = t.created_at.slice(0, 10)
    if (!cardDays.has(d)) continue
    const bucket = cardDays.get(d)!
    if (t.kind === 'topup' || (t.kind === 'adjust' && t.amount_vnd > 0)) bucket.topups += Number(t.amount_vnd)
    if (t.kind === 'charge' || (t.kind === 'adjust' && t.amount_vnd < 0)) bucket.charges += Math.abs(Number(t.amount_vnd))
  }
  const cardVolume7d = Array.from(cardDays.entries()).map(([day, v]) => ({ day, topups: v.topups, charges: v.charges }))

  // ── Top-credited cards (live balance) ──────────────────────────────
  const topCards = [...cards]
    .filter(c => c.credit_vnd > 0)
    .sort((a, b) => b.credit_vnd - a.credit_vnd)
    .slice(0, 6)
    .map(c => {
      const member = members.find(m => m.member_no === c.member_number)
      return { member_no: c.member_number, full_name: member?.full_name || c.member_number, credit_vnd: c.credit_vnd }
    })

  // ── Prospect intake sparkline — last 12 weeks ──────────────────────
  const prospectWeeks = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 86400000)
    const key = d.toISOString().slice(0, 10)
    prospectWeeks.set(key, 0)
  }
  const weekKeys = Array.from(prospectWeeks.keys())
  for (const p of prospects) {
    for (let i = weekKeys.length - 1; i >= 0; i--) {
      if (p.created_at.slice(0, 10) >= weekKeys[i]) {
        prospectWeeks.set(weekKeys[i], (prospectWeeks.get(weekKeys[i]) || 0) + 1)
        break
      }
    }
  }
  const prospectsSpark = Array.from(prospectWeeks.values())

  // ── Active members spark (cumulative active count over last 12 weeks)
  const memberSpark: number[] = []
  for (let i = 11; i >= 0; i--) {
    const cutoff = new Date(now.getTime() - i * 7 * 86400000).toISOString().slice(0, 10)
    memberSpark.push(members.filter(m => m.status === 'Active' && m.join_date && m.join_date <= cutoff).length)
  }

  return NextResponse.json({
    kpis: {
      activeMembers,
      activeMembers30dDelta,
      pipelineCount,
      prospectsLastWeek,
      pendingSignatures,
      oldestPending,
      openComplaints: openComplaints.length,
      avgSeverity,
      lockerUtilization,
      lockerOccupied,
      lockerTotal,
      bottleCount,
      whiskyInStock,
      whiskyOutOfStock,
      adminCount,
    },
    sparklines: {
      members: memberSpark,
      prospects: prospectsSpark,
    },
    memberTiers: tierCounts,
    psHealth: psBuckets,
    joins12m,
    pipelineFunnel: { stages: stageCounts, overallConversion },
    pipelineSources: sourceCounts,
    referrers,
    lapsed,
    thisWeek: thisWeek.slice(0, 8),
    activity,
    bottleFillDist: fillDist,
    whiskyByRegion,
    cardVolume7d,
    topCards,
    timestamp: new Date().toISOString(),
  })
}
