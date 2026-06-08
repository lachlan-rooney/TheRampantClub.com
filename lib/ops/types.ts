// TRC Operations Hub — shared types (Phase 1).

export type ProjectStatus = 'active' | 'archived'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ProjectRole = 'owner' | 'contributor' | 'viewer'

export interface Project {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  colour: string | null
  start_date: string | null
  target_date: string | null
  owner: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface BoardColumn {
  id: string
  project_id: string
  name: string
  sort_order: number
  is_done_column: boolean
  created_at: string
}

export interface TeamMember {
  id: string
  profile_id: string | null
  display_name: string
  role_title: string | null
  division: string | null
  functions: string[]          // roles this person can cover: bar / floor / host / gm
  active: boolean
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  member: string          // profiles.id (auth user)
  role: ProjectRole
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  column_id: string
  title: string
  description: string | null
  assignee: string | null   // team_members.id
  priority: TaskPriority
  due_date: string | null
  start_date: string | null            // Gantt — optional; with due → bar, without → milestone
  sort_order: number
  status: string
  created_by: string | null
  completed_at: string | null
  linked_object_type: string | null   // Phase 5 (reserved)
  linked_object_id: string | null     // Phase 5 (reserved)
  template_id: string | null          // Phase 3 — set when materialised from a template
  materialised_for: string | null     // Phase 3 — the VN day this instance is for
  created_at: string
  updated_at: string
}

// Recurrence rule (Phase 3) — deliberately minimal.
export type Recurrence =
  | { freq: 'daily' }
  | { freq: 'weekly'; weekdays: number[] }   // ISO weekday 1=Mon … 7=Sun

export interface TaskTemplate {
  id: string
  project_id: string
  column_id: string
  title: string
  description: string | null
  priority: TaskPriority
  default_assignee: string | null
  recurrence: Recurrence
  active: boolean
  last_materialised_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskChecklistItem {
  id: string
  task_id: string
  label: string
  checked: boolean
  sort_order: number
}

// Rota (Phase 4) — club-wide weekly staff schedule.
export interface RotaShiftType {
  name: string
  sort_order: number
}

export interface RotaShift {
  id: string
  member: string            // team_members.id
  shift_date: string        // YYYY-MM-DD
  shift_name: string        // varchar snapshot (not enum)
  start_time: string | null
  end_time: string | null
  role: string | null
  project_id: string | null // null = club-wide rota
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ActivityEvent {
  id: string
  actor: string | null
  verb: string
  object_type: string
  object_id: string | null
  project_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}
