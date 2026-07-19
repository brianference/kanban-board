/**
 * Typed fetch wrapper for the Pages Functions API.
 * Sends cookies for session auth; never trusts client-side user ids for writes.
 */
import type {
  BoardPayload,
  ProjectMember,
  ProjectSummary,
  BoardSummary,
  TemplateId,
  User,
  TaskAttachment,
  BoardFilters,
  SavedView,
  NotificationItem,
  CommentItem,
  ChecklistItem,
  ActivityItem,
} from '../types/models'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  // Only set JSON content-type when body is not FormData
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  health: () => request<{ ok: boolean; db: string }>('/api/health'),

  session: () => request<{ user: User | null }>('/api/auth/session'),

  register: (body: { email: string; password: string; name?: string }) =>
    request<{ ok: true; user: User; projectId: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ ok: true; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),

  listProjects: () =>
    request<{ projects: ProjectSummary[] }>('/api/projects'),

  createProject: (body: { name: string; template?: TemplateId }) =>
    request<{ ok: true; projectId: string; boardId: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getProject: (projectId: string) =>
    request<{
      project: ProjectSummary
      boards: BoardSummary[]
      members: ProjectMember[]
      role: string
    }>(`/api/projects/${projectId}`),

  renameProject: (projectId: string, name: string) =>
    request<{ ok: true }>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteProject: (projectId: string) =>
    request<{ ok: true }>(`/api/projects/${projectId}`, { method: 'DELETE' }),

  getBoard: (boardId: string) => request<BoardPayload>(`/api/boards/${boardId}`),

  createTask: (body: {
    boardId: string
    columnId: string
    title: string
    description?: string
    priority?: string
    dueAt?: number | null
    assigneeId?: string | null
    tags?: string[]
    recurringRule?: string
  }) =>
    request<{ ok: true; taskId: string }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTask: (
    taskId: string,
    body: Record<string, unknown>,
  ) =>
    request<{ ok: true }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteTask: (taskId: string) =>
    request<{ ok: true }>(`/api/tasks/${taskId}`, { method: 'DELETE' }),

  moveTask: (taskId: string, columnId: string, position: number) =>
    request<{ ok: true }>(`/api/tasks/${taskId}/move`, {
      method: 'POST',
      body: JSON.stringify({ columnId, position }),
    }),

  createInvite: (body: { projectId: string; email: string; role?: 'member' | 'viewer' }) =>
    request<{ ok: true; token: string; sharePath: string; expiresAt: number }>(
      '/api/invites',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  acceptInvite: (token: string) =>
    request<{ ok: true; projectId: string }>('/api/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  listAttachments: (taskId: string) =>
    request<{ attachments: TaskAttachment[] }>(`/api/tasks/${taskId}/attachments`),

  uploadAttachment: (taskId: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<{ ok: true; attachment: TaskAttachment }>(
      `/api/tasks/${taskId}/attachments`,
      { method: 'POST', body },
    )
  },

  deleteAttachment: (attachmentId: string) =>
    request<{ ok: true }>(`/api/attachments/${attachmentId}`, { method: 'DELETE' }),

  listComments: (taskId: string) =>
    request<{ comments: CommentItem[] }>(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: string, body: string) =>
    request<{ ok: true; comment: CommentItem }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  listChecklist: (taskId: string) =>
    request<{ items: ChecklistItem[] }>(`/api/tasks/${taskId}/checklist`),

  addChecklistItem: (taskId: string, title: string) =>
    request<{ ok: true; item: ChecklistItem }>(`/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  patchChecklistItem: (itemId: string, body: { title?: string; done?: boolean }) =>
    request<{ ok: true }>(`/api/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteChecklistItem: (itemId: string) =>
    request<{ ok: true }>(`/api/checklist/${itemId}`, { method: 'DELETE' }),

  listActivity: (taskId: string) =>
    request<{ activity: ActivityItem[] }>(`/api/tasks/${taskId}/activity`),

  listNotifications: () =>
    request<{ notifications: NotificationItem[]; unread: number }>('/api/notifications'),

  markNotificationsRead: (body: { id?: string; all?: boolean }) =>
    request<{ ok: true }>('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listViews: (projectId: string) =>
    request<{ views: SavedView[] }>(`/api/projects/${projectId}/views`),

  saveView: (projectId: string, name: string, filters: BoardFilters) =>
    request<{ ok: true; view: SavedView }>(`/api/projects/${projectId}/views`, {
      method: 'POST',
      body: JSON.stringify({ name, filters }),
    }),

  deleteView: (viewId: string) =>
    request<{ ok: true }>(`/api/views/${viewId}`, { method: 'DELETE' }),

  updateColumn: (columnId: string, body: { name?: string; wipLimit?: number | null }) =>
    request<{ ok: true; name: string; wipLimit: number | null }>(`/api/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
}
