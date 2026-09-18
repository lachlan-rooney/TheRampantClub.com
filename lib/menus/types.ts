// The shapes the menu surfaces read. These mirror the two public views in
// 20260918210000_menus.sql exactly — and, just as deliberately, they have no
// `cost_vnd` / `cost_per_head_vnd` field at all. If a cost ever needs to reach
// an admin screen it gets its own type in the admin route, so that a careless
// `{...item}` spread on a member page cannot carry one along.

export type Allergen =
  | 'gluten' | 'crustaceans' | 'eggs' | 'fish' | 'peanuts' | 'soy' | 'dairy'
  | 'nuts' | 'celery' | 'mustard' | 'sesame' | 'sulphites' | 'lupin' | 'molluscs'

export type Dietary = 'vegetarian' | 'vegan' | 'pork' | 'alcohol' | 'raw' | 'spicy'

export const ALLERGENS: Allergen[] = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'dairy',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs',
]

export const DIETARY: Dietary[] = ['vegetarian', 'vegan', 'pork', 'alcohol', 'raw', 'spicy']

// Both languages, because these appear on a menu a member reads, not in an
// admin table. The Vietnamese is mine and wants Miss Châu's eye before service.
export const ALLERGEN_LABEL: Record<Allergen, [string, string]> = {
  gluten: ['Gluten', 'Gluten'],
  crustaceans: ['Crustaceans', 'Giáp xác'],
  eggs: ['Egg', 'Trứng'],
  fish: ['Fish', 'Cá'],
  peanuts: ['Peanuts', 'Đậu phộng'],
  soy: ['Soy', 'Đậu nành'],
  dairy: ['Dairy', 'Sữa'],
  nuts: ['Tree nuts', 'Các loại hạt'],
  celery: ['Celery', 'Cần tây'],
  mustard: ['Mustard', 'Mù tạt'],
  sesame: ['Sesame', 'Vừng'],
  sulphites: ['Sulphites', 'Sulphite'],
  lupin: ['Lupin', 'Đậu lupin'],
  molluscs: ['Molluscs', 'Động vật thân mềm'],
}

export const DIETARY_LABEL: Record<Dietary, [string, string]> = {
  vegetarian: ['Vegetarian', 'Món chay'],
  vegan: ['Vegan', 'Thuần chay'],
  pork: ['Contains pork', 'Có thịt heo'],
  alcohol: ['Contains alcohol', 'Có cồn'],
  raw: ['Served raw', 'Dùng sống'],
  spicy: ['Spicy', 'Cay'],
}

export interface MenuVenueFields {
  venue_slug: string
  venue_name: string
  venue_kind: 'partner' | 'house'
  venue_tagline_en: string | null
  venue_tagline_vn: string | null
  venue_logo_path: string | null
  venue_accent_hex: string | null
  venue_order: number
}

/** A small dish, served anywhere in the venue. */
export interface MenuPlate extends MenuVenueFields {
  id: string
  slug: string
  /** Optional named group within one restaurant — Livannah run a skewer list
   *  and a nori taco list. Null where a restaurant offers a single list, and
   *  the board draws no heading in that case. */
  section_en: string | null
  section_vn: string | null
  name_en: string
  name_vn: string | null
  description_en: string | null
  description_vn: string | null
  allergens: Allergen[]
  dietary: Dietary[]
  allergens_confirmed: boolean
  photo_path: string | null
  price_vnd: number | null
  lead_time_minutes: number | null
  availability_en: string | null
  availability_vn: string | null
  display_order: number
  is_placeholder: boolean
}

export interface MenuCourse {
  id: string
  course_en: string | null
  course_vn: string | null
  dish_en: string
  dish_vn: string | null
  note_en: string | null
  note_vn: string | null
  allergens: Allergen[]
  dietary: Dietary[]
  allergens_confirmed: boolean
}

/** A set menu, cooked in the dining room, sat down. */
export interface MenuSet extends MenuVenueFields {
  id: string
  slug: string
  name_en: string
  name_vn: string | null
  standfirst_en: string | null
  standfirst_vn: string | null
  price_per_head_vnd: number | null
  min_covers: number | null
  notice_hours: number | null
  display_order: number
  is_placeholder: boolean
  courses: MenuCourse[]
}

/** A restaurant as the venues view returns it. */
export interface MenuVenue {
  slug: string
  name: string
  kind: 'partner' | 'house'
  tagline_en: string | null
  tagline_vn: string | null
  logo_path: string | null
  accent_hex: string | null
  /** Set while a restaurant is announced but not yet serving. */
  arriving_on: string | null
  display_order: number
  is_placeholder: boolean
}

/** One restaurant with everything it offers, ready to render. */
export interface MenuVenueGroup {
  slug: string
  name: string
  kind: 'partner' | 'house'
  tagline_en: string | null
  tagline_vn: string | null
  logo_path: string | null
  accent_hex: string | null
  arriving_on: string | null
  plates: MenuPlate[]
  sets: MenuSet[]
}

/** Storage paths are bare (`logos/el-gaucho.webp`); anything already absolute
 *  (`/images/...`, `https://...`) is left alone, so art committed to the repo
 *  and art uploaded by staff can sit side by side on the same menu. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('/') || path.startsWith('http')) return path
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/menu-media/${path}` : null
}

/** Hang the dishes off the restaurants — NOT the other way round.
 *
 *  This used to build the list of restaurants by looking at what rows came
 *  back from the dishes view, which meant a restaurant with nothing on it
 *  simply did not exist. That is why Le Corto disappeared, and it is why a
 *  restaurant that has been announced but has not opened could not be shown
 *  at all. The venues are now the spine. */
export function groupByVenue(
  venues: MenuVenue[], plates: MenuPlate[], sets: MenuSet[],
): MenuVenueGroup[] {
  const byslug = new Map<string, MenuVenueGroup>()

  for (const v of [...venues].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))) {
    byslug.set(v.slug, {
      slug: v.slug, name: v.name, kind: v.kind,
      tagline_en: v.tagline_en, tagline_vn: v.tagline_vn,
      logo_path: v.logo_path, accent_hex: v.accent_hex,
      arriving_on: v.arriving_on,
      plates: [], sets: [],
    })
  }

  for (const p of plates) byslug.get(p.venue_slug)?.plates.push(p)
  for (const s of sets) byslug.get(s.venue_slug)?.sets.push(s)

  for (const g of byslug.values()) {
    g.plates.sort((a, b) => a.display_order - b.display_order || a.name_en.localeCompare(b.name_en))
    g.sets.sort((a, b) => a.display_order - b.display_order || a.name_en.localeCompare(b.name_en))
  }

  return [...byslug.values()]
}

/** "Arriving 23 September", in the reader's language. Null once the day has
 *  come, so a date nobody remembered to clear stops announcing the past. */
export function arriving(iso: string | null, lang: 'en' | 'vn'): string | null {
  if (!iso) return null
  // Compared at Ho Chi Minh City's date, not the browser's.
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))
  const when = new Date(iso + 'T00:00:00')
  if (when <= today) return null
  const d = when.toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB',
    { day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' })
  return lang === 'vn' ? `Sẽ phục vụ từ ${d}` : `Arriving ${d}`
}

/** Prices the way the club's own printed menus write them: "350K VND".
 *
 *  Taken from the Library Bar menu rather than invented, so the tablet on the
 *  table and the card beside it agree.
 *
 *  Above a million it switches to the full number — "1.850K VND" is ambiguous
 *  to an English reader, who sees 1.85K, while "1.850.000 VND" reads correctly
 *  in both languages. Under a million the K form is unambiguous and shorter.
 *
 *  `null` is "price on request" — never 0, which would read as free. */
export function price(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  if (v >= 1_000_000) return new Intl.NumberFormat('vi-VN').format(v) + ' VND'
  return Math.round(v / 1000) + 'K VND'
}
