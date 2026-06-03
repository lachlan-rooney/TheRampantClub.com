// TRC Operations Hub — client-side WRITE helpers (Phase 1).
//
// Every write goes through the /api/admin/ops gateway, which forwards to the
// atomic write+emit RPCs under the caller's session. These helpers just build
// the `p_`-prefixed args the SQL functions expect, so callers use clean names.
// READS do NOT live here — they're plain client-side Supabase selects in the
// page (select-RLS scopes them), matching the existing admin convention.

import type { ProjectRole, TaskPriority, Recurrence } from './types'

async function opsWrite(action: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await fetch('/api/admin/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j.data
}

// ── Projects ──
export const createProject = (p: {
  name: string; description?: string | null; colour?: string | null
  start_date?: string | null; target_date?: string | null
}) => opsWrite('ops_create_project', {
  p_name: p.name,
  p_description: p.description ?? null,
  p_colour: p.colour ?? null,
  p_start_date: p.start_date ?? null,
  p_target_date: p.target_date ?? null,
}) as Promise<string>  // returns new project id

export const archiveProject = (projectId: string) =>
  opsWrite('ops_archive_project', { p_project_id: projectId })

// ── Columns ──
export const createColumn = (projectId: string, name: string, isDone = false) =>
  opsWrite('ops_create_column', { p_project_id: projectId, p_name: name, p_is_done: isDone })

export const renameColumn = (columnId: string, name: string) =>
  opsWrite('ops_rename_column', { p_column_id: columnId, p_name: name })

// ── Tasks ──
export const createTask = (t: {
  project_id: string; column_id: string; title: string
  description?: string | null; assignee?: string | null
  priority?: TaskPriority; due_date?: string | null
}) => opsWrite('ops_create_task', {
  p_project_id: t.project_id,
  p_column_id: t.column_id,
  p_title: t.title,
  p_description: t.description ?? null,
  p_assignee: t.assignee ?? null,
  p_priority: t.priority ?? 'normal',
  p_due_date: t.due_date ?? null,
}) as Promise<string>  // returns new task id

export const updateTask = (t: {
  id: string; title: string; description?: string | null
  priority: TaskPriority; due_date?: string | null
}) => opsWrite('ops_update_task', {
  p_task_id: t.id,
  p_title: t.title,
  p_description: t.description ?? null,
  p_priority: t.priority,
  p_due_date: t.due_date ?? null,
})

export const moveTask = (taskId: string, toColumnId: string, toSort: number) =>
  opsWrite('ops_move_task', { p_task_id: taskId, p_to_column_id: toColumnId, p_to_sort: toSort })

// Within-column reorder — persists the whole column's order in one event.
export const reorderColumn = (columnId: string, orderedIds: string[]) =>
  opsWrite('ops_reorder_column', { p_column_id: columnId, p_ordered_ids: orderedIds })

export const assignTask = (taskId: string, assignee: string | null) =>
  opsWrite('ops_assign_task', { p_task_id: taskId, p_assignee: assignee })

export const deleteTask = (taskId: string) =>
  opsWrite('ops_delete_task', { p_task_id: taskId })

// ── Project members ──
export const addProjectMember = (projectId: string, member: string, role: ProjectRole = 'contributor') =>
  opsWrite('ops_add_project_member', { p_project_id: projectId, p_member: member, p_role: role })

export const removeProjectMember = (projectId: string, member: string) =>
  opsWrite('ops_remove_project_member', { p_project_id: projectId, p_member: member })

// ── Recurring templates (Phase 3) ──
export const createTemplate = (t: {
  project_id: string; column_id: string; title: string
  description?: string | null; priority?: TaskPriority
  default_assignee?: string | null; recurrence: Recurrence
}) => opsWrite('ops_create_template', {
  p_project_id: t.project_id,
  p_column_id: t.column_id,
  p_title: t.title,
  p_description: t.description ?? null,
  p_priority: t.priority ?? 'normal',
  p_default_assignee: t.default_assignee ?? null,
  p_recurrence: t.recurrence,
}) as Promise<string>

export const updateTemplate = (t: {
  id: string; title: string; description?: string | null; priority: TaskPriority
  default_assignee?: string | null; recurrence: Recurrence; active: boolean
}) => opsWrite('ops_update_template', {
  p_id: t.id,
  p_title: t.title,
  p_description: t.description ?? null,
  p_priority: t.priority,
  p_default_assignee: t.default_assignee ?? null,
  p_recurrence: t.recurrence,
  p_active: t.active,
})

export const setTemplateActive = (id: string, active: boolean) =>
  opsWrite('ops_set_template_active', { p_id: id, p_active: active })

// Manual "Materialise now" — hits the cron route (admin-authed), same job the
// daily schedule runs. Returns the { run_date, created, lapsed } summary.
export async function materialiseNow(): Promise<{ run_date: string; created: number; lapsed: number }> {
  const r = await fetch('/api/cron/ops-materialise', { method: 'POST' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j.summary
}
