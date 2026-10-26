import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { getActor, socialEmit } from '@/lib/social/server'

// Update an existing member's record — name, tier, status, join date.
// Admin-only, service role.
//
// The tier a prospect is converted with is only the default; this lets staff
// correct it afterward on the member record.
//
// ── THE NAME (added 2026-10-26) ──────────────────────────────────
// There was no way to correct a member's name anywhere in the estate. A name
// entered wrongly at signing stayed wrong on 81 files' worth of surfaces, and
// the only fix was SQL.
//
// full_name is NOT NULL on members, so it can be changed but never emptied.
// nickname is nullable and clearing it is a legitimate edit.
//
// BOTH ARE TRIMMED AND INTERNALLY COLLAPSED. db/mis_pass1.sql says it plainly:
// the FK is on member_no "NOT on member name — this kills the trailing-space
// and name-mismatch bugs the Apps Script carries TRIM() workarounds for". A
// name pasted out of a spreadsheet arrives with a trailing space, and the one
// place that can stop it is here.
//
// ⚠ WHAT A RENAME DOES AND DOES NOT REACH:
//   · members.nickname then members.full_name is what the member is CALLED
//     everywhere (lib/kiosk/name displayFirstName); profiles.display_name is
//     only a fallback for an account with no roster row, so it is deliberately
//     NOT written here — that field is the staff/login name and belongs to
//     /admin/kiosk.
//   · Views that join live — bookings, lockers — follow the new name.
//   · ISSUED RECEIPTS DO NOT. membership_finance stores member_name_snap, a
//     snapshot at time of payment, which is correct: a receipt records who
//     paid under the name they paid under. Corrections there are made by
//     voiding and reissuing, never by editing.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TIERS = ['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']
const STATUSES = ['Active', 'Provisional', 'Lapsed', 'Pending Signature']
const MAX_FULL_NAME = 120
const MAX_NICKNAME = 60

/** Trim the ends and collapse runs of whitespace. Returns '' for nothing. */
const tidyName = (v: unknown): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''

export async function PATCH(req: Request, { params }: { params: Promise<{ member_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { member_no } = await params
  const p = await req.json().catch(() => null)
  if (!p) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  // NOTE: the members table has no updated_at column — don't set one.
  const patch: Record<string, unknown> = {}

  if ('full_name' in p) {
    const name = tidyName(p.full_name)
    // NOT NULL in the schema, and an unnamed member is not a record anybody
    // can use. Refused rather than coerced to something.
    if (!name) return NextResponse.json({ error: 'A member needs a name.' }, { status: 400 })
    if (name.length > MAX_FULL_NAME) {
      return NextResponse.json({ error: `Keep the name under ${MAX_FULL_NAME} characters.` }, { status: 400 })
    }
    patch.full_name = name
  }
  if ('nickname' in p) {
    // Clearing it is deliberate: plenty of members do not have one, and the
    // greeting falls back to the full name on its own.
    const nick = tidyName(p.nickname)
    if (nick.length > MAX_NICKNAME) {
      return NextResponse.json({ error: `Keep the nickname under ${MAX_NICKNAME} characters.` }, { status: 400 })
    }
    patch.nickname = nick || null
  }

  if ('tier' in p) {
    if (!TIERS.includes(p.tier)) return NextResponse.json({ error: 'Invalid tier.' }, { status: 400 })
    patch.tier = p.tier
  }
  if ('status' in p) {
    if (!STATUSES.includes(p.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
    patch.status = p.status
  }
  if ('join_date' in p) {
    if (p.join_date === null || p.join_date === '') patch.join_date = null
    else if (typeof p.join_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.join_date)) patch.join_date = p.join_date
    else return NextResponse.json({ error: 'Bad join date.' }, { status: 400 })
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  const a = svc()

  // Read the row BEFORE the write, so a rename can be logged as from → to.
  // A log entry saying only "the name changed" is not an audit trail.
  const before = ('full_name' in patch || 'nickname' in patch)
    ? (await a.from('members').select('full_name, nickname').eq('member_no', member_no).maybeSingle()).data
    : null

  const { data, error } = await a.from('members').update(patch)
    .eq('member_no', member_no)
    .select('member_no, full_name, nickname, tier, status, join_date').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A NAME CHANGE IS A CHANGE TO WHO SOMEBODY IS ON THE RECORD, so it goes on
  // the spine with the old value and the admin who made it. Emitted through
  // the SESSION client, because ops_emit_event stamps auth.uid() and that is
  // null under service-role — a service-role emit would record the change with
  // no actor, which is worse than not recording it.
  if (before && (patch.full_name !== undefined || patch.nickname !== undefined)) {
    const changed =
      (patch.full_name !== undefined && patch.full_name !== before.full_name) ||
      (patch.nickname !== undefined && patch.nickname !== before.nickname)
    if (changed) {
      const actor = await getActor()
      if (actor) {
        // object_id is a UUID column (ops_emit_event takes p_object_id uuid), and
        // member_no is 'TRC-M001' — passing it threw inside the RPC and
        // socialEmit's catch swallowed it, so the audit trail silently wrote
        // nothing while looking exactly like one that worked. The member_no
        // lives in the metadata, where it is queryable.
        await socialEmit(actor.sb, 'member.renamed', 'member', null, {
          member_no,
          full_name_from: before.full_name,
          full_name_to: data.full_name,
          nickname_from: before.nickname,
          nickname_to: data.nickname,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, member: data })
}
