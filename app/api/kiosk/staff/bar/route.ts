import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaff, denyDevice, denyStaff } from '@/lib/kiosk/server'

// THE BACK BAR, AS THE BAR SEES IT.
//
// There are two whisky screens on these tablets already and neither answers the
// bar's question. /kiosk/finder is the member's: what should I drink. The
// stocktake is the counter's: it walks the whole shelf bottle by bottle and is
// a job somebody is sent to do for an hour. Nobody could ask "how much of the
// Springbank is left, and what is about to run out tonight".
//
// So: WHAT IS LOW, first and without being asked, then search for one bottle.
// Low is the only part of this worth pushing at somebody — an empty bottle
// found by a member at the self-pour shelf is the failure this prevents.
//
// ── READ ONLY ─────────────────────────────────────────────────────────────
// Nothing here writes a fill. A level typed in while serving, outside a count,
// is how a stocktake stops meaning anything: the whole point of
// whisky_fill_history is that every number has a sitting and a name against it.
// The button on this screen goes to the stocktake, which does it properly.
//
// Fills come from the count, so a bottle nobody has counted reads "not counted"
// rather than 100% — a confident wrong number is worse here than an absence.

export const dynamic = 'force-dynamic'

/** At or below this, it wants replacing tonight. The stocktake's own tap
 *  targets are 0/25/50/75/100, so 25 is a level somebody actually recorded. */
const LOW_PCT = 25
const SEARCH_MAX = 12

const tidyAbv = (raw: string | null) => {
  if (!raw) return null
  const m = String(raw).match(/[\d.]+/)
  if (!m) return raw
  const n = Number(m[0])
  if (!Number.isFinite(n)) return raw
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`
}

export async function GET(req: Request) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actingStaff()
  if (!me) return denyStaff()

  const a = svc()
  const q = (new URL(req.url).searchParams.get('q') || '').trim()

  const cols = 'id, name, distillery, region, age, abv, tasting_notes, committees_pick, in_stock, current_fill_pct, last_fill_updated_at, last_fill_updated_email'

  // ── ONE BOTTLE ──────────────────────────────────────────────────────────
  if (q.length >= 2) {
    const like = `%${q.replace(/[%_,]/g, '')}%`
    const { data } = await a.from('whiskies').select(cols)
      .or(`name.ilike.${like},distillery.ilike.${like},region.ilike.${like}`)
      .order('name').limit(SEARCH_MAX)
    return NextResponse.json({ results: (data || []).map(shape) })
  }

  // ── THE SHELF ───────────────────────────────────────────────────────────
  const { data, error } = await a.from('whiskies').select(cols).order('name')
  if (error) return NextResponse.json({ error: 'Could not read the shelf.' }, { status: 500 })

  const all = (data || [])
  const open = all.filter(w => w.in_stock)
  const counted = open.filter(w => w.current_fill_pct != null)
  const low = counted.filter(w => (w.current_fill_pct as number) > 0 && (w.current_fill_pct as number) <= LOW_PCT)
  const empty = counted.filter(w => (w.current_fill_pct as number) === 0)

  // WHEN THE SHELF WAS LAST COUNTED, and by whom. A low list is only as good as
  // its date, and this is the one line that says whether to trust it.
  const last = counted.reduce<{ at: string; by: string | null } | null>((best, w) => {
    const at = w.last_fill_updated_at as string | null
    if (!at) return best
    return !best || at > best.at ? { at, by: w.last_fill_updated_email as string | null } : best
  }, null)

  return NextResponse.json({
    totals: {
      open: open.length,
      counted: counted.length,
      uncounted: open.length - counted.length,
      low: low.length,
      empty: empty.length,
      picks: open.filter(w => w.committees_pick).length,
    },
    last_counted: last,
    low: low.sort((x, y) => (x.current_fill_pct as number) - (y.current_fill_pct as number)).map(shape),
    empty: empty.map(shape),
    low_pct: LOW_PCT,
  })
}

type Row = {
  id: string; name: string; distillery: string | null; region: string | null
  age: string | null; abv: string | null; tasting_notes: string | null
  committees_pick: boolean | null; in_stock: boolean | null
  current_fill_pct: number | null; last_fill_updated_at: string | null; last_fill_updated_email: string | null
}

const shape = (w: Row) => ({
  id: w.id,
  name: (w.name || '').trim(),
  distillery: w.distillery,
  region: w.region,
  age: w.age,
  abv: tidyAbv(w.abv),
  notes: w.tasting_notes,
  pick: !!w.committees_pick,
  on_shelf: !!w.in_stock,
  fill_pct: w.current_fill_pct,
  counted_at: w.last_fill_updated_at,
  counted_by: w.last_fill_updated_email,
})
