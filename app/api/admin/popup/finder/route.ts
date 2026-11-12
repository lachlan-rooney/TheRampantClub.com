import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// THE POP-UP'S BOTTLE LIST — choosing what is on the table.
// ───────────────────────────────────────────────────────────────────────────
// Every bottle in the library that has a CONFIRMED flavour profile, for the
// owner to tick. The list it saves is what the offline finder ships to the
// tablets, so a bottle that is not on it cannot be recommended at the Palace.
//
// ══ WHAT "CONFIRMED" MEANS HERE, EXACTLY ═════════════════════════════════
// whisky_flavour_intensities.confirmed — the INTENSITY SPOKES, which are the
// only thing the matcher reads. Not whisky_flavour_tags.confirmed, which is
// the descriptor review queue and has no effect on a recommendation.
//
// As of tonight every one of the 296 profiled bottles is fully confirmed, so
// the two readings agree — but they will not always, and a screen that said
// "confirmed" while meaning a different column would be lying the first time
// somebody adds an unreviewed profile. A bottle with ANY unconfirmed spoke is
// listed separately and cannot be ticked.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } })

interface Int { whisky_id: string; category_slug: string; intensity: number; confirmed: boolean }

// ⚠ PAGED. PostgREST caps a select at 1000 rows and there are ~1,600 intensity
// rows. Taking the first page only would have silently dropped a third of the
// library's profiles — and the bottles that vanished would look like bottles
// with no flavour profile, which is exactly the wrong story to tell the owner.
async function allIntensities(a: ReturnType<typeof svc>): Promise<Int[]> {
  const out: Int[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await a.from('whisky_flavour_intensities')
      .select('whisky_id, category_slug, intensity, confirmed')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data as Int[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()

  // ⚠ A MISSING COLUMN ERRORS THE WHOLE SELECT, so `ev` comes back null and the
  // screen would have said "No pop-up is set up" — which is untrue and sends
  // somebody looking in the wrong place. The error is read and named.
  const { data: ev, error: evErr } = await a.from('popup_events')
    .select('id, title_en, finder_whisky_ids, finder_saved_at').eq('slug', SLUG).maybeSingle()
  if (evErr) {
    return NextResponse.json({
      error: /finder_whisky_ids/.test(evErr.message)
        ? 'The pop-up bottle list needs db/popup_finder_list.sql to be run first.'
        : evErr.message,
    }, { status: 500 })
  }
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  let ints: Int[]
  try { ints = await allIntensities(a) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }

  const byW = new Map<string, { spokes: Record<string, number>; confirmed: number; total: number }>()
  for (const r of ints) {
    const w = byW.get(r.whisky_id) || { spokes: {}, confirmed: 0, total: 0 }
    w.spokes[r.category_slug] = r.intensity
    w.total++; if (r.confirmed) w.confirmed++
    byW.set(r.whisky_id, w)
  }

  const { data: ws, error: wErr } = await a.from('whiskies')
    .select('id, name, distillery, region, age, abv, in_stock, committees_pick')
    .in('id', [...byW.keys()])
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

  const { data: cats } = await a.from('whisky_flavour_categories')
    .select('slug, name_en, name_vn, sort_order').order('sort_order')

  // Deduped by name, exactly as the live finder's index is — the catalogue
  // carries a few duplicate bottle rows and the owner must not tick one twice.
  const seen = new Set<string>()
  const bottles = (ws || [])
    .sort((x, y) => x.name.localeCompare(y.name))
    .filter(w => { if (seen.has(w.name)) return false; seen.add(w.name); return true })
    .map(w => {
      const f = byW.get(w.id)!
      return {
        id: w.id, name: w.name, distillery: w.distillery, region: w.region,
        age: w.age, abv: w.abv, in_stock: w.in_stock, pick: w.committees_pick,
        spokes: f.spokes, spoke_count: f.total,
        confirmed: f.confirmed === f.total,
        unconfirmed_spokes: f.total - f.confirmed,
      }
    })

  const chosen = (ev.finder_whisky_ids || []) as string[]
  const known = new Set(bottles.map(b => b.id))
  return NextResponse.json({
    event: { title: ev.title_en, saved_at: ev.finder_saved_at },
    bottles,
    categories: cats || [],
    chosen,
    // ⚠ A TICKED BOTTLE THAT NO LONGER EXISTS IS REPORTED, NOT DROPPED. Silently
    // shrinking a list the owner approved is how forty becomes thirty-eight
    // without anybody being told.
    missing: chosen.filter(id => !known.has(id)),
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  let body: { ids?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === 'string') as string[] : null
  if (!ids) return NextResponse.json({ error: 'Send the list.' }, { status: 400 })
  if (ids.length > 400) return NextResponse.json({ error: 'That is more bottles than the library has.' }, { status: 400 })

  // ⚠ EVERY ID IS CHECKED AGAINST A CONFIRMED PROFILE BEFORE IT IS SAVED. The
  // offline page ships whatever is in this column straight to a tablet; a
  // bottle with no profile would travel to the Palace and match nothing, and
  // the first anybody would know is a guest being told there is no answer.
  const { data: ok, error: okErr } = await a.from('whisky_flavour_intensities')
    .select('whisky_id, confirmed').in('whisky_id', ids)
  if (okErr) return NextResponse.json({ error: okErr.message }, { status: 500 })
  const good = new Set<string>()
  const bad = new Map<string, boolean>()
  for (const r of (ok || []) as { whisky_id: string; confirmed: boolean }[]) {
    if (r.confirmed) good.add(r.whisky_id); else bad.set(r.whisky_id, true)
  }
  const refused = ids.filter(id => !good.has(id) || bad.has(id))
  if (refused.length) {
    const { data: names } = await a.from('whiskies').select('name').in('id', refused)
    return NextResponse.json({
      error: `${refused.length} of those have no confirmed flavour profile and cannot go on the list.`,
      refused: (names || []).map(n => n.name),
    }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  const { error } = await a.from('popup_events').update({
    finder_whisky_ids: ids,
    finder_saved_at: new Date().toISOString(),
    finder_saved_by: user?.id ?? null,
  }).eq('slug', SLUG)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, saved: ids.length })
}
