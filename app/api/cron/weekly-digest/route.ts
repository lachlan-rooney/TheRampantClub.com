import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isAdmin } from '@/lib/admin'
import { vnDateString, vnDateTimeString } from '@/lib/datetime'
import { OCCASION_LABELS, formatVnd, type Occasion } from '@/lib/gifting'

// POST/GET /api/cron/weekly-digest[?dry=1]
//
// Sunday-night recap. Authenticates via either:
//   - X-CRON-SECRET header matching env.CRON_SECRET (Vercel Cron path)
//   - or a valid admin session (manual "Send digest now" path)
//
// Recipient list comes from env.DIGEST_RECIPIENTS (comma-separated). If
// ?dry=1 the assembled HTML is returned in the response body instead
// of sent.
//
// Vercel Cron config in vercel.json: Sunday 18:00 Vietnam (= 11:00 UTC).

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function safe<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  return Promise.resolve(p).then(r => r.data ?? []).catch(() => [])
}

async function authed(req: NextRequest): Promise<boolean> {
  // Vercel Cron path — header set by Vercel against our CRON_SECRET env.
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && headerSecret && headerSecret === process.env.CRON_SECRET) return true
  // Admin path — manual trigger from the dashboard.
  return await isAdmin()
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest)  { return handle(req) }

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dry = searchParams.get('dry') === '1'

  const sb = svc()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
  const weekAgoISO = weekAgo.toISOString().slice(0, 10)
  const twoWeeksAgoISO = twoWeeksAgo.toISOString().slice(0, 10)

  const [
    membersActive, prospectsThisWeek, prospectsLastWeek, signedThisWeek,
    visitsThisWeek, prefsCreated, validationEvents, candidatesPending,
    giftsThisWeek, openComplaints, observationsThisWeek, upcomingAnniversaries,
  ] = await Promise.all([
    safe<{ member_no: string; join_date: string }>(sb.from('members').select('member_no, join_date').eq('status', 'Active')),
    safe<{ prospect_id: string; created_at: string }>(sb.from('prospects').select('prospect_id, created_at').gte('created_at', weekAgoISO)),
    safe<{ prospect_id: string; created_at: string }>(sb.from('prospects').select('prospect_id, created_at').gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO)),
    safe<{ id: string; status: string; created_at: string }>(sb.from('signing_invitations').select('id, status, created_at').eq('status', 'signed').gte('created_at', weekAgoISO)),
    safe<{ visit_id: string; member_no: string; visit_date: string; phase: string; duration_min: number | null }>(sb.from('visits').select('visit_id, member_no, visit_date, phase, duration_min').gte('visit_date', weekAgoISO).is('archived_at', null)),
    safe<{ preference_id: string; member_no: string; preference_name: string; category: string; s0: number; created_date: string | null }>(sb.from('preferences').select('preference_id, member_no, preference_name, category, s0, created_date').gte('created_date', weekAgoISO)),
    safe<{ event_id: string; event_type: string; preference_id: string; member_no: string; event_timestamp: string }>(sb.from('validation_events').select('event_id, event_type, preference_id, member_no, event_timestamp').gte('event_timestamp', weekAgoISO)),
    safe<{ candidate_id: string }>(sb.from('preference_candidates').select('candidate_id').eq('status', 'pending')),
    safe<{ id: string; member_no: string; gift_date: string; occasion: string; cost_vnd: number; description: string }>(sb.from('gifts').select('id, member_no, gift_date, occasion, cost_vnd, description').gte('gift_date', weekAgoISO)),
    safe<{ id: string; member_no: string | null; severity: number; summary: string }>(sb.from('complaints').select('id, member_no, severity, summary').in('status', ['open', 'acknowledged'])),
    safe<{ observation_id: string; member_no: string; sentiment: string; score: number | null; observation: string }>(sb.from('harmony_observations').select('observation_id, member_no, sentiment, score, observation').gte('created_at', weekAgoISO)),
    safe<{ member_no: string; full_name: string; join_date: string }>(sb.from('members').select('member_no, full_name, join_date').eq('status', 'Active').not('join_date', 'is', null)),
  ])

  // Resolve member names for narrative bits.
  const memberNoSet = new Set<string>([
    ...prefsCreated.map(p => p.member_no),
    ...giftsThisWeek.map(g => g.member_no),
    ...observationsThisWeek.map(o => o.member_no),
  ])
  const { data: memberLookup } = await sb.from('members').select('member_no, full_name').in('member_no', Array.from(memberNoSet))
  const nameByNo = new Map((memberLookup || []).map(m => [m.member_no, m.full_name] as const))

  // Anniversaries in the next 7 days.
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const sevenDays = new Date(today.getTime() + 7 * 86400000)
  const upcomingAnniversariesSoon = upcomingAnniversaries
    .map(m => {
      const jd = m.join_date
      const thisYear = new Date(today.getFullYear(), Number(jd.slice(5, 7)) - 1, Number(jd.slice(8, 10)))
      const target = thisYear < today ? new Date(today.getFullYear() + 1, Number(jd.slice(5, 7)) - 1, Number(jd.slice(8, 10))) : thisYear
      if (target > sevenDays) return null
      const years = target.getFullYear() - Number(jd.slice(0, 4))
      if (years < 1) return null
      return { member_no: m.member_no, full_name: m.full_name, years, days: Math.round((target.getTime() - today.getTime()) / 86400000) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.days - b.days)

  // Best moment of the week — highest-scoring excellence observation.
  const excellence = observationsThisWeek
    .filter(o => o.sentiment === 'excellence')
    .sort((a, b) => (b.score || 0) - (a.score || 0))
  const moment = excellence[0] || null

  // Spend by occasion.
  const giftByOccasion = new Map<string, number>()
  let totalGiftSpend = 0
  for (const g of giftsThisWeek) {
    giftByOccasion.set(g.occasion, (giftByOccasion.get(g.occasion) || 0) + Number(g.cost_vnd))
    totalGiftSpend += Number(g.cost_vnd)
  }

  // Visits stats.
  const uniqueVisitMembers = new Set(visitsThisWeek.map(v => v.member_no)).size
  const closedVisits = visitsThisWeek.filter(v => v.phase === 'closed')
  const avgDuration = closedVisits.length
    ? Math.round(closedVisits.reduce((s, v) => s + (v.duration_min || 0), 0) / closedVisits.length)
    : null

  // Validation events split by type.
  const validationCounts = { confirmed: 0, contradicted: 0, revised: 0, invalidated: 0 } as Record<string, number>
  for (const e of validationEvents) {
    validationCounts[e.event_type] = (validationCounts[e.event_type] || 0) + 1
  }

  const summary = {
    members: membersActive.length,
    pipeline_delta: prospectsThisWeek.length - prospectsLastWeek.length,
    new_prospects: prospectsThisWeek.length,
    signed_this_week: signedThisWeek.length,
    visits: visitsThisWeek.length,
    unique_visit_members: uniqueVisitMembers,
    avg_visit_minutes: avgDuration,
    preferences_added: prefsCreated.length,
    validations: validationCounts,
    candidates_pending: candidatesPending.length,
    gifts_logged: giftsThisWeek.length,
    gift_spend_vnd: totalGiftSpend,
    observations_logged: observationsThisWeek.length,
    open_complaints: openComplaints.length,
  }

  const html = renderDigestHtml({
    weekStartLabel: weekAgo.toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short' }),
    weekEndLabel:   now.toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short', year: 'numeric' }),
    generatedAt:    vnDateTimeString(now),
    summary,
    giftByOccasion: Array.from(giftByOccasion.entries()).map(([occasion, total]) => ({
      occasion,
      label: OCCASION_LABELS[occasion as Occasion] || occasion,
      total,
    })).sort((a, b) => b.total - a.total),
    moment: moment ? {
      member_name: nameByNo.get(moment.member_no) || moment.member_no,
      observation: moment.observation,
      score: moment.score,
    } : null,
    upcomingAnniversaries: upcomingAnniversariesSoon.slice(0, 8),
    topPrefs: prefsCreated.slice(0, 8).map(p => ({
      member_name: nameByNo.get(p.member_no) || p.member_no,
      preference_name: p.preference_name,
      category: p.category,
      s0: p.s0,
    })),
    openComplaints: openComplaints.map(c => ({ severity: c.severity, summary: c.summary })),
  })

  const recipients = (process.env.DIGEST_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean)

  if (dry) {
    return NextResponse.json({ ok: true, summary, recipients, html_preview_len: html.length, html })
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: 'DIGEST_RECIPIENTS env var is empty', summary }, { status: 500 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, error: 'RESEND_API_KEY not configured', summary }, { status: 500 })

  const resend = new Resend(apiKey)
  const subject = `The Rampant Weekly · ${vnDateString().slice(5)} — ${prospectsThisWeek.length} new prospects, ${signedThisWeek.length} signed, ${giftsThisWeek.length} gifts`

  try {
    await resend.emails.send({
      from: 'The Rampant Club <weekly@therampantclub.com>',
      to: recipients,
      subject,
      html,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, summary }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recipients, summary })
}

interface RenderInput {
  weekStartLabel: string
  weekEndLabel: string
  generatedAt: string
  summary: Record<string, unknown>
  giftByOccasion: Array<{ occasion: string; label: string; total: number }>
  moment: { member_name: string; observation: string; score: number | null } | null
  upcomingAnniversaries: Array<{ member_no: string; full_name: string; years: number; days: number }>
  topPrefs: Array<{ member_name: string; preference_name: string; category: string; s0: number }>
  openComplaints: Array<{ severity: number; summary: string }>
}

function renderDigestHtml(d: RenderInput): string {
  const s = d.summary as {
    members: number; pipeline_delta: number; new_prospects: number; signed_this_week: number;
    visits: number; unique_visit_members: number; avg_visit_minutes: number | null;
    preferences_added: number; validations: Record<string, number>; candidates_pending: number;
    gifts_logged: number; gift_spend_vnd: number; observations_logged: number; open_complaints: number;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const lionUrl = `${siteUrl}/images/lion-signature-opt.png`

  return `
<div style="max-width:680px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;background:#E5D4C2;">
  <div style="padding:48px 40px 24px;text-align:center;">
    <img src="${lionUrl}" alt="" width="72" style="display:block;margin:0 auto 20px;" />
    <h1 style="color:#052E20;font-size:22px;font-weight:400;letter-spacing:0.08em;margin:0;">THE RAMPANT WEEKLY</h1>
    <p style="color:#5E6650;font-size:11px;letter-spacing:0.10em;margin:10px 0 0;text-transform:uppercase;">${d.weekStartLabel} – ${d.weekEndLabel}</p>
  </div>

  <div style="padding:0 48px 40px;">
    <p style="color:#5E6650;font-size:13px;line-height:1.85;margin:0 0 24px;">
      A quiet hello from the club. Here is the week as the system saw it — the moments worth noting, the numbers worth knowing, and the people worth thinking about next week.
    </p>

    <!-- Numbers -->
    <div style="background:rgba(5,46,32,0.06);border-radius:8px;padding:20px 22px;margin-bottom:24px;">
      <p style="color:#052E20;font-size:11px;letter-spacing:0.10em;text-transform:uppercase;margin:0 0 14px;">By the numbers</p>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Active members',         `<strong>${s.members}</strong>`)}
        ${row('Visits this week',       `<strong>${s.visits}</strong> across ${s.unique_visit_members} ${s.unique_visit_members === 1 ? 'member' : 'members'}${s.avg_visit_minutes != null ? ` · avg ${s.avg_visit_minutes} min` : ''}`)}
        ${row('Pipeline',               `<strong>${s.new_prospects}</strong> new ${s.new_prospects === 1 ? 'prospect' : 'prospects'} · ${s.signed_this_week} signed`)}
        ${row('Preferences',            `<strong>${s.preferences_added}</strong> added · ${s.validations.confirmed || 0} confirmed · ${s.validations.contradicted || 0} contradicted · ${s.validations.revised || 0} revised`)}
        ${row('Pending candidates',     `<strong style="color:${s.candidates_pending > 0 ? '#5E6650' : '#7AB07A'};">${s.candidates_pending}</strong>${s.candidates_pending > 0 ? ' — awaiting review' : ' — clear'}`)}
        ${row('Gifting',                `<strong>${formatVnd(s.gift_spend_vnd)}</strong> across ${s.gifts_logged} ${s.gifts_logged === 1 ? 'gift' : 'gifts'}`)}
        ${row('Observations',           `<strong>${s.observations_logged}</strong> Accord notes captured`)}
        ${row('Open complaints',        `<strong style="color:${s.open_complaints > 0 ? '#C27070' : '#7AB07A'};">${s.open_complaints}</strong>${s.open_complaints > 0 ? '' : ' — clean week'}`)}
      </table>
    </div>

    ${d.moment ? `
    <div style="background:rgba(212,184,90,0.10);border-left:3px solid #D4B85A;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#5E6650;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 8px;">Moment of the week</p>
      <p style="color:#052E20;font-size:13px;line-height:1.75;margin:0 0 6px;font-style:italic;">"${escapeHtml(d.moment.observation)}"</p>
      <p style="color:#5E6650;font-size:11px;margin:0;">— ${escapeHtml(d.moment.member_name)}${d.moment.score ? ` · ${d.moment.score}/5` : ''}</p>
    </div>
    ` : ''}

    ${d.upcomingAnniversaries.length > 0 ? `
    <p style="color:#052E20;font-size:11px;letter-spacing:0.10em;text-transform:uppercase;margin:24px 0 10px;">Anniversaries in the next 7 days</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${d.upcomingAnniversaries.map(a => `
        <tr><td style="color:#052E20;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(5,46,32,0.08);">${escapeHtml(a.full_name)}</td><td style="color:#5E6650;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(5,46,32,0.08);text-align:right;">${a.years}y · ${a.days === 0 ? 'today' : a.days === 1 ? 'tomorrow' : `in ${a.days}d`}</td></tr>
      `).join('')}
    </table>
    ` : ''}

    ${d.topPrefs.length > 0 ? `
    <p style="color:#052E20;font-size:11px;letter-spacing:0.10em;text-transform:uppercase;margin:24px 0 10px;">New preferences picked up</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${d.topPrefs.map(p => `
        <tr><td style="color:#052E20;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(5,46,32,0.08);">${escapeHtml(p.preference_name)} <span style="color:#5E6650;font-size:11px;">· S₀=${p.s0}</span></td><td style="color:#5E6650;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(5,46,32,0.08);text-align:right;">${escapeHtml(p.member_name)}</td></tr>
      `).join('')}
    </table>
    ` : ''}

    ${d.giftByOccasion.length > 0 ? `
    <p style="color:#052E20;font-size:11px;letter-spacing:0.10em;text-transform:uppercase;margin:24px 0 10px;">Gifting by occasion</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${d.giftByOccasion.map(g => `
        <tr><td style="color:#052E20;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(5,46,32,0.08);">${escapeHtml(g.label)}</td><td style="color:#5E6650;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(5,46,32,0.08);text-align:right;">${formatVnd(g.total)}</td></tr>
      `).join('')}
    </table>
    ` : ''}

    ${d.openComplaints.length > 0 ? `
    <div style="background:rgba(194,112,112,0.08);border-left:3px solid #C27070;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#5E6650;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 8px;">Open complaints to clear</p>
      ${d.openComplaints.map(c => `
        <p style="color:#052E20;font-size:13px;line-height:1.7;margin:0 0 6px;"><strong>S${c.severity}</strong> · ${escapeHtml(c.summary)}</p>
      `).join('')}
    </div>
    ` : ''}

    <p style="color:#5E6650;font-size:11px;line-height:1.7;margin:24px 0 0;opacity:0.7;">Generated ${escapeHtml(d.generatedAt)} (GMT+7).</p>
  </div>

  <div style="background:#052E20;padding:28px 40px;text-align:center;">
    <p style="color:#B2AA98;font-size:10px;line-height:1.7;margin:0;">
      74A2 Hai Ba Trung, District 1, Ho Chi Minh City<br>
      The Rampant Club Member Intelligence System
    </p>
  </div>
</div>
`

  function row(label: string, value: string): string {
    return `<tr><td style="color:#5E6650;font-size:11px;padding:6px 0;letter-spacing:0.04em;text-transform:uppercase;width:160px;vertical-align:top;">${label}</td><td style="color:#052E20;font-size:13px;padding:6px 0;">${value}</td></tr>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
