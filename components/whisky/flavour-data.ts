import type { SupabaseClient } from '@supabase/supabase-js'

// Shared flavour-radar data helpers + palette. Used by FlavourRadar (single),
// CompareRadar / WhiskyFlavourPanel (two whiskies), and later the Flavour Finder.

export interface Cat { slug: string; name: string; sort_order: number }
export interface Spoke { category_slug: string; intensity: number; confidence: number }
export type ShapeValues = Record<string, { intensity: number; confidence: number }>

// Overlay palette: A = gold (the established single-radar colour), B = sage.
// Both legible on the deep-green ground; not terracotta (#C27070 reads "error").
export const RADAR_GOLD = '#D4B85A'
export const RADAR_SAGE = '#7AB07A'

let _catsCache: Cat[] | null = null
export async function fetchCategories(supabase: SupabaseClient): Promise<Cat[]> {
  if (_catsCache) return _catsCache
  // Compass 16 only — the migration seeds carry a quadrant; the legacy 13
  // families have quadrant NULL and are filtered out so the map isn't doubled.
  const { data } = await supabase.from('flavour_categories').select('slug,name,sort_order').not('quadrant', 'is', null).order('sort_order')
  _catsCache = (data || []) as Cat[]
  return _catsCache
}

export async function fetchSpokes(supabase: SupabaseClient, whiskyId: string): Promise<Spoke[]> {
  const { data } = await supabase
    .from('whisky_flavour_intensities')
    .select('category_slug,intensity,confidence')
    .eq('whisky_id', whiskyId)
  return (data || []) as Spoke[]
}

export function valuesFromSpokes(spokes: Spoke[]): ShapeValues {
  return Object.fromEntries(spokes.map(s => [s.category_slug, { intensity: s.intensity, confidence: s.confidence }]))
}

// Vietnamese names for the 16 Compass families. flavour_categories carries no
// `_vn` column, so the pairing lives here, keyed by slug. Unknown slugs fall back
// to the DB (English) name. No lib/lang import: this module is also loaded by a
// server route, and lib/lang is a client module.
const FAMILY_VN: Record<string, string> = {
  cereal_biscuit:       'Ngũ Cốc & Bánh Quy',
  green_grassy:         'Cỏ Tươi & Lá Xanh',
  orchard_fruit:        'Trái Cây Vườn',
  tropical_citrus:      'Nhiệt Đới & Cam Chanh',
  floral_honeyed:       'Hoa & Mật Ong',
  buttery_creamy:       'Bơ & Kem',
  meaty_sulphury:       'Thịt & Lưu Huỳnh',
  vanilla_coconut:      'Vani & Dừa',
  baking_spice:         'Gia Vị Ấm',
  pepper_tannin:        'Tiêu & Tannin',
  dried_fruit_walnut:   'Trái Cây Khô & Óc Chó',
  treacle_roast:        'Mật Mía & Hương Rang',
  leather_polished_oak: 'Da Thuộc & Gỗ Sồi',
  woodsmoke:            'Khói Gỗ',
  tar_iodine:           'Hắc Ín & I-ốt',
  brine_shoreline:      'Muối & Hơi Biển',
}

/** A family's display name in the current language (English DB name as fallback). */
export function catLabel(c: { slug: string; name: string }, lang: 'en' | 'vn'): string {
  return lang === 'vn' ? (FAMILY_VN[c.slug] || c.name) : c.name
}

export function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
