import type { SupabaseClient } from '@supabase/supabase-js'
import { groupByVenue, type MenuPlate, type MenuSet, type MenuVenue, type MenuVenueGroup } from './types'

// ONE reader, two callers.
//
// The member portal passes its browser client and reads the views under
// `authenticated`; the kiosk passes the service-role client from a route that
// has already checked the device token, because a tablet in the Library has no
// user session to read with.
//
// Both go through the same two views, which is the point: there is exactly one
// definition of "what a menu looks like from outside", and it is the one that
// does not select a cost column.

export interface MenuData {
  venues: MenuVenueGroup[]
  /** True when nothing is published yet — the surfaces show a proper empty
   *  state rather than an empty page that looks broken. */
  empty: boolean
}

export async function readMenus(sb: SupabaseClient): Promise<MenuData> {
  // THREE reads, and the venues one is not optional. The dish views join from
  // menu_items OUT to the venue, so a restaurant with nothing on it produces no
  // rows at all — which is how Le Corto silently disappeared, and why a
  // restaurant announced but not yet open could not be shown. The venues are
  // the spine; the dishes hang off them.
  const [venueRows, plates, sets] = await Promise.all([
    sb.from('menu_venues_public').select('*').order('display_order'),
    sb.from('menu_plates_public').select('*').order('venue_order').order('display_order'),
    sb.from('menu_dining_public').select('*').order('venue_order').order('display_order'),
  ])

  // A failed read of the DISHES is not an empty menu. Surfacing it as empty
  // would have the kiosk quietly show "nothing on tonight" during service.
  if (plates.error) throw new Error(plates.error.message)
  if (sets.error) throw new Error(sets.error.message)

  const plateRows = (plates.data ?? []) as MenuPlate[]
  const setRows = (sets.data ?? []) as MenuSet[]

  // ── THE VENUES VIEW IS ALLOWED TO BE MISSING ────────────────────────────
  // A deploy reaches production before somebody runs the migration, and for
  // about an hour this exact gap took the menu down on the tablets and in the
  // members' portal mid-afternoon. Code that needs a new view must survive not
  // having it yet: we fall back to deriving the restaurants from the dish rows,
  // which is precisely how this worked before the view existed.
  //
  // What is lost in the fallback is what only the view carries — the arriving
  // date, and restaurants that have no dishes at all. Both fail SAFE: a
  // restaurant shows its food without its "arriving" line, rather than the
  // whole menu showing nothing.
  const venueRecords: MenuVenue[] = venueRows.error
    ? deriveVenues(plateRows, setRows)
    : (venueRows.data ?? []) as MenuVenue[]

  const venues = groupByVenue(venueRecords, plateRows, setRows)
  return { venues, empty: venues.every(v => !v.plates.length && !v.sets.length) }
}

/** The restaurants implied by the dishes, for when the venues view is not
 *  there. Deliberately private to this file: it is a safety net, not an API. */
function deriveVenues(plates: MenuPlate[], sets: MenuSet[]): MenuVenue[] {
  const byslug = new Map<string, MenuVenue>()
  for (const r of [...plates, ...sets]) {
    if (byslug.has(r.venue_slug)) continue
    byslug.set(r.venue_slug, {
      slug: r.venue_slug, name: r.venue_name, kind: r.venue_kind,
      tagline_en: r.venue_tagline_en, tagline_vn: r.venue_tagline_vn,
      logo_path: r.venue_logo_path, accent_hex: r.venue_accent_hex,
      arriving_on: null, display_order: r.venue_order, is_placeholder: false,
    })
  }
  return [...byslug.values()]
}
