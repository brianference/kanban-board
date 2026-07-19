/** Shared domain types for the client. */

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type MemberRole = 'owner' | 'member' | 'viewer'
export type TemplateId = 'blank' | 'personal' | 'side-project' | 'bugs'
export type RecurringRule = 'none' | 'daily' | 'weekly' | 'monthly'
export type SwimlaneMode = 'none' | 'assignee' | 'priority' | 'tag'
export type DueFilter =
  | 'all'
  | 'overdue'
  | 'today'
  | 'week'
  | 'none'
  | 'has-due'

export interface User {
  id: string
  email: string
  name: string
}

export interface ProjectSummary {
  id: string
  name: string
  ownerId: string
  createdAt: number
  updatedAt: number
  role: MemberRole
}

export interface BoardSummary {
  id: string
  name: string
  kind: 'kanban' | 'bugs'
  createdAt: number
}

export interface Column {
  id: string
  key: string
  name: string
  position: number
  wipLimit?: number | null
}

export interface TaskAttachment {
  id: string
  filename: string
  contentType: string
  sizeBytes: number
  url: string
  createdAt: number
}

export interface Task {
  id: string
  boardId: string
  columnId: string
  title: string
  description: string
  priority: Priority
  position: number
  dueAt: number | null
  assigneeId: string | null
  assigneeName?: string | null
  assigneeEmail?: string | null
  createdBy: string | null
  createdAt: number
  updatedAt: number
  tags: string[]
  attachments?: TaskAttachment[]
  checklistTotal?: number
  checklistDone?: number
  commentCount?: number
  recurringRule?: RecurringRule | string
}

export interface BoardPayload {
  board: {
    id: string
    projectId: string
    name: string
    kind: string
    createdAt: number
  }
  columns: Column[]
  tasks: Task[]
  role: MemberRole
  projectId: string
}

export interface ProjectMember {
  userId: string
  role: MemberRole
  email: string
  name: string
}

export interface BoardFilters {
  search: string
  assigneeId: string
  priority: string
  tag: string
  due: DueFilter
  hasAttachments: boolean
  hasOpenChecklist: boolean
  unassignedOnly: boolean
  mentionedOnly: boolean
}

export interface SavedView {
  id: string
  name: string
  filters: BoardFilters
  createdAt: number
}

export interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string
  link: string
  readAt: number | null
  createdAt: number
}

export interface CommentItem {
  id: string
  taskId: string
  userId: string
  body: string
  createdAt: number
  userName?: string
  userEmail?: string
}

export interface ChecklistItem {
  id: string
  taskId: string
  title: string
  done: boolean
  position: number
  createdAt: number
}

export interface ActivityItem {
  id: string
  kind: string
  message: string
  createdAt: number
  userName?: string | null
  userEmail?: string | null
}

export function defaultFilters(): BoardFilters {
  return {
    search: '',
    assigneeId: '',
    priority: '',
    tag: '',
    due: 'all',
    hasAttachments: false,
    hasOpenChecklist: false,
    unassignedOnly: false,
    mentionedOnly: false,
  }
}
