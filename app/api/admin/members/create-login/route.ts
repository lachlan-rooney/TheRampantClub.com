import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/members/create-login?member_no=TRC-M001  → { linked, email }
// POST /api/admin/members/create-login { member_no, email } → creates the member's
//      login (temp password, must-change-on-first-login) + links profile.member_no.
//
// SECURITY (Phase 0b):
//  • admin-gated (isAdmin + the 0c /admin middleware gate) + service-role.
//  • the temp password is generated, returned ONCE in the POST response for the
//    admin to relay, and NEVER stored or logged (not in the DB, not in
//    activity_events, not in console).
//  • the account is flagged app_metadata.must_change_password=true (admin-only,
//    the member can't self-clear) → middleware forces a password change on first
//    login before any member page renders.
//  • members are is_admin=false; 0c's RLS prevents them self-promoting / re-linking.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Strong generated temp password. Never persisted; shown once. base64url gives
// A–Za–z0–9-_; the 'Trc-' prefix guarantees upper+lower+symbol presence.
function genTempPassword(): string {
  return `Trc-${randomBytes(15).toString('base64url')}`
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const member_no = req.nextUrl.searchParams.get('member_no')
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('id, member_no').eq('member_no', member_no).maybeSingle()
  if (!prof) return NextResponse.json({ linked: false })
  // Pull the linked account's email from auth for display.
  const { data: u } = await sb.auth.admin.getUserById(prof.id)
  return NextResponse.json({ linked: true, email: u?.user?.email || null })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { member_no?: unknown; email?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const member_no = String(body.member_no || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })

  const sb = svc()

  // Member record must exist.
  const { data: member } = await sb.from('members').select('member_no, full_name').eq('member_no', member_no).maybeSingle()
  if (!member) return NextResponse.json({ error: `No member record ${member_no}.` }, { status: 404 })

  // Double-link guard: this member can have only one login.
  const { data: existing } = await sb.from('profiles').select('id').eq('member_no', member_no).maybeSingle()
  if (existing) return NextResponse.json({ error: `${member_no} already has a linked login. Remove it before creating another.` }, { status: 409 })

  // Create the auth user with a generated temp password + must-change flag.
  const temp_password = genTempPassword()
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  })
  if (createErr || !created?.user) {
    const msg = /already.*registered|already exists|duplicate/i.test(createErr?.message || '')
      ? `That email already has an account. Use a different email or link the existing account.`
      : (createErr?.message || 'Could not create the login.')
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  // Link the profile (trigger may auto-create it; upsert covers both cases).
  // is_admin=false — a member; 0c RLS prevents self-escalation regardless.
  const { error: linkErr } = await sb.from('profiles').upsert({
    id: created.user.id,
    member_no,
    is_admin: false,
    display_name: member.full_name,
  }, { onConflict: 'id' })
  if (linkErr) {
    // Roll back the auth user so we don't leave an unlinked orphan login.
    await sb.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: `Created the account but linking failed (${linkErr.message}). Rolled back — try again.` }, { status: 500 })
  }

  // temp_password returned ONCE here — never persisted, never logged.
  return NextResponse.json({ ok: true, email, member_no, temp_password })
}
