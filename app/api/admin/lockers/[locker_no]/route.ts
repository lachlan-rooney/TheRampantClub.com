import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET    /api/admin/lockers/[locker_no]  — single locker + its contents
// PATCH  /api/admin/lockers/[locker_no]  — assign member, edit label/status/notes/position
//                                          (every change appends to locker_activity)
// DELETE /api/admin/lockers/[locker_no]  — retire (sets status='retired', clears member;
//                                          logs as event_type='retired')

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['occupied', 'reserved', 'empty', 'retired']

interface LockerRow {
  locker_no: string
  member_no: string | null
  label: string | null
  notes: string | null
  status: string
  position_row: number | null
  position_col: number | null
}

// Diff the patched fields against the existing locker row. Returns the
// (event_type, before_state, after_state) tuple for the activity log.
// Returns null when the patch is a true no-op (no field actually
// changed) so we don't log noise.
function describeChange(
  prior: LockerRow,
  patched: Record<string, unknown>
): { event_type: string; before_state: Record<string, unknown>; after_state: Record<string, unknown> } | null {
  const before: Record<string, unknown> = {}
  const after:  Record<string, unknown> = {}
  let memberChanged   = false
  let statusChanged   = false
  let labelChanged    = false
  let notesChanged    = false
  let positionChanged = false

  if ('member_no' in patched && patched.member_no !== prior.member_no) {
    before.member_no = prior.member_no
    after.member_no  = patched.member_no
    memberChanged = true
  }
  if ('status' in patched && patched.status !== prior.status) {
    before.status = prior.status
    after.status  = patched.status
    statusChanged = true
  }
  if ('label' in patched && patched.label !== prior.label) {
    before.label = prior.label
    after.label  = patched.label
    labelChanged = true
  }
  if ('notes' in patched && patched.notes !== prior.notes) {
    before.notes = prior.notes
    after.notes  = patched.notes
    notesChanged = true
  }
  if (('position_row' in patched && patched.position_row !== prior.position_row) ||
      ('position_col' in patched && patched.position_col !== prior.position_col)) {
    before.position_row = prior.position_row
    before.position_col = prior.position_col
    after.position_row  = 'position_row' in patched ? patched.position_row : prior.position_row
    after.position_col  = 'position_col' in patched ? patched.position_col : prior.position_col
    positionChanged = true
  }

  if (Object.keys(after).length === 0) return null  // no-op

  // Pick the most semantically meaningful event_type when more than one
  // field changed. Assignment changes are the most user-visible event
  // people read activity logs for.
  let event_type = 'misc_patch'
  if (memberChanged) {
    event_type = (patched.member_no == null) ? 'unassigned' : 'assigned'
  } else if (statusChanged) {
    event_type = patched.status === 'retired' ? 'retired' : 'status_changed'
  } else if (positionChanged) {
    event_type = 'position_changed'
  } else if (labelChanged) {
    event_type = 'label_changed'
  } else if (notesChanged) {
    event_type = 'notes_changed'
  }

  return { event_type, before_state: before, after_state: after }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params
  const sb = svc()
  const [{ data: locker }, { data: contents }, { data: activity }] = await Promise.all([
    sb.from('lockers_with_member').select('*').eq('locker_no', locker_no).maybeSingle(),
    sb.from('locker_contents').select('*').eq('locker_no', locker_no).order('added_at', { ascending: false }),
    sb.from('locker_activity').select('*').eq('locker_no', locker_no).order('created_at', { ascending: false }).limit(50)
      // Defensive: locker_activity may not be migrated yet; swallow + return empty.
      .then(r => r, () => ({ data: [] as Record<string, unknown>[], error: null })),
  ])
  if (!locker) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ locker, contents: contents || [], activity: activity || [] })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params

  // Identity for the audit row.
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const changed_by       = user?.id ?? null
  const changed_by_email = user?.email ?? null

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('member_no' in body) patch.member_no = body.member_no ? String(body.member_no).slice(0, 12) : null
  if (typeof body.label === 'string') patch.label = body.label.slice(0, 200) || null
  if (typeof body.label === 'object' && body.label === null) patch.label = null
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 1000) || null
  if (typeof body.notes === 'object' && body.notes === null) patch.notes = null
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) patch.status = body.status
  if ('position_row' in body) {
    if (body.position_row === null) patch.position_row = null
    else if (Number.isInteger(body.position_row) && (body.position_row as number) >= 1) patch.position_row = body.position_row
  }
  if ('position_col' in body) {
    if (body.position_col === null) patch.position_col = null
    else if (Number.isInteger(body.position_col) && (body.position_col as number) >= 1) patch.position_col = body.position_col
  }

  if ('member_no' in body && !('status' in body)) {
    patch.status = body.member_no ? 'occupied' : 'empty'
  }

  const sb = svc()

  // Fetch prior state for the diff. If the locker doesn't exist (the
  // page seeds rows lazily) we still proceed with the update — there's
  // nothing to log against in that case.
  const { data: prior } = await sb
    .from('lockers')
    .select('locker_no, member_no, label, notes, status, position_row, position_col')
    .eq('locker_no', locker_no)
    .maybeSingle()

  const { error } = await sb.from('lockers').update(patch).eq('locker_no', locker_no)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity. Failure to log is non-fatal — the update already
  // succeeded — but we still surface it in the response so the client
  // can warn if it cares.
  let activityWarning: string | null = null
  if (prior) {
    const change = describeChange(prior as LockerRow, patch)
    if (change) {
      const { error: actErr } = await sb.from('locker_activity').insert({
        locker_no,
        event_type:       change.event_type,
        before_state:     change.before_state,
        after_state:      change.after_state,
        changed_by,
        changed_by_email,
      })
      if (actErr) activityWarning = actErr.message
    }
  }

  return NextResponse.json({ ok: true, activity_warning: activityWarning })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const changed_by       = user?.id ?? null
  const changed_by_email = user?.email ?? null

  const sb = svc()
  const { data: prior } = await sb
    .from('lockers')
    .select('locker_no, member_no, status')
    .eq('locker_no', locker_no)
    .maybeSingle()

  const { error } = await sb.from('lockers').update({
    status: 'retired', member_no: null, updated_at: new Date().toISOString(),
  }).eq('locker_no', locker_no)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (prior) {
    await sb.from('locker_activity').insert({
      locker_no,
      event_type:       'retired',
      before_state:     { member_no: prior.member_no, status: prior.status },
      after_state:      { member_no: null,           status: 'retired' },
      changed_by,
      changed_by_email,
    })
  }

  return NextResponse.json({ ok: true })
}
