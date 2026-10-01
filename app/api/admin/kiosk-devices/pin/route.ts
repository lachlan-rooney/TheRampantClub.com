import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { svc } from '@/lib/kiosk/server'

// Admin manages staff PINs (the picker attribution). GET = the staff roster with
// whether each has a PIN. POST = set a PIN (hashed in the DB fn; never plaintext).
// The set_team_member_pin fn checks is_admin_uid(auth.uid()), so it's called via
// the admin's SESSION client (not service role, whose auth.uid() is null).
//
// PATCH (2026-10-01) = the person's EMAIL ADDRESS and whether they want the
// morning task digest. An address here is somewhere to write to; it is not a
// login, grants nothing, and is checked for access nowhere. It lives on this
// route rather than a new one because this is already the staff roster, and the
// screen that edits a PIN is the screen that will edit an address.
//
// The address is NOT returned in full by GET... it is. Deliberately: an admin
// who cannot see the address cannot tell whether it is the right one, and the
// whole page is behind isAdmin() already. What GET must never do is hand an
// address to the tablet — and it does not; kiosk_staff_roster() returns three
// columns and the shelf of them does not include this one.

export const dynamic = 'force-dynamic'

type Row = {
  id: string; display_name: string; role_title: string | null; active: boolean; pin_hash: string | null
  email?: string | null; email_reminders?: boolean | null; last_digest_on?: string | null
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  // Asked for WITH the email columns, and asked for again without them if the
  // migration has not been run yet, so the page keeps working (PINs and all)
  // on a database that has not caught up. `emails_ready` tells the page which
  // of the two it got, so it can say so rather than showing empty boxes that
  // silently refuse to save.
  const sb = svc()
  const full = 'id, display_name, role_title, active, pin_hash, email, email_reminders, last_digest_on'
  let emails_ready = true
  const first = await sb.from('team_members').select(full).order('display_name')
  let data: Row[] = (first.data || []) as Row[]
  if (first.error) {
    emails_ready = false
    const fallback = await sb.from('team_members').select('id, display_name, role_title, active, pin_hash').order('display_name')
    data = (fallback.data || []) as Row[]
  }
  return NextResponse.json({
    emails_ready,
    staff: data.map(t => ({
      id: t.id, display_name: t.display_name, role_title: t.role_title, active: t.active,
      has_pin: !!t.pin_hash,
      email: t.email ?? null,
      email_reminders: t.email_reminders ?? true,
      last_digest_on: t.last_digest_on ?? null,
    })),
  })
}

// The address, and the person's own off switch.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { team_member_id, email, email_reminders } = await req.json().catch(() => ({}))
  if (typeof team_member_id !== 'string') return NextResponse.json({ error: 'Pick a person.' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (email !== undefined) {
    const v = typeof email === 'string' ? email.trim().toLowerCase() : ''
    // Empty clears it — "we do not have one" has to be sayable, or a typo is
    // permanent. The same shape the DB constraint checks, checked here too so
    // the person gets a sentence rather than a Postgres error.
    if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 })
    }
    patch.email = v || null
  }
  if (typeof email_reminders === 'boolean') patch.email_reminders = email_reminders
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { error } = await svc().from('team_members').update(patch).eq('id', team_member_id)
  if (error) {
    if (/team_members_email_unique/.test(error.message)) {
      return NextResponse.json({ error: 'Somebody else already has that address.' }, { status: 400 })
    }
    // PostgREST does not say "column does not exist" on a write — it says
    // PGRST204, "Could not find the 'email' column … in the schema cache".
    // Matching only the Postgres wording left the one error this page is most
    // likely to hit reading "Could not save that."
    if (error.code === 'PGRST204' || /column .* does not exist/i.test(error.message)
        || /schema cache/i.test(error.message)) {
      return NextResponse.json({ error: 'Run db/staff_emails.sql first — the address columns are not there yet.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { team_member_id, pin } = await req.json().catch(() => ({}))
  if (typeof team_member_id !== 'string' || typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4–8 digits.' }, { status: 400 })
  }
  const sb = await createServerSupabaseClient()
  const { error } = await sb.rpc('set_team_member_pin', { p_team_member: team_member_id, p_pin: pin })
  if (error) return NextResponse.json({ error: 'Could not set the PIN.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
