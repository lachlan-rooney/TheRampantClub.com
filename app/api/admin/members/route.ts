import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// Replaces the public.member_list view, which was flagged by Supabase as
// exposing auth.users data via a SECURITY DEFINER view to anon / authenticated.
// This endpoint requires the caller to be an admin (cookie session checked
// server-side) before joining profiles with auth.users via the service role.

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  display_name: string | null
  member_number: number | null
  member_no: string | null
  admitted_at: string | null
  preferred_dram: string | null
  is_admin: boolean | null
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Profiles
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, display_name, member_number, member_no, admitted_at, preferred_dram, is_admin')

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  // 1b. Lockers, read-only, from the wall (2026-09-14). profiles.locker_number
  // was a second, empty source that members could write themselves; the wall
  // is the one place a locker is assigned, so this page only points at it.
  const { data: wall, error: wallError } = await admin
    .from('lockers')
    .select('locker_no, member_no')
    .not('member_no', 'is', null)
    .neq('status', 'retired')
    .order('locker_no', { ascending: true })

  if (wallError) {
    return NextResponse.json({ error: wallError.message }, { status: 500 })
  }
  const lockersByMemberNo = new Map<string, string[]>()
  for (const l of wall || []) {
    const list = lockersByMemberNo.get(l.member_no) || []
    list.push(l.locker_no)
    lockersByMemberNo.set(l.member_no, list)
  }

  // 2. Auth users — listUsers is paginated; iterate.
  const emailById = new Map<string, string>()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email)
    }
    if (data.users.length < 1000) break
    page += 1
  }

  // 3. Merge
  const members = (profiles as ProfileRow[]).map(p => ({
    id: p.id,
    email: emailById.get(p.id) || '',
    display_name: p.display_name,
    member_number: p.member_number,
    admitted_at: p.admitted_at,
    lockers: p.member_no ? (lockersByMemberNo.get(p.member_no) || []) : [],
    preferred_dram: p.preferred_dram,
    is_admin: p.is_admin === true,
  }))

  // Sort by member_number (nulls last), matching the previous ORDER BY.
  members.sort((a, b) => {
    if (a.member_number == null && b.member_number == null) return 0
    if (a.member_number == null) return 1
    if (b.member_number == null) return -1
    return a.member_number - b.member_number
  })

  return NextResponse.json({ members })
}
