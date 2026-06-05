import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'

// POST /api/admin/harmony/[id]/apply
//
// Body: { extraction_ids: string[] }
//
// For each id, looks up the harmony_extractions row and fans it out into
// the right live table (visits, preferences, locker_contents, prospects,
// complaints, card_transactions). Marks each row with status='applied' +
// target_table + target_id on success, or status='failed' + failure_note
// on a soft failure (e.g. ambiguous member match). Idempotent — already-
// applied rows are skipped.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface MemberLite {
  member_no: string
  full_name: string
  nickname: string | null
}

function resolveMember(hint: string | null | undefined, members: MemberLite[]): { match: MemberLite | null; reason: string | null } {
  if (!hint) return { match: null, reason: 'no member hint' }
  const h = hint.trim().toLowerCase()
  if (!h) return { match: null, reason: 'empty member hint' }
  // No reverse-includes branch: hint "Mike Smith" must not match member
  // "Mike Tran" just because both share the first-token "Mike".
  const matches = members.filter(m => {
    const full = m.full_name.toLowerCase()
    const nick = (m.nickname || '').toLowerCase()
    return full === h || nick === h || full.includes(h) || (nick && nick.includes(h))
  })
  if (matches.length === 1) return { match: matches[0], reason: null }
  if (matches.length === 0) return { match: null, reason: `no member matches "${hint}"` }
  return { match: null, reason: `ambiguous: ${matches.length} members match "${hint}"` }
}

// Snap a numeric value to the nearest member of an allowed set. Returns the
// allowed value, the fallback, or null if no value supplied.
function snap(v: unknown, allowed: number[], fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  let best = allowed[0]
  let bestDist = Math.abs(allowed[0] - n)
  for (const a of allowed) {
    const d = Math.abs(a - n)
    if (d < bestDist) { best = a; bestDist = d }
  }
  return best
}
const ALLOWED_CONFIDENCE = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_LAMBDA     = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_FREQUENCY  = [0.8, 1.0, 1.2, 1.5]
function clampS0(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(5, n))
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: log_id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: { extraction_ids?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const ids = Array.isArray(body.extraction_ids) ? body.extraction_ids.filter((x): x is string => typeof x === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'extraction_ids required' }, { status: 400 })

  const sb = svc()
  const [{ data: log }, { data: extractions }, { data: members }] = await Promise.all([
    sb.from('harmony_logs').select('id, shift_date').eq('id', log_id).maybeSingle(),
    sb.from('harmony_extractions').select('*').eq('log_id', log_id).in('id', ids),
    sb.from('members').select('member_no, full_name, nickname'),
  ])
  if (!log) return NextResponse.json({ error: 'log not found' }, { status: 404 })

  const memberRoster = (members || []) as MemberLite[]
  const today = vnDateString()
  const applied: Array<{ id: string; kind: string; target_table: string; target_id: string }> = []
  const failed: Array<{ id: string; kind: string; reason: string }> = []

  for (const e of (extractions || [])) {
    if (e.status === 'applied') continue  // idempotent

    // Atomic claim: only one apply call can transition pending|accepted →
    // applying for a given extraction. If two callers race on the same
    // extraction_ids list, the second sees an empty .select() and skips.
    const { data: claimed } = await sb
      .from('harmony_extractions')
      .update({ status: 'applying' })
      .eq('id', e.id)
      .in('status', ['pending', 'accepted'])
      .select('id')
    if (!claimed || claimed.length === 0) continue

    const payload = (e.payload || {}) as Record<string, unknown>
    const memberHint = e.member_hint || (typeof payload.member_hint === 'string' ? payload.member_hint as string : null)

    try {
      let target_table: string | null = null
      let target_id: string | null = null
      let member_no: string | null = null

      if (e.kind === 'visit') {
        const r = resolveMember(memberHint, memberRoster)
        if (!r.match) throw new Error(r.reason || 'unresolved member')
        member_no = r.match.member_no
        // Pass 2: AI-extracted visits land at phase='accord' so the team
        // can open them via the Guardian Angel detail page and close them
        // out with a data_for_next_overture note. They count toward M
        // immediately via member_stats.
        const { data: row, error: insErr } = await sb.from('visits').insert({
          member_no,
          visit_date:      log.shift_date,
          phase:           'accord',
          arrival_time:    new Date().toISOString(),
          space:           payload.space      ? String(payload.space).slice(0, 80) : null,
          duration_min:    Number.isInteger(payload.duration_min) ? payload.duration_min : null,
          emotional_state: payload.emotional_state ? String(payload.emotional_state).slice(0, 80) : null,
          notes:           payload.notes      ? String(payload.notes).slice(0, 2000) : null,
          logged_by:       `Harmony Log · ${actor}`,
        }).select('visit_id').single()
        if (insErr || !row) throw new Error(insErr?.message || 'insert failed')
        target_table = 'visits'
        target_id = row.visit_id

      } else if (e.kind === 'preference') {
        const r = resolveMember(memberHint, memberRoster)
        if (!r.match) throw new Error(r.reason || 'unresolved member')
        member_no = r.match.member_no
        // Pass 2: AI-proposed preferences go to the candidate queue, not
        // directly into preferences. An admin reviews via /admin/mis/candidates
        // and the promote_preference_candidate RPC handles the insert.
        const { data: row, error: insErr } = await sb.from('preference_candidates').insert({
          member_no,
          suggested_category:    String(payload.category || '').slice(0, 40) || null,
          suggested_name:        String(payload.preference_name || 'Untitled preference').slice(0, 200),
          detail:                payload.detail ? String(payload.detail).slice(0, 2000) : null,
          verbatim_quote:        payload.verbatim_quote ? String(payload.verbatim_quote).slice(0, 1000) : null,
          suggested_s0:          clampS0(payload.s0),
          suggested_confidence:  snap(payload.confidence, ALLOWED_CONFIDENCE, 0.75),
          suggested_lambda:      snap(payload.lambda,     ALLOWED_LAMBDA,     0.010),
          suggested_frequency:   snap(payload.frequency,  ALLOWED_FREQUENCY,  1.0),
          source:                'Harmony Log',
        }).select('candidate_id').single()
        if (insErr || !row) throw new Error(insErr?.message || 'insert failed')
        target_table = 'preference_candidates'
        target_id = row.candidate_id

      } else if (e.kind === 'bottle_depletion') {
        const r = resolveMember(memberHint, memberRoster)
        if (!r.match) throw new Error(r.reason || 'unresolved member')
        member_no = r.match.member_no
        // Find the member's locker(s), then the bottle by tiered match —
        // exact wins outright; otherwise prefix; otherwise substring. Ties
        // fail explicitly rather than picking whichever row Postgres returns.
        const { data: lockers } = await sb.from('lockers').select('locker_no').eq('member_no', member_no)
        const lockerNos = (lockers || []).map(l => l.locker_no)
        if (lockerNos.length === 0) throw new Error('member has no locker')
        const bottleName = String(payload.bottle_name || '').trim().toLowerCase()
        if (!bottleName) throw new Error('no bottle_name')
        const { data: contents } = await sb.from('locker_contents').select('id, bottle_name, fill_pct').in('locker_no', lockerNos)
        const items = (contents || []).map(c => ({ ...c, lname: c.bottle_name.toLowerCase() }))
        const exact  = items.filter(i => i.lname === bottleName)
        const prefix = items.filter(i => i.lname.startsWith(bottleName) || bottleName.startsWith(i.lname))
        const inc    = items.filter(i => i.lname.includes(bottleName) || bottleName.includes(i.lname))
        const tier = exact.length ? exact : prefix.length ? prefix : inc
        if (tier.length === 0) throw new Error(`no matching bottle "${payload.bottle_name}"`)
        if (tier.length > 1)   throw new Error(`ambiguous bottle "${payload.bottle_name}" — ${tier.length} candidates`)
        const candidate = tier[0]
        const newFillRaw = payload.estimated_new_fill_pct
        const newFill = Number.isInteger(newFillRaw)
          ? Math.max(0, Math.min(100, newFillRaw as number))
          : Math.max(0, candidate.fill_pct - 25)  // conservative default: drop one quarter
        const { error: updErr } = await sb.from('locker_contents').update({
          fill_pct: newFill,
          notes: payload.note ? String(payload.note).slice(0, 1000) : null,
          updated_at: new Date().toISOString(),
        }).eq('id', candidate.id)
        if (updErr) throw new Error(updErr.message)
        // Capture the consumption event (the consumed delta is otherwise lost) —
        // feeds the member taste profile's consumption seam. Append-only,
        // best-effort: never blocks or alters the locker-fill behaviour above.
        const consumedPct = Math.max(0, candidate.fill_pct - newFill)
        const pours = typeof payload.estimated_pours === 'number' && Number.isInteger(payload.estimated_pours) ? payload.estimated_pours : null
        await sb.from('member_consumption').insert({
          member_no,
          bottle_name: candidate.bottle_name,
          whisky_id: null,                               // locker bottles aren't FK'd to the catalogue
          consumed_on: log.shift_date,
          amount_pct: consumedPct,
          estimated_pours: pours,
          source_extraction_id: e.id,
        }).then(({ error }) => { if (error) console.error('member_consumption capture failed (non-fatal):', error.message) })
        target_table = 'locker_contents'
        target_id = candidate.id

      } else if (e.kind === 'prospect') {
        const full_name = String(payload.full_name || '').trim()
        if (!full_name) throw new Error('no full_name')
        // Mint next P-xxx.
        const { data: existing } = await sb.from('prospects').select('prospect_id')
        const nextNum = (existing || [])
          .map(r => parseInt(String(r.prospect_id || '').replace(/[^0-9]/g, ''), 10))
          .filter(n => Number.isFinite(n))
          .reduce((m, n) => Math.max(m, n), 0) + 1
        const prospect_id = `P-${String(nextNum).padStart(3, '0')}`

        // Try to link referred_by to a member if hint matches.
        let referred_by_member_no: string | null = null
        let referred_by_name: string | null = null
        if (payload.referred_by_hint) {
          const refMatch = resolveMember(String(payload.referred_by_hint), memberRoster)
          if (refMatch.match) {
            referred_by_member_no = refMatch.match.member_no
            referred_by_name = refMatch.match.full_name
          } else {
            referred_by_name = String(payload.referred_by_hint).slice(0, 200)
          }
        }

        const { error: insErr } = await sb.from('prospects').insert({
          prospect_id,
          stage: 'Lead',
          full_name: full_name.slice(0, 200),
          profession: payload.profession ? String(payload.profession).slice(0, 200) : null,
          source_channel: typeof payload.source_channel === 'string' && ['Referral', 'Direct Approach', 'Event'].includes(payload.source_channel) ? payload.source_channel : (referred_by_member_no ? 'Referral' : null),
          referred_by_name,
          referred_by_member_no,
          first_contact_date: log.shift_date,
          notes: payload.notes ? `[Harmony Log ${log.shift_date}] ${String(payload.notes).slice(0, 4000)}` : null,
        })
        if (insErr) throw new Error(insErr.message)
        await sb.from('prospect_activity').insert({
          prospect_id,
          actor: `Harmony Log · ${actor}`,
          event_type: 'created',
          to_value: prospect_id,
          note: 'Created from Harmony Log extraction.',
        })
        target_table = 'prospects'
        target_id = prospect_id

      } else if (e.kind === 'complaint') {
        let member_name: string | null = null
        const r = memberHint ? resolveMember(memberHint, memberRoster) : { match: null, reason: null }
        if (r.match) { member_no = r.match.member_no; member_name = r.match.full_name }
        else if (memberHint) member_name = memberHint
        const status = typeof payload.status === 'string' && ['open', 'acknowledged', 'resolved', 'dismissed'].includes(payload.status) ? payload.status : 'open'
        const { data: row, error: insErr } = await sb.from('complaints').insert({
          member_no,
          member_name,
          severity:  Number.isInteger(payload.severity) && (payload.severity as number) >= 1 && (payload.severity as number) <= 5 ? payload.severity : 2,
          category:  typeof payload.category === 'string' ? payload.category.slice(0, 40) : null,
          summary:   String(payload.summary || 'Complaint').slice(0, 500),
          details:   payload.detail ? String(payload.detail).slice(0, 4000) : null,
          status,
          reported_by: `Harmony Log · ${actor}`,
          resolution: status === 'resolved' && typeof payload.resolution === 'string' ? payload.resolution.slice(0, 4000) : null,
          resolved_by: status === 'resolved' ? actor : null,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        }).select('id').single()
        if (insErr || !row) throw new Error(insErr?.message || 'insert failed')
        target_table = 'complaints'
        target_id = row.id

      } else if (e.kind === 'card_charge') {
        const r = resolveMember(memberHint, memberRoster)
        if (!r.match) throw new Error(r.reason || 'unresolved member')
        member_no = r.match.member_no
        const amount = Number(payload.amount_vnd)
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid amount_vnd')
        // Use the atomic RPC so insufficient credit / expiry are rejected
        // and balance updates stay consistent under concurrency.
        const note = payload.note ? `Harmony Log: ${String(payload.note).slice(0, 400)}` : `Harmony Log charge ${log.shift_date}`
        const { data: rpcRows, error: rpcErr } = await sb.rpc('apply_card_transaction', {
          p_member_number: member_no,
          p_kind:          'charge',
          p_amount_vnd:    Math.round(amount),
          p_note:          note,
          p_staff_id:      null,
          p_staff_email:   actor,
        })
        if (rpcErr) throw new Error(rpcErr.message)
        const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
        if (!rpcRow?.transaction_id) throw new Error('RPC returned no transaction_id')
        target_table = 'card_transactions'
        target_id = String(rpcRow.transaction_id)

      } else {
        throw new Error(`unknown kind: ${e.kind}`)
      }

      await sb.from('harmony_extractions').update({
        status: 'applied',
        member_no,
        target_table,
        target_id,
        reviewed_by: actor,
        reviewed_at: new Date().toISOString(),
      }).eq('id', e.id)
      applied.push({ id: e.id, kind: e.kind, target_table: target_table!, target_id: target_id! })

    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      await sb.from('harmony_extractions').update({
        status: 'failed',
        failure_note: reason.slice(0, 500),
        reviewed_by: actor,
        reviewed_at: new Date().toISOString(),
      }).eq('id', e.id)
      failed.push({ id: e.id, kind: e.kind, reason })
    }
  }

  // Roll up log status. Only flip to 'applied' when at least one extraction
  // successfully applied AND no rows are still waiting for review. A log
  // where every extraction failed must NOT read as "applied".
  const { data: remaining } = await sb.from('harmony_extractions').select('status').eq('log_id', log_id)
  const counts = { pending: 0, accepted: 0, applied: 0 }
  for (const r of remaining || []) {
    if (r.status === 'pending')  counts.pending  += 1
    if (r.status === 'accepted') counts.accepted += 1
    if (r.status === 'applied')  counts.applied  += 1
  }
  const stillWaiting = counts.pending + counts.accepted > 0
  const newStatus = !stillWaiting && counts.applied > 0 ? 'applied' : 'reviewed'
  await sb.from('harmony_logs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', log_id)

  return NextResponse.json({ ok: true, applied, failed })
}
