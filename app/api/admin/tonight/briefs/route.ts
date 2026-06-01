import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'

// GET /api/admin/tonight/briefs[?date=YYYY-MM-DD]
//
// Pre-renders one Overture brief per member booked tonight (plus any
// walk-ins already in the Guardian Angel cycle today). Each brief
// carries Score-5 non-negotiables, ⚠ REVALIDATE flags, the previous
// closed visit's data_for_next_overture, gifting summary, complaint
// count, and member_stats.
//
// Response shape: { date, briefs: BriefRow[] }

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface PrefRow {
  preference_id: string
  member_no: string
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  s0: number
  ps_t: number
  needs_revalidation: string | null
  last_validated: string
  status: string
}

interface Booking {
  booking_id: string
  member_no: string
  member_name: string | null
  member_nickname: string | null
  member_tier: string | null
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string
  party_size: number
  notes: string | null
  status: string
  linked_visit_id: string | null
}

interface VisitToday {
  visit_id: string
  member_no: string
  phase: string
  arrival_time: string | null
}

interface MemberLite {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  birthday: string | null
  join_date: string | null
}

interface MemberStats {
  member_no: string
  total_visits: number
  last_visit: string | null
  days_since_visit: number | null
  avg_visits_per_month: number | null
}

interface LastNote {
  member_no: string
  visit_id: string
  visit_date: string
  data_for_next_overture: string
}

interface GiftingSummary {
  member_no: string
  annual_budget_vnd: number
  spent_vnd: number
  gift_count: number
}

interface OpenComplaint {
  id: string
  member_no: string | null
  severity: number
  summary: string
  status: string
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || vnDateString()

  const sb = svc()

  // Bookings for tonight (anything not cancelled / no_show).
  const { data: bookingsRaw } = await sb.from('bookings_with_member')
    .select('booking_id, member_no, member_name, member_nickname, member_tier, start_time, end_time, session_label, space, party_size, notes, status, linked_visit_id')
    .eq('booking_date', date)
    .in('status', ['confirmed', 'pending', 'arrived'])
    .order('start_time', { ascending: true, nullsFirst: false })
  const bookings = (bookingsRaw || []) as Booking[]

  // Visits already on the floor today — for walk-ins (no booking) so they
  // still get a brief surface.
  const { data: todayVisits } = await sb.from('visits')
    .select('visit_id, member_no, phase, arrival_time')
    .eq('visit_date', date)
    .neq('phase', 'closed')
  const visits = (todayVisits || []) as VisitToday[]

  // The unique set of members the team needs briefs for: anyone booked +
  // anyone with an in-flight visit who isn't already covered by a booking.
  const memberNoSet = new Set<string>()
  for (const b of bookings) memberNoSet.add(b.member_no)
  for (const v of visits) memberNoSet.add(v.member_no)
  const memberNos = Array.from(memberNoSet)

  if (memberNos.length === 0) {
    return NextResponse.json({ date, briefs: [] })
  }

  const [
    { data: members },
    { data: stats },
    { data: prefScores },
    { data: lastNotes },
    { data: gifting },
    { data: complaints },
  ] = await Promise.all([
    sb.from('members').select('member_no, full_name, nickname, tier, status, birthday, join_date').in('member_no', memberNos),
    sb.from('member_stats').select('member_no, total_visits, last_visit, days_since_visit, avg_visits_per_month').in('member_no', memberNos),
    sb.from('preference_scores')
      .select('preference_id, member_no, category, subcategory, preference_name, detail, s0, ps_t, needs_revalidation, last_validated, status')
      .in('member_no', memberNos)
      .eq('status', 'active'),
    sb.from('last_continuum_note').select('member_no, visit_id, visit_date, data_for_next_overture').in('member_no', memberNos),
    sb.from('member_gifting_summary').select('member_no, annual_budget_vnd, spent_vnd, gift_count').in('member_no', memberNos)
      .then(r => r, () => ({ data: [] as GiftingSummary[], error: null })),
    sb.from('complaints').select('id, member_no, severity, summary, status').in('member_no', memberNos).in('status', ['open', 'acknowledged'])
      .then(r => r, () => ({ data: [] as OpenComplaint[], error: null })),
  ])

  const memberMap   = new Map((members || []).map(m => [(m as MemberLite).member_no, m as MemberLite] as const))
  const statsMap    = new Map((stats || []).map(s => [(s as MemberStats).member_no, s as MemberStats] as const))
  const noteMap     = new Map((lastNotes || []).map(n => [(n as LastNote).member_no, n as LastNote] as const))
  const giftingMap  = new Map((gifting || []).map(g => [(g as GiftingSummary).member_no, g as GiftingSummary] as const))
  const visitByMember = new Map(visits.map(v => [v.member_no, v] as const))

  // Group preferences by member, bucket Score-5 and revalidation.
  const prefsByMember = new Map<string, { score5: PrefRow[]; revalidate: PrefRow[]; total: number }>()
  for (const raw of (prefScores || [])) {
    const p = raw as PrefRow
    const bucket = prefsByMember.get(p.member_no) || { score5: [], revalidate: [], total: 0 }
    bucket.total += 1
    if (Number(p.s0) === 5) bucket.score5.push(p)
    const reval = String(p.needs_revalidation || '').toUpperCase()
    if (reval.includes('REVALIDATE') || reval.includes('⚠')) bucket.revalidate.push(p)
    prefsByMember.set(p.member_no, bucket)
  }

  // Complaints — group by member (most recent open first).
  const complaintsByMember = new Map<string, OpenComplaint[]>()
  for (const c of (complaints || [])) {
    const row = c as OpenComplaint
    if (!row.member_no) continue
    const list = complaintsByMember.get(row.member_no) || []
    list.push(row)
    complaintsByMember.set(row.member_no, list)
  }

  // Assemble one brief per member; bookings drive the ordering.
  const seen = new Set<string>()
  const briefs: Array<Record<string, unknown>> = []

  function buildBriefForMember(memberNo: string, booking: Booking | null) {
    if (seen.has(memberNo)) return
    seen.add(memberNo)

    const member = memberMap.get(memberNo)
    if (!member) return
    const stat = statsMap.get(memberNo) || null
    const prefBucket = prefsByMember.get(memberNo) || { score5: [], revalidate: [], total: 0 }
    const lastNote = noteMap.get(memberNo) || null
    const giftingSummary = giftingMap.get(memberNo) || null
    const memberComplaints = complaintsByMember.get(memberNo) || []
    const visit = visitByMember.get(memberNo) || null

    // Birthday / anniversary chip (today only — Tonight is intentionally
    // the night-of moment, not the week-ahead view).
    let occasion: string | null = null
    if (member.birthday && member.birthday.slice(5, 10) === date.slice(5, 10)) {
      occasion = '🎂 Birthday today'
    }
    if (member.join_date) {
      const jd = member.join_date.slice(5, 10)
      if (jd === date.slice(5, 10)) {
        const years = Number(date.slice(0, 4)) - Number(member.join_date.slice(0, 4))
        if (years >= 1) occasion = (occasion ? occasion + ' · ' : '') + `🎈 ${years}-year anniversary`
      }
    }

    briefs.push({
      member: {
        member_no: member.member_no,
        full_name: member.full_name,
        nickname: member.nickname,
        tier: member.tier,
      },
      booking,
      visit,
      occasion,
      brief: {
        score5: prefBucket.score5,
        revalidate: prefBucket.revalidate,
        last_continuum_note: lastNote,
      },
      stats: stat,
      gifting: giftingSummary,
      complaints: memberComplaints,
      preference_count: prefBucket.total,
    })
  }

  for (const b of bookings) buildBriefForMember(b.member_no, b)
  for (const v of visits) {
    if (!seen.has(v.member_no)) buildBriefForMember(v.member_no, null)  // walk-in
  }

  return NextResponse.json({ date, briefs })
}
