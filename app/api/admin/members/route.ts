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
  admitted_at: string | null
  locker_number: string | null
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
    .select('id, display_name, member_number, admitted_at, locker_number, preferred_dram, is_admin')

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
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
    locker_number: p.locker_number,
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
