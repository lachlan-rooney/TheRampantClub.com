import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'

// GET /api/admin/mx-daily
//
// Aggregator for the Member Experience Manager's morning check-in. Returns
// the four panels in one call so the page renders in a single round-trip:
//   - tonight: members with a booking later today (placeholder until we wire
//     a real bookings source — for now, returns []).
//   - birthdays: members with a birthday in the next 7 days.
//   - lapsed: Active members whose last visit was > 30 days ago, bucketed.
//   - complaints: open or acknowledged complaints in the last 14 days.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function daysFromTodayUntilMMDD(mmdd: string): number {
  // mmdd is 'MM-DD'. Returns days until next occurrence in current/next year.
  const today = new Date()
  const [mm, dd] = mmdd.split('-').map(Number)
  const thisYear = new Date(today.getFullYear(), mm - 1, dd)
  const target = thisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    ? new Date(today.getFullYear() + 1, mm - 1, dd)
    : thisYear
  return Math.round((target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = svc()
  // Complaints is optional — if the migration hasn't been applied yet, treat
  // the queue as empty. Wrap in a catch so the supabase promise chain can't
  // reject Promise.all and 500 the whole page.
  const complaintsQuery = sb
    .from('complaints')
    .select('*')
    .in('status', ['open', 'acknowledged'])
    .order('reported_at', { ascending: false })
    .limit(50)
    .then(r => r, () => ({ data: [] as Record<string, unknown>[], error: null }))

  // Latest closing checklist for the handover panel. Same defensive
  // wrap — if shift_checklists hasn't been migrated yet, this returns
  // empty rather than 500'ing the dashboard.
  const lastClosingQuery = sb
    .from('shift_checklists')
    .select('shift_date, items, free_notes, submitted_by, submitted_at, handover_acknowledged_by, handover_acknowledged_at')
    .eq('kind', 'closing')
    .order('shift_date', { ascending: false })
    .limit(1)
    .then(r => r, () => ({ data: [] as Record<string, unknown>[], error: null }))

  // Missed-seal alerts — surfaces any shift day in the last 7 (excluding
  // today, whose evening shift hasn't happened yet) without a sealed
  // opening AND/OR closing sheet. Gives the morning team an immediate
  // "did we actually record last night?" signal on the dashboard.
  const todayVn = vnDateString()
  const todayDate = new Date(todayVn + 'T00:00:00+07:00')
  const window7Start = new Date(todayDate); window7Start.setDate(window7Start.getDate() - 7)
  const window7End   = new Date(todayDate); window7End.setDate(window7End.getDate() - 1)
  const sealedRangeQuery = sb
    .from('shift_checklists')
    .select('shift_date, kind, submitted_at')
    .gte('shift_date', vnDateString(window7Start))
    .lte('shift_date', vnDateString(window7End))
    .then(r => r, () => ({ data: [] as Record<string, unknown>[], error: null }))

  // Per-member gifting summary so the anniversary panel can show budget
  // used vs. available without N round-trips.
  const giftingSummaryQuery = sb.from('member_gifting_summary')
    .select('member_no, annual_budget_vnd, spent_vnd, gift_count, window_end')
    .then(r => r, () => ({ data: [] as Record<string, unknown>[], error: null }))

  const [
    { data: members }, { data: stats },
    complaintsResult, lastClosingResult, giftingResult, sealedRangeResult,
  ] = await Promise.all([
    sb.from('members').select('member_no, full_name, nickname, tier, status, birthday, join_date').eq('status', 'Active'),
    sb.from('member_stats').select('member_no, last_visit, days_since_visit, total_visits'),
    complaintsQuery,
    lastClosingQuery,
    giftingSummaryQuery,
    sealedRangeQuery,
  ])
  const complaints = complaintsResult.error ? [] : (complaintsResult.data || [])
  const lastClosing = lastClosingResult.error || !lastClosingResult.data?.length ? null : lastClosingResult.data[0]

  // Compute missed-seal alerts. The 7-day window ends YESTERDAY (today's
  // closing hasn't happened yet, so an empty today is not a miss). For
  // each date in the window, a kind is "missed" if either no row exists
  // OR the row exists but submitted_at is null (started but not sealed).
  type SealRow = { shift_date: string; kind: 'opening' | 'closing'; submitted_at: string | null }
  const sealedRows = (sealedRangeResult.error ? [] : (sealedRangeResult.data || [])) as SealRow[]
  const sealByDateKind = new Map<string, boolean>()
  for (const r of sealedRows) sealByDateKind.set(`${r.shift_date}-${r.kind}`, !!r.submitted_at)
  const missedSeals: { shift_date: string; missing: ('opening' | 'closing')[] }[] = []
  for (let i = 7; i >= 1; i--) {
    const d = new Date(todayDate); d.setDate(d.getDate() - i)
    const ds = vnDateString(d)
    const openingSealed = sealByDateKind.get(`${ds}-opening`) === true
    const closingSealed = sealByDateKind.get(`${ds}-closing`) === true
    const missing: ('opening' | 'closing')[] = []
    if (!openingSealed) missing.push('opening')
    if (!closingSealed) missing.push('closing')
    if (missing.length > 0) missedSeals.push({ shift_date: ds, missing })
  }
  const giftingByMember = new Map<string, { annual_budget_vnd: number; spent_vnd: number; gift_count: number }>()
  for (const r of (giftingResult.error ? [] : (giftingResult.data || []))) {
    const row = r as { member_no: string; annual_budget_vnd: number; spent_vnd: number; gift_count: number }
    giftingByMember.set(row.member_no, {
      annual_budget_vnd: Number(row.annual_budget_vnd || 0),
      spent_vnd: Number(row.spent_vnd || 0),
      gift_count: Number(row.gift_count || 0),
    })
  }

  const statByMember = new Map<string, { last_visit: string | null; days_since_visit: number | null; total_visits: number }>()
  for (const s of stats || []) {
    statByMember.set(s.member_no, {
      last_visit: s.last_visit,
      days_since_visit: s.days_since_visit,
      total_visits: s.total_visits,
    })
  }

  // Birthdays: next 7 days.
  const birthdays = (members || [])
    .filter(m => m.birthday)
    .map(m => {
      const date = String(m.birthday)
      const mmdd = date.length >= 10 ? date.slice(5, 10) : null
      if (!mmdd) return null
      const days = daysFromTodayUntilMMDD(mmdd)
      return { member_no: m.member_no, full_name: m.full_name, nickname: m.nickname, tier: m.tier, birthday: date, days_until: days }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.days_until <= 7)
    .sort((a, b) => a.days_until - b.days_until)

  // Anniversaries: members hitting a join-date anniversary in the next 7 days.
  const anniversaries = (members || [])
    .filter(m => m.join_date)
    .map(m => {
      const jd = String(m.join_date)
      const mmdd = jd.length >= 10 ? jd.slice(5, 10) : null
      if (!mmdd) return null
      const days = daysFromTodayUntilMMDD(mmdd)
      // Derive the anniversary's calendar year by adding `days` to today.
      const anniversaryDate = new Date()
      anniversaryDate.setHours(0, 0, 0, 0)
      anniversaryDate.setDate(anniversaryDate.getDate() + days)
      const years = anniversaryDate.getFullYear() - Number(jd.slice(0, 4))
      if (years < 1) return null
      const gifting = giftingByMember.get(m.member_no) || null
      return {
        member_no: m.member_no,
        full_name: m.full_name,
        nickname: m.nickname,
        tier: m.tier,
        join_date: jd,
        years,
        days_until: days,
        gifting: gifting ? {
          budget_vnd: gifting.annual_budget_vnd,
          spent_vnd:  gifting.spent_vnd,
          remaining_vnd: Math.max(0, gifting.annual_budget_vnd - gifting.spent_vnd),
          gift_count: gifting.gift_count,
        } : null,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.days_until <= 7)
    .sort((a, b) => a.days_until - b.days_until)

  // Lapsed members: bucketed 30 / 60 / 90+.
  const lapsedRaw = (members || [])
    .map(m => {
      const s = statByMember.get(m.member_no)
      const days = s?.days_since_visit ?? null
      if (days == null || days < 30) return null
      return {
        member_no: m.member_no,
        full_name: m.full_name,
        nickname: m.nickname,
        tier: m.tier,
        last_visit: s?.last_visit ?? null,
        days_since_visit: days,
        total_visits: s?.total_visits ?? 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.days_since_visit - a.days_since_visit)

  const lapsed = {
    bucket_30: lapsedRaw.filter(m => m.days_since_visit >= 30 && m.days_since_visit < 60),
    bucket_60: lapsedRaw.filter(m => m.days_since_visit >= 60 && m.days_since_visit < 90),
    bucket_90: lapsedRaw.filter(m => m.days_since_visit >= 90),
  }

  return NextResponse.json({
    birthdays,
    anniversaries,
    lapsed,
    complaints: complaints || [],
    last_closing: lastClosing || null,
    missed_seals: missedSeals,
    counts: {
      birthdays: birthdays.length,
      anniversaries: anniversaries.length,
      lapsed_total: lapsedRaw.length,
      complaints_open: (complaints || []).filter(c => c.status === 'open').length,
      missed_seals: missedSeals.length,
    },
  })
}
