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

  // A failed read is not an empty menu. Surfacing it as empty would have the
  // kiosk quietly show "nothing on tonight" during service.
  if (venueRows.error) throw new Error(venueRows.error.message)
  if (plates.error) throw new Error(plates.error.message)
  if (sets.error) throw new Error(sets.error.message)

  const venues = groupByVenue(
    (venueRows.data ?? []) as MenuVenue[],
    (plates.data ?? []) as MenuPlate[],
    (sets.data ?? []) as MenuSet[],
  )
  return { venues, empty: venues.every(v => !v.plates.length && !v.sets.length) }
}
