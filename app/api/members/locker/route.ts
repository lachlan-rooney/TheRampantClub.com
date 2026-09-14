import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/members/locker → the LOGGED-IN member's locker(s) on the wall.
// (2026-09-14) The portal used to read profiles.locker_number — free text that
// no one ever filled in (every member saw "—") and that members could write
// themselves through the self-update policy. The locker wall (`lockers`, staff
// managed at /admin/lockers) is the one source now.
//
// lockers + locker_contents RLS is admin-only; resolve session →
// profiles.member_no and return only that member's lockers via service-role.
// A member may hold more than one, so this is always an array. Member-safe
// fields only — NO staff notes, positions, or bottle notes.
// Not linked, or no locker → an empty array, not an error: that is a normal
// member, not a failure.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ lockers: [] })

  // Retired lockers are off the wall — a member does not "hold" one.
  const { data: lockers, error } = await sb.from('lockers')
    // Not `label`: it is free text staff write on the wall ("Brandon", "MERCH",
    // a guest's name in the notes' spirit) — a staff note, not member-facing.
    .select('locker_no')
    .eq('member_no', prof.member_no)
    .neq('status', 'retired')
    .order('locker_no', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!lockers?.length) return NextResponse.json({ lockers: [] })

  const { data: contents, error: cErr } = await sb.from('locker_contents')
    .select('locker_no, bottle_name, fill_pct')
    .in('locker_no', lockers.map(l => l.locker_no))
    .order('added_at', { ascending: true })
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  return NextResponse.json({
    lockers: lockers.map(l => ({
      locker_no: l.locker_no,
      bottles: (contents || [])
        .filter(c => c.locker_no === l.locker_no)
        .map(c => ({ bottle_name: c.bottle_name, fill_pct: c.fill_pct })),
    })),
  })
}
