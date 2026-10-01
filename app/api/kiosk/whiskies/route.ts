import { NextResponse } from 'next/server'
import { svc, deviceOk } from '@/lib/kiosk/server'

// WHAT THE BAR CAN POUR TONIGHT — the shelf, for the room tablet.
//
// Owner, 2026-09-25: "with a list of the current whisky stock on a tab too."
// The club holds 336 bottles and the tablet knew about none of them; the bar
// tab even told members the whisky list was "a separate thing entirely — ask
// for it", which on a screen standing on the bar is an odd thing to say.
//
// IN STOCK ONLY. `in_stock` is the flag staff keep, and an empty bottle on a
// menu is worse than no menu — a member asks for it, and the answer is no.
// Thirty of the 336 are out at the time of writing.
//
// AND AN EMPTY BOTTLE IS OUT, whatever the flag says. Four bottles are flagged
// in stock and read 0% full — `in_stock` is a thing somebody remembers to
// change and a fill reading is a thing somebody measures, so the list believes
// the measurement. A null fill means nobody has measured it, which is not the
// same as empty, so those stay.
//
// COLUMNS: the label, where it is from, how strong, and the club's own note.
// NOT current_fill_pct — how little is left in a bottle is the bar's business
// and reads, on a menu, as a reason not to order it. NOT added_at, NOT who
// last topped it up, and there is no cost column on this table at all.
//
// DEVICE-GATED, like the menu. No member session is needed: the shelf is the
// same for everyone in the room, and nothing here belongs to anybody.

export const dynamic = 'force-dynamic'

// Held for five minutes. A bottle runs out a handful of times a week, not a
// handful of times a minute, and every tablet in the building asks for the
// same 300 rows. (The board's own cache note explains the shape.)
type Dram = {
  id: string; name: string; distillery: string | null; region: string | null
  age: string | null; abv: string | null; notes: string | null; pick: boolean
}
let cached: { at: number; rows: Dram[] } | null = null
const TTL = 5 * 60_000

function tidyAbv(raw: string | number | null): string | null {
  if (raw === null || raw === undefined) return null
  // A comma for a decimal point. Some of these were typed from European labels
  // — "57,3%" — and Number() reads that as NaN, so the strength fell through
  // untidied and sat on the shelf list in a different notation from the bottle
  // beside it.
  const txt = String(raw).trim().replace(/%+$/, '').replace(',', '.')
  if (!txt) return null
  const n = Number(txt)
  if (!Number.isFinite(n)) return String(raw).trim() || null
  return `${parseFloat(n.toFixed(2))}%`
}

export async function GET() {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })

  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json({ whiskies: cached.rows, cached: true })
  }

  const { data, error } = await svc()
    .from('whiskies')
    .select('id, name, distillery, region, age, abv, tasting_notes, committees_pick')
    .eq('in_stock', true)
    .or('current_fill_pct.is.null,current_fill_pct.gt.0')
    .order('name')
  if (error) return NextResponse.json({ error: 'Could not read the shelf.' }, { status: 500 })

  const rows: Dram[] = (data || []).map(w => ({
    id: w.id,
    name: (w.name || '').trim(),
    distillery: w.distillery,
    region: w.region,
    age: w.age,
    // The spreadsheet these came from wrote some strengths as "50.00%%", and
    // most of the rest as "40.00%". Cleaned here rather than on the tablet, so
    // every surface that reads this route gets the same tidy string — 40%, and
    // 48.9% where the decimal means something. Anything unparseable is passed
    // through rather than dropped: a strange strength is still information.
    abv: tidyAbv(w.abv),
    notes: w.tasting_notes,
    pick: !!w.committees_pick,
  }))

  cached = { at: Date.now(), rows }
  return NextResponse.json({ whiskies: rows })
}
