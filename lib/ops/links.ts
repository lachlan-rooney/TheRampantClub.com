// TRC Operations Hub — cross-site link resolver (Phase 5).
//
// A link is a LIVE pointer: the task stores only (type, id); we resolve the
// object's CURRENT label/state here, each render. Missing target → { missing }
// ("no longer exists"), never a throw — because linked_object_id is plain text
// with no FK, a deleted object is just a dangling ref, resolved as dead.

import type { SupabaseClient } from '@supabase/supabase-js'

export type LinkType = 'member' | 'whisky' | 'checklist'

export interface ResolvedLink {
  type: LinkType
  id: string
  label: string
  url: string                  // '' when missing (not clickable)
  fillPct?: number | null      // L2: whisky current fill %
  missing?: boolean
}

export const LINK_TYPE_META: Record<LinkType, { icon: string; label: string }> = {
  member:    { icon: '👤', label: 'Member' },
  whisky:    { icon: '🥃', label: 'Whisky' },
  checklist: { icon: '✅', label: 'Checklist' },
}

export const LINK_TYPES: LinkType[] = ['member', 'whisky', 'checklist']

const checklistLabel = (kind: string, date: string) => `${kind === 'opening' ? 'Opening' : 'Closing'} — ${date}`

// Batch-resolve a set of (type,id) refs → live labels/urls. One bulk query per
// present type. Key format: `${type}:${id}`.
export async function resolveLinks(
  supabase: SupabaseClient,
  refs: { type: string; id: string }[],
): Promise<Map<string, ResolvedLink>> {
  const out = new Map<string, ResolvedLink>()
  const idsOf = (t: string) => [...new Set(refs.filter(r => r.type === t).map(r => r.id))]

  const memberIds = idsOf('member')
  if (memberIds.length) {
    const { data } = await supabase.from('members').select('member_no, full_name').in('member_no', memberIds)
    const found = new Map((data || []).map((m: { member_no: string; full_name: string }) => [m.member_no, m.full_name]))
    for (const id of memberIds) {
      const name = found.get(id)
      out.set(`member:${id}`, name
        ? { type: 'member', id, label: name, url: `/admin/mis/${encodeURIComponent(id)}` }
        : { type: 'member', id, label: 'Member no longer exists', url: '', missing: true })
    }
  }

  const whiskyIds = idsOf('whisky')
  if (whiskyIds.length) {
    const { data } = await supabase.from('whiskies').select('id, name, current_fill_pct').in('id', whiskyIds)
    const found = new Map((data || []).map((w: { id: string; name: string; current_fill_pct: number | null }) => [w.id, w]))
    for (const id of whiskyIds) {
      const w = found.get(id)
      out.set(`whisky:${id}`, w
        ? { type: 'whisky', id, label: w.name, url: `/admin/whisky?focus=${encodeURIComponent(id)}`, fillPct: w.current_fill_pct }
        : { type: 'whisky', id, label: 'Whisky no longer exists', url: '', missing: true })
    }
  }

  const checklistIds = idsOf('checklist')
  if (checklistIds.length) {
    const { data } = await supabase.from('shift_checklists').select('id, shift_date, kind').in('id', checklistIds)
    const found = new Map((data || []).map((c: { id: string; shift_date: string; kind: string }) => [c.id, c]))
    for (const id of checklistIds) {
      const c = found.get(id)
      out.set(`checklist:${id}`, c
        ? { type: 'checklist', id, label: checklistLabel(c.kind, c.shift_date), url: `/admin/checklists?date=${c.shift_date}` }
        : { type: 'checklist', id, label: 'Checklist no longer exists', url: '', missing: true })
    }
  }

  return out
}

// For the link picker — search candidates of a type. Returns {id, label}.
export async function searchLinkTargets(
  supabase: SupabaseClient, type: LinkType, q: string,
): Promise<{ id: string; label: string }[]> {
  const term = q.trim()
  if (type === 'member') {
    let qy = supabase.from('members').select('member_no, full_name').order('full_name').limit(12)
    if (term) qy = qy.ilike('full_name', `%${term}%`)
    const { data } = await qy
    return (data || []).map((m: { member_no: string; full_name: string }) => ({ id: m.member_no, label: `${m.full_name} · ${m.member_no}` }))
  }
  if (type === 'whisky') {
    let qy = supabase.from('whiskies').select('id, name').order('name').limit(12)
    if (term) qy = qy.ilike('name', `%${term}%`)
    const { data } = await qy
    return (data || []).map((w: { id: string; name: string }) => ({ id: w.id, label: w.name }))
  }
  const { data } = await supabase.from('shift_checklists').select('id, shift_date, kind').order('shift_date', { ascending: false }).limit(12)
  return (data || []).map((c: { id: string; shift_date: string; kind: string }) => ({ id: c.id, label: checklistLabel(c.kind, c.shift_date) }))
}
