import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { member_id, display_name, member_number, locker_number } = await req.json().catch(() => ({}))
  if (!member_id) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: display_name ?? null,
      member_number: member_number ?? null,
      locker_number: locker_number ?? null,
    })
    .eq('id', member_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
