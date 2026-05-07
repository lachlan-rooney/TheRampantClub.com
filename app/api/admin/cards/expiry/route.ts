import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { member_number, expires_at } = await req.json().catch(() => ({}))
  if (!member_number) {
    return NextResponse.json({ error: 'member_number required' }, { status: 400 })
  }

  // expires_at: ISO string, or null to clear
  const value = expires_at ? new Date(expires_at).toISOString() : null

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('member_cards')
    .update({ expires_at: value, updated_at: new Date().toISOString() })
    .eq('member_number', String(member_number).trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, expires_at: value })
}
