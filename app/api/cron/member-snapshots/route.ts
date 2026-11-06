import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// MEMBER HEALTH SNAPSHOTS — one frozen row per member per week.
//
// TRC's analytics are all live-derived: member_stats recomputes from today's
// rows, preference_scores recomputes PS(t) on read. Nothing retains what any
// of it looked like last week, so no trajectory can be read — and every
// early-warning signal worth having is a trajectory. This is the job that
// makes history start existing.
//
// It READS widely and WRITES to exactly one table. Nothing existing is
// touched.
//
// Scheduled Monday 01:00 VN (0 18 * * 0 UTC) — before report-draft at 02:00
// UTC, so the week's figures are frozen before anything reports on them.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// The estate's cron convention (see report-draft, notify-daily): a shared
// secret, falling back to an admin session so it can be run by hand.
async function authed(req: NextRequest): Promise<boolean> {
  const s = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && s && s === process.env.CRON_SECRET) return true
  return await isAdmin()
}

const vnDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const daysBefore = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00+07:00`); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
/** The Monday of the VN week containing `iso`. The idempotency key. */
const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00+07:00`)
  const dow = (d.getDay() + 6) % 7            // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}
const days = (a: string, b: string) =>
  Math.round((new Date(`${a}T12:00:00+07:00`).getTime() - new Date(`${b}T12:00:00+07:00`).getTime()) / 86_400_000)

/**
 * v1-sparse. Deliberately crude, and stored with its inputs so it can be
 * recomputed over history when it is replaced.
 *
 * Recency is the strongest churn signal in the literature and the only one
 * this data can carry honestly, so it dominates. Spend and breadth add a
 * little. There is no sentiment term: harmony_observations has ~1 row, and a
 * term that is always zero would quietly drag every member's score down.
 */
function engagementV1(i: {
  daysSinceVisit: number | null; visits90: number; spend90: number; bookings90: number; notes: number
}): { score: number; confidence: 'low' | 'medium' | 'high' } {
  const recency = i.daysSinceVisit == null ? 0
    : i.daysSinceVisit <= 7 ? 40 : i.daysSinceVisit <= 30 ? 30
    : i.daysSinceVisit <= 60 ? 18 : i.daysSinceVisit <= 90 ? 8 : 0
  const freq = Math.min(25, i.visits90 * 8)
  const money = Math.min(20, i.spend90 > 0 ? 6 + Math.log10(Math.max(1, i.spend90 / 100_000)) * 6 : 0)
  const breadth = Math.min(15, i.bookings90 * 4 + i.notes * 2)
  const score = Math.round(Math.min(100, recency + freq + money + breadth) * 100) / 100
  // Confidence is about the EVIDENCE, not the score. A member with no visit
  // history has a score of 0 that means "we know nothing", not "disengaged".
  const signals = (i.daysSinceVisit != null ? 1 : 0) + (i.visits90 > 0 ? 1 : 0)
    + (i.spend90 > 0 ? 1 : 0) + (i.bookings90 > 0 ? 1 : 0)
  return { score, confidence: signals >= 3 ? 'medium' : 'low' }
}

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb: SupabaseClient = svc()

  const today = vnDate()
  const week = mondayOf(today)
  const d30 = daysBefore(today, 30), d90 = daysBefore(today, 90)

  const [members, stats, mstatus, visits, cards, bookings, menu, gifts, pays, cons, notes, profiles, prefs, obs, comps] =
    await Promise.all([
      sb.from('members').select('member_no, status, tier, join_date, guardian_staff_id'),
      sb.from('member_stats').select('*'),
      sb.from('member_membership_status').select('*'),
      sb.from('visits').select('member_no, visit_date'),
      sb.from('card_transactions').select('member_number, amount_vnd, kind, created_at, balance_after_vnd'),
      sb.from('bookings').select('member_no, booking_date'),
      sb.from('menu_orders').select('member_no, total_vnd, created_at'),
      sb.from('gifts').select('member_no, cost_vnd'),
      sb.from('membership_payments').select('member_no, amount_vnd'),
      sb.from('member_consumption').select('member_no, estimated_pours, consumed_on'),
      sb.from('tasting_notes').select('author, created_at'),
      sb.from('profiles').select('id, member_no'),
      sb.from('preferences').select('member_no, status'),
      sb.from('harmony_observations').select('member_no, sentiment'),
      sb.from('complaints').select('member_no, status'),
    ])

  const rows = members.data || []
  if (!rows.length) return NextResponse.json({ error: 'no members' }, { status: 500 })

  const byMemberProfile = new Map((profiles.data || []).filter(p => p.member_no).map(p => [p.id, p.member_no as string]))
  const statOf = new Map((stats.data || []).map(s => [s.member_no, s]))
  const msOf = new Map((mstatus.data || []).map(s => [s.member_no, s]))

  const snapshots = rows.map(m => {
    const mn = m.member_no as string
    const st = statOf.get(mn) || {}
    const ms = msOf.get(mn) || {}

    const v = (visits.data || []).filter(x => x.member_no === mn)
    const v30 = v.filter(x => x.visit_date >= d30).length
    const v90 = v.filter(x => x.visit_date >= d90).length

    // CHARGES ONLY. kind is topup(+) / charge(−) / link / unlink, so summing
    // everything nets top-ups against spend and produces a meaningless number.
    const ct = (cards.data || []).filter(x => x.member_number === mn)
    const charges = ct.filter(x => x.kind === 'charge')
    const spend = (from: string) => Math.abs(charges.filter(x => String(x.created_at).slice(0, 10) >= from)
      .reduce((s, x) => s + Number(x.amount_vnd || 0), 0))
    const latest = ct.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]

    const notes90 = (notes.data || []).filter(n => byMemberProfile.get(n.author) === mn).length
    const ob = (obs.data || []).filter(x => x.member_no === mn)
    const dsv = st.days_since_visit ?? null

    const eng = engagementV1({
      daysSinceVisit: dsv, visits90: v90, spend90: spend(d90),
      bookings90: (bookings.data || []).filter(x => x.member_no === mn && x.booking_date >= d90).length,
      notes: notes90,
    })

    return {
      member_no: mn, snapshot_week: week, snapshot_date: today,
      status: m.status, tier: m.tier, join_date: m.join_date,
      tenure_days: m.join_date ? days(today, m.join_date) : null,
      paid_through: ms.paid_through ?? null,
      days_to_renewal: ms.paid_through ? days(ms.paid_through, today) : null,
      period_status: ms.period_status ?? null,
      in_grace: ms.in_grace ?? null,

      total_visits: st.total_visits ?? 0,
      days_since_last_visit: dsv,
      visits_trailing_30d: v30,
      visits_trailing_90d: v90,
      avg_visits_per_month: st.avg_visits_per_month ?? null,

      card_spend_trailing_30d: spend(d30),
      card_spend_trailing_90d: spend(d90),
      card_spend_cumulative: spend('0000-00-00'),
      card_balance_vnd: latest ? Number(latest.balance_after_vnd ?? 0) : null,
      menu_spend_trailing_90d: (menu.data || [])
        .filter(x => x.member_no === mn && String(x.created_at).slice(0, 10) >= d90)
        .reduce((s, x) => s + Number(x.total_vnd || 0), 0),
      gifts_cost_cumulative: (gifts.data || []).filter(x => x.member_no === mn)
        .reduce((s, x) => s + Number(x.cost_vnd || 0), 0),
      dues_paid_cumulative: (pays.data || []).filter(x => x.member_no === mn)
        .reduce((s, x) => s + Number(x.amount_vnd || 0), 0),

      bookings_trailing_90d: (bookings.data || []).filter(x => x.member_no === mn && x.booking_date >= d90).length,
      consumption_pours_90d: (cons.data || [])
        .filter(x => x.member_no === mn && String(x.consumed_on || '').slice(0, 10) >= d90)
        .reduce((s, x) => s + Number(x.estimated_pours || 0), 0),
      tasting_notes_count: notes90,
      social_intro_count: 0,          // introductions keys on profile ids and is empty; 0 is honest
      preferences_active: (prefs.data || []).filter(x => x.member_no === mn && x.status === 'active').length,

      excellence_count: ob.filter(x => x.sentiment === 'excellence').length,
      grievance_count: ob.filter(x => x.sentiment === 'grievance').length,
      neutral_count: ob.filter(x => x.sentiment === 'neutral').length,
      complaints_open: (comps.data || []).filter(x => x.member_no === mn && x.status !== 'resolved').length,
      guardian_staff_id: m.guardian_staff_id ?? null,

      engagement_score: eng.score,
      engagement_confidence: eng.confidence,
      score_formula_version: 'v1-sparse',
    }
  })

  // UPSERT on the week key: running twice in a week refreshes the row rather
  // than making a second one.
  const { error } = await sb.from('member_health_snapshots')
    .upsert(snapshots, { onConflict: 'member_no,snapshot_week' })
  if (error) {
    return NextResponse.json(
      { error: error.message, hint: 'Has db/member_health_snapshots.sql been run?' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true, week, snapshot_date: today, members: snapshots.length,
    // Said plainly, because it is the one thing about this job that is easy to
    // misread: today can be captured, history cannot.
    note: 'Trajectory begins at this week. Earlier weeks cannot be backfilled — their inputs were never retained.',
  })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
