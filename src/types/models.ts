/** Shared domain types for the client. */

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type MemberRole = 'owner' | 'member' | 'viewer'
export type TemplateId = 'blank' | 'personal' | 'side-project' | 'bugs'

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
