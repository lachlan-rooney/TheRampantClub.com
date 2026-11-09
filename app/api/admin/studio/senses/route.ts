import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { SENSES } from '@/lib/studio/senses'

// WHAT THIS EXHIBITION DOES WITH EACH SENSE — the half that changes per show.
// The room's method lives in lib/studio/senses and is the same every time.
export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// THE VALID KEYS COME FROM senses.ts, not from a list retyped here. Add a
// sixth sense to that file and it is accepted the same day; a hardcoded set
// would quietly reject it and look like a database fault.
const KEYS = new Set(SENSES.map(s => s.en.toLowerCase()))
const CAP = 2000
const tidy = (v: unknown) => typeof v === 'string'
  ? (v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n').trim() || null)
  : null

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('collaboration')
  if (!id) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })
  // Its own request, and a failure is "nothing yet" — the table may not exist.
  const { data, error } = await svc().from('collaboration_senses')
    .select('sense, body_en, body_vn').eq('collaboration_id', id)
  if (error) return NextResponse.json({ senses: [], missing: true })
  return NextResponse.json({ senses: data || [] })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const sense = String(b.sense || '').toLowerCase()
  if (!b.collaboration_id) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })
  if (!KEYS.has(sense)) {
    return NextResponse.json({ error: `"${sense}" is not one of the five senses.` }, { status: 400 })
  }
  for (const f of ['body_en', 'body_vn'] as const) {
    if (f in b && typeof b[f] === 'string' && b[f].trim().length > CAP) {
      return NextResponse.json({
        error: `${f} is ${b[f].trim().length} characters; the limit is ${CAP}. Shorten it rather than let it be cut.`,
      }, { status: 400 })
    }
  }
  const row: Record<string, unknown> = { collaboration_id: b.collaboration_id, sense, updated_at: new Date().toISOString() }
  if ('body_en' in b) row.body_en = tidy(b.body_en)
  if ('body_vn' in b) row.body_vn = tidy(b.body_vn)

  const { error } = await svc().from('collaboration_senses')
    .upsert(row, { onConflict: 'collaboration_id,sense' })
  if (error) {
    return NextResponse.json({ error: `${error.message} — has db/collaboration_senses.sql been run?` }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
