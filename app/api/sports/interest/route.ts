import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const sport = String(body.sport || '').trim().slice(0, 40)
  const email = String(body.email || '').trim().slice(0, 200)
  const name = body.name ? String(body.name).slice(0, 120) : null
  const note = body.note ? String(body.note).slice(0, 500) : null

  if (!sport || !email) {
    return NextResponse.json({ error: 'sport and email are required' }, { status: 400 })
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('sports_interest')
    .insert({ sport, email, name, note, user_id: user?.id || null })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
