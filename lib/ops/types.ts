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
  sort_order: number
  status: string
  created_by: string | null
  completed_at: string | null
  linked_object_type: string | null   // Phase 5 (reserved)
  linked_object_id: string | null     // Phase 5 (reserved)
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
