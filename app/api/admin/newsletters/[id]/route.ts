import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { NEWSLETTER_SECTIONS } from '@/lib/newsletter/render'

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const SECTION_KEYS = NEWSLETTER_SECTIONS.map(s => s.key)
const EDITABLE = new Set(['draft', 'pending_approval'])

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data, error } = await svc().from('newsletters').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ newsletter: data })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const a = svc()

  const { data: row } = await a.from('newsletters').select('status, sections').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!EDITABLE.has(row.status)) return NextResponse.json({ error: 'This newsletter is locked (already approved/sent).' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.subject === 'string') { const s = body.subject.trim(); if (!s) return NextResponse.json({ error: 'Subject required' }, { status: 400 }); patch.subject = s.slice(0, 200) }
  if ('hero_image' in body) patch.hero_image = body.hero_image ? String(body.hero_image).trim().slice(0, 120) : null
  if (body.sections && typeof body.sections === 'object') {
    const next: Record<string, string> = { ...(row.sections || {}) }
    for (const k of SECTION_KEYS) if (k in body.sections) next[k] = String(body.sections[k] ?? '').slice(0, 8000)
    patch.sections = next
  }

  const { error } = await a.from('newsletters').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await a.from('newsletter_activity').insert({ newsletter_id: id, actor: user?.id || null, event_type: 'edited', note: 'Content edited.' })
  return NextResponse.json({ ok: true })
}
