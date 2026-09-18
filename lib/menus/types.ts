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

/** One restaurant with everything it offers, ready to render. */
export interface MenuVenueGroup {
  slug: string
  name: string
  kind: 'partner' | 'house'
  tagline_en: string | null
  tagline_vn: string | null
  logo_path: string | null
  accent_hex: string | null
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

/** Group flat view rows by restaurant, in the order the admin set. */
export function groupByVenue(plates: MenuPlate[], sets: MenuSet[]): MenuVenueGroup[] {
  const byslug = new Map<string, MenuVenueGroup>()
  const order = new Map<string, number>()

  const ensure = (r: MenuVenueFields): MenuVenueGroup => {
    let g = byslug.get(r.venue_slug)
    if (!g) {
      g = {
        slug: r.venue_slug, name: r.venue_name, kind: r.venue_kind,
        tagline_en: r.venue_tagline_en, tagline_vn: r.venue_tagline_vn,
        logo_path: r.venue_logo_path, accent_hex: r.venue_accent_hex,
        plates: [], sets: [],
      }
      byslug.set(r.venue_slug, g)
      order.set(r.venue_slug, r.venue_order)
    }
    return g
  }

  for (const p of plates) ensure(p).plates.push(p)
  for (const s of sets) ensure(s).sets.push(s)

  for (const g of byslug.values()) {
    g.plates.sort((a, b) => a.display_order - b.display_order || a.name_en.localeCompare(b.name_en))
    g.sets.sort((a, b) => a.display_order - b.display_order || a.name_en.localeCompare(b.name_en))
  }

  return [...byslug.values()].sort((a, b) =>
    (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0) || a.name.localeCompare(b.name))
}

/** Đồng, the way it is written here: grouped with full stops, and a
 *  non-breaking space before the symbol — Vietnamese convention, and without it
 *  the ₫ sits on top of the last digit in the mono face.
 *  `null` is "price on request" — never 0, which would read as free. */
export function dong(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  return new Intl.NumberFormat('vi-VN').format(v) + ' ₫'
}
