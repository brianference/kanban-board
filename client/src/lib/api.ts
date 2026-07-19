/**
 * API client for FlowBoard Express backend.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { credentials: 'include', ...init, headers })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export type User = { id: string; email: string; name: string; createdAt?: number }

export const api = {
  health: () => request<{ ok: boolean; db: string; version: string }>('/api/health'),
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
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  session: () => request<{ user: User }>('/api/auth/session'),
  listProjects: () =>
    request<{
      projects: Array<{
        id: string
        name: string
        ownerId: string
        createdAt: number
        updatedAt: number
        role: string
      }>
    }>('/api/projects'),
  createProject: (body: { name: string; template?: string }) =>
    request<{ ok: true; projectId: string; boardId: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getProject: (id: string) =>
    request<{
      project: { id: string; name: string; ownerId: string }
      boards: Array<{ id: string; name: string; kind: string }>
      members: Array<{ userId: string; role: string; email: string; name: string }>
      role: string
    }>(`/api/projects/${id}`),
  deleteProject: (id: string) =>
    request<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
  getBoard: (id: string) => request<BoardPayload>(`/api/boards/${id}`),
  getTask: (id: string) =>
    request<{
      task: Task
      checklist: Array<{ id: string; title: string; done: boolean }>
      comments: Array<{
        id: string
        body: string
        createdAt: number
        userName?: string
        userEmail?: string
      }>
      role: string
    }>(`/api/tasks/${id}`),
  createTask: (body: Record<string, unknown>) =>
    request<{ ok: true; taskId: string }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTask: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTask: (id: string) =>
    request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  moveTask: (id: string, columnId: string, position: number) =>
    request<{ ok: true }>(`/api/tasks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ columnId, position }),
    }),
  search: (params: Record<string, string>) => {
    const q = new URLSearchParams(params)
    return request<{ results: SearchResult[]; count: number }>(`/api/search?${q}`)
  },
  contact: (body: { name: string; email: string; subject: string; message: string }) =>
    request<{ ok: true; message: string }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadAttachment: (taskId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<{ ok: true; attachment: { id: string; url: string; filename: string } }>(
      `/api/tasks/${taskId}/attachments`,
      { method: 'POST', body: fd },
    )
  },
  addComment: (taskId: string, body: string) =>
    request<{ ok: true }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  addChecklist: (taskId: string, title: string) =>
    request<{ ok: true; item: { id: string; title: string; done: boolean } }>(
      `/api/tasks/${taskId}/checklist`,
      { method: 'POST', body: JSON.stringify({ title }) },
    ),
  patchChecklist: (itemId: string, body: { done?: boolean; title?: string }) =>
    request<{ ok: true }>(`/api/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteChecklist: (itemId: string) =>
    request<{ ok: true }>(`/api/checklist/${itemId}`, { method: 'DELETE' }),
}

export type Task = {
  id: string
  boardId: string
  columnId: string
  title: string
  description: string
  priority: string
  position: number
  dueAt: number | null
  assigneeId: string | null
  assigneeName?: string | null
  assigneeEmail?: string | null
  tags: string[]
  attachments?: Array<{ id: string; url: string; filename: string }>
  checklistTotal?: number
  checklistDone?: number
  commentCount?: number
  recurringRule?: string
  projectId?: string
  columnName?: string
  boardName?: string
  projectName?: string
  updatedAt?: number
}

export type BoardPayload = {
  board: { id: string; projectId: string; name: string }
  columns: Array<{ id: string; key: string; name: string; position: number; wipLimit?: number | null }>
  tasks: Task[]
  role: string
  projectId: string
}

export type SearchResult = Task & {
  projectId: string
  projectName: string
  boardName: string
  columnName: string
}
