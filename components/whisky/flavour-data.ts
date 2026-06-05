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
  const { data } = await supabase.from('flavour_categories').select('slug,name,sort_order').order('sort_order')
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

export function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
