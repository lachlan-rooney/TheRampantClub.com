import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// THE MENU EDITOR'S ONE ROUTE.
//
// Four verbs, four kinds (venue / item / set / course), dispatched on `kind`
// the way /api/admin/studio does. Every handler gates on isAdmin() first —
// there is no middleware doing it, by design, so the check is visible in each
// function.
//
// This is the ONLY place that reads the base tables, and so the only place
// `cost_vnd` exists. The member portal and the kiosk read views that do not
// have the column. Keep it that way: if a cost ever needs to go somewhere new,
// the question to ask is whether that somewhere is behind isAdmin().

export const dynamic = 'force-dynamic'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// Field allowlists. A PATCH body is never spread into the table — a whitelist
// here is what stops a stray `id` or `created_at` in a form payload from
// rewriting a primary key, and it is why adding a column means editing this
// list on purpose rather than discovering later that edits were silently lost.
const FIELDS: Record<string, string[]> = {
  venue: [
    'slug', 'name', 'kind', 'tagline_en', 'tagline_vn', 'logo_path', 'accent_hex',
    'contact_name', 'contact_phone', 'contact_email', 'contact_note',
    'display_order', 'is_active', 'is_placeholder',
  ],
  item: [
    'venue_id', 'slug', 'name_en', 'name_vn', 'description_en', 'description_vn',
    'allergens', 'dietary', 'allergens_confirmed', 'photo_path',
    'price_vnd', 'cost_vnd', 'lead_time_minutes',
    'availability_en', 'availability_vn',
    'display_order', 'is_active', 'is_placeholder',
  ],
  set: [
    'venue_id', 'slug', 'name_en', 'name_vn', 'standfirst_en', 'standfirst_vn',
    'price_per_head_vnd', 'cost_per_head_vnd', 'min_covers', 'notice_hours',
    'display_order', 'is_active', 'is_placeholder',
  ],
  course: [
    'set_menu_id', 'course_en', 'course_vn', 'dish_en', 'dish_vn',
    'note_en', 'note_vn', 'allergens', 'dietary', 'allergens_confirmed', 'display_order',
  ],
}

const TABLE: Record<string, string> = {
  venue: 'menu_venues',
  item: 'menu_items',
  set: 'menu_set_menus',
  course: 'menu_set_courses',
}

/** Keep only allowed fields, and turn '' into null so an emptied text box
 *  clears the column instead of storing a blank string that renders as a gap. */
function clean(kind: string, body: Record<string, unknown>): Record<string, unknown> {
  const allowed = FIELDS[kind]
  const out: Record<string, unknown> = {}
  for (const k of allowed) {
    if (!(k in body)) continue
    const v = body[k]
    out[k] = typeof v === 'string' && v.trim() === '' ? null : v
  }
  return out
}

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s })

// ── Read everything, costs included ────────────────────────────────────────

export async function GET() {
  if (!(await isAdmin())) return bad('Staff only.', 403)
  const sb = svc()

  const [venues, items, sets, courses, audit] = await Promise.all([
    sb.from('menu_venues').select('*').order('display_order'),
    sb.from('menu_items').select('*').order('display_order'),
    sb.from('menu_set_menus').select('*').order('display_order'),
    sb.from('menu_set_courses').select('*').order('display_order'),
    sb.rpc('menu_placeholder_audit'),
  ])

  const firstErr = [venues, items, sets, courses].find(r => r.error)?.error
  if (firstErr) return bad(firstErr.message, 500)

  return NextResponse.json({
    venues: venues.data ?? [],
    items: items.data ?? [],
    sets: sets.data ?? [],
    courses: courses.data ?? [],
    // Not fatal if it fails — the function is new and the surface should still
    // load on a database where the migration has only half run.
    audit: audit.error ? [] : (audit.data ?? []),
  })
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return bad('Staff only.', 403)
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const kind = String(body?.kind || '')
  if (!body || !TABLE[kind]) return bad('Unknown kind.')

  const sb = svc()
  const row = clean(kind, body)

  // A slug nobody typed, derived from the name. Menus get edited in a hurry
  // during service; asking for a slug is asking for a blank one.
  if (kind !== 'course' && !row.slug) {
    const from = String(row.name_en || row.name || '')
    row.slug = from.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `new-${Date.now()}`
  }
  if (kind === 'item' && !row.name_en) return bad('A dish needs a name.')
  if (kind === 'set' && !row.name_en) return bad('A set menu needs a name.')
  if (kind === 'course' && !row.dish_en) return bad('A course needs a dish.')
  if (kind === 'venue' && !row.name) return bad('A restaurant needs a name.')

  // New rows go to the end of whatever list they belong to.
  if (row.display_order === undefined) {
    const parent = kind === 'course' ? 'set_menu_id' : kind === 'venue' ? null : 'venue_id'
    const q = sb.from(TABLE[kind]).select('display_order')
      .order('display_order', { ascending: false }).limit(1)
    const { data } = parent && row[parent] ? await q.eq(parent, row[parent] as string) : await q
    row.display_order = ((data?.[0]?.display_order as number) ?? 0) + 10
  }

  const { data, error } = await sb.from(TABLE[kind]).insert(row).select('*').single()
  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true, row: data })
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return bad('Staff only.', 403)
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const kind = String(body?.kind || '')
  const id = String(body?.id || '')
  if (!body || !TABLE[kind]) return bad('Unknown kind.')
  if (!id) return bad('Which row?')

  // Reordering: the page sends two rows with their display_order swapped, the
  // same move the studio editor makes. Two updates, not a transaction — the
  // worst case is two dishes sharing a position for a moment, which sorts by
  // name and corrects on the next move.
  const patch = clean(kind, body)
  if (!Object.keys(patch).length) return bad('Nothing to change.')

  const { data, error } = await svc().from(TABLE[kind]).update(patch).eq('id', id).select('*').single()
  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true, row: data })
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return bad('Staff only.', 403)
  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind') || ''
  const id = searchParams.get('id') || ''
  if (!TABLE[kind]) return bad('Unknown kind.')
  if (!id) return bad('Which row?')

  // Venues and set menus cascade to their children in the schema. That is the
  // right behaviour — a restaurant that pulls out takes its dishes with it —
  // but the UI confirms by name before calling this.
  const { error } = await svc().from(TABLE[kind]).delete().eq('id', id)
  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true })
}
