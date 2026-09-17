import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { gatherWeek } from '@/lib/reports/gather'
import { draftNarrative } from '@/lib/reports/write'

// RE-GATHER, THEN WRITE THE WEEK UP (2026-09-17).
//
// The owner's complaint was that the report "involves a lot of text boxes" and
// went out only when someone had filled them in — two drafts sat unsent for a
// fortnight. This route does both jobs in one press: it re-reads the week from
// the club's systems, then drafts the prose from those figures.
//
// IT NEVER OVERWRITES A PERSON. Every key it writes is recorded in
// narrative.__auto; on the next run it will replace only the keys still listed
// there. The moment the owner edits a section it stops being machine-written
// (the editor drops the key from __auto on save), and no later draft touches it.
// Same rule as the Vietnamese translator: human work outlives any number of runs.
//
// A locked report is never touched: once approved or sent, what was approved is
// what was sent.

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // a gather (~5s) plus a drafting call (~10-16s)

const KEYS = ['headline', 'summary', 'people', 'money', 'members', 'operations'] as const

const svc = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = svc()

  const { data: r } = await sb.from('weekly_reports')
    .select('period_start, period_end, status, include_financials, narrative, headline').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (r.status === 'approved' || r.status === 'sent') {
    return NextResponse.json({ error: `This report is ${r.status} — revert it to a draft first.` }, { status: 409 })
  }

  // 1 · the numbers, fresh. The prose must describe what the report will show,
  //     so the gather happens here rather than trusting a frozen snapshot.
  const { auto, financials } = await gatherWeek(sb, r.period_start, r.period_end, { includeFinancials: r.include_financials })

  // 2 · the words.
  let draft
  try {
    draft = await draftNarrative(auto, financials)
  } catch (e) {
    // Save the refreshed figures anyway — a report with current numbers and no
    // prose is worth more than one with neither.
    await sb.from('weekly_reports').update({ auto_data: auto, financials: financials || {}, updated_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not draft the report.', data_refreshed: true }, { status: 502 })
  }

  // 3 · merge, protecting anything a person has written.
  const existing = (r.narrative || {}) as Record<string, string>
  const machine = new Set<string>(
    typeof existing.__auto === 'string' ? existing.__auto.split(',').filter(Boolean) : []
  )
  const isFree = (k: string) => {
    const v = k === 'headline' ? (r.headline || existing.headline || '') : existing[k]
    return !v || !String(v).trim() || machine.has(k)
  }

  const next: Record<string, string> = { ...existing }
  const written: string[] = []
  const kept: string[] = []
  for (const k of KEYS) {
    const value = k === 'summary' ? draft.summary.join('\n') : (draft[k] as string)
    if (!value?.trim()) continue
    if (isFree(k)) { next[k] = value; written.push(k) } else kept.push(k)
  }
  next.__auto = written.join(',')

  const patch: Record<string, unknown> = {
    auto_data: auto, financials: financials || {}, narrative: next, updated_at: new Date().toISOString(),
  }
  // The headline has its own column as well as a narrative key; keep them equal.
  if (written.includes('headline')) patch.headline = draft.headline

  const { error } = await sb.from('weekly_reports').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'narrative_drafted' })

  return NextResponse.json({
    ok: true,
    written, kept,
    warnings: draft.warnings,
    summary: `${written.length} section${written.length === 1 ? '' : 's'} written${kept.length ? ` · ${kept.length} left as you wrote them` : ''}`,
  })
}
