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
} from '../types/models'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
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
}
