import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/observatory/events?limit=100&since=ISO
//
// Merged reverse-chronological feed of scoring events for Panel 4:
//   - validation_events (confirmed / contradicted / revised / invalidated)
//   - preferences inserts (new rows the intake just wrote)
//   - learned_decay_constants status flips to 'active' (the loop-closure
//     headline — extraction inheriting a rate the system learned)
//
// Used at initial page load and, when Realtime fallback is in effect, polled
// every 15s. Annotation (what each event MEANS mathematically) is computed
// client-side so this route stays cheap and the consequence text can evolve
// without redeploying SQL.

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface ValidationRow {
  event_id: string
  member_no: string
  preference_id: string
  event_type: string
  event_timestamp: string
  days_since_last_validation: number | null
}
interface PreferenceRow {
  preference_id: string
  member_no: string
  category: string
  preference_name: string
  lambda: number
  lambda_origin: string | null
  created_date: string | null
  status: string
}
interface LdcRow {
  id: string
  category: string
  status: string | null
  learned_lambda: number
  designed_lambda: number
  fit_timestamp: string
  notes: string | null
}
interface MemberRow { member_no: string; full_name: string }

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(500, Math.max(10, Number(url.searchParams.get('limit') || DEFAULT_LIMIT)))
  const since = url.searchParams.get('since') // optional ISO

  const sb = svc()

  const [vEv, prefs, ldc, members] = await Promise.all([
    (async () => {
      let q = sb.from('validation_events')
        .select('event_id, member_no, preference_id, event_type, event_timestamp, days_since_last_validation')
        .order('event_timestamp', { ascending: false })
        .limit(limit)
      if (since) q = q.gt('event_timestamp', since)
      return q
    })(),
    (async () => {
      let q = sb.from('preferences')
        .select('preference_id, member_no, category, preference_name, lambda, lambda_origin, created_date, status')
        .order('created_date', { ascending: false, nullsFirst: false })
        .limit(limit)
      if (since) q = q.gt('created_date', since.slice(0, 10))
      return q
    })(),
    // learned_decay_constants — pull recent active rows so promotions show up.
    (async () => {
      let q = sb.from('learned_decay_constants')
        .select('id, category, status, learned_lambda, designed_lambda, fit_timestamp, notes')
        .eq('status', 'active')
        .order('fit_timestamp', { ascending: false })
        .limit(50)
      if (since) q = q.gt('fit_timestamp', since)
      return q
    })(),
    sb.from('members').select('member_no, full_name'),
  ])

  if (vEv.error)    return NextResponse.json({ error: vEv.error.message    }, { status: 500 })
  if (prefs.error)  return NextResponse.json({ error: prefs.error.message  }, { status: 500 })
  if (ldc.error)    return NextResponse.json({ error: ldc.error.message    }, { status: 500 })
  if (members.error) return NextResponse.json({ error: members.error.message }, { status: 500 })

  const memberByNo = new Map(((members.data || []) as MemberRow[]).map(m => [m.member_no, m.full_name] as const))

  type FeedEvent = {
    id: string
    kind: 'validation' | 'preference_insert' | 'promotion'
    subtype: string | null
    timestamp: string
    member_no: string | null
    member_name: string | null
    category: string | null
    preference_id: string | null
    preference_name: string | null
    lambda: number | null
    lambda_origin: string | null
    learned_lambda: number | null
    designed_lambda: number | null
    days_since_last_validation: number | null
    is_demo_fixture: boolean
    loop_closure: boolean  // category_baseline_learned writes or active promotions
  }
  const feed: FeedEvent[] = []

  for (const r of (vEv.data || []) as ValidationRow[]) {
    feed.push({
      id: `v_${r.event_id}`,
      kind: 'validation',
      subtype: r.event_type,
      timestamp: r.event_timestamp,
      member_no: r.member_no,
      member_name: memberByNo.get(r.member_no) || null,
      category: null,
      preference_id: r.preference_id,
      preference_name: null,
      lambda: null, lambda_origin: null,
      learned_lambda: null, designed_lambda: null,
      days_since_last_validation: r.days_since_last_validation,
      is_demo_fixture: false,
      loop_closure: false,
    })
  }
  for (const r of (prefs.data || []) as PreferenceRow[]) {
    // Use created_date as the ordering key (it's a date, not a timestamp;
    // good enough for the feed since we order millis-precise by event_timestamp etc.).
    feed.push({
      id: `p_${r.preference_id}`,
      kind: 'preference_insert',
      subtype: null,
      timestamp: r.created_date ? `${r.created_date}T00:00:00Z` : new Date(0).toISOString(),
      member_no: r.member_no,
      member_name: memberByNo.get(r.member_no) || null,
      category: r.category,
      preference_id: r.preference_id,
      preference_name: r.preference_name,
      lambda: r.lambda, lambda_origin: r.lambda_origin,
      learned_lambda: null, designed_lambda: null,
      days_since_last_validation: null,
      is_demo_fixture: false,
      loop_closure: r.lambda_origin === 'category_baseline_learned',
    })
  }
  for (const r of (ldc.data || []) as LdcRow[]) {
    feed.push({
      id: `l_${r.id}`,
      kind: 'promotion',
      subtype: r.status,
      timestamp: r.fit_timestamp,
      member_no: null, member_name: null,
      category: r.category,
      preference_id: null, preference_name: null,
      lambda: null, lambda_origin: null,
      learned_lambda: r.learned_lambda,
      designed_lambda: r.designed_lambda,
      days_since_last_validation: null,
      is_demo_fixture: r.notes === '__DEMO_FIXTURE__',
      loop_closure: true,
    })
  }

  feed.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return NextResponse.json({
    events: feed.slice(0, limit),
    fetched_at: new Date().toISOString(),
  })
}
