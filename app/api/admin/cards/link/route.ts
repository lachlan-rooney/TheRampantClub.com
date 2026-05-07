import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { uid, member_id } = await req.json().catch(() => ({}))
  if (!uid || !member_id) {
    return NextResponse.json({ error: 'uid and member_id required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const normalisedUid = String(uid).toUpperCase()

  // Detach the UID from any other profile first (UID is globally unique).
  await supabase
    .from('profiles')
    .update({ card_uid: null, card_issued_at: null })
    .eq('card_uid', normalisedUid)

  const { error } = await supabase
    .from('profiles')
    .update({ card_uid: normalisedUid, card_issued_at: new Date().toISOString() })
    .eq('id', member_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { uid } = await req.json().catch(() => ({}))
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('profiles')
    .update({ card_uid: null, card_issued_at: null })
    .eq('card_uid', String(uid).toUpperCase())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
