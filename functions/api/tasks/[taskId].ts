/** PATCH/DELETE /api/tasks/:taskId */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { getTaskAccess } from '../../_lib/tenancy'
import { logActivity, notifyUser } from '../../_lib/activity'

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])
const RECUR = new Set(['none', 'daily', 'weekly', 'monthly'])

interface PatchBody {
  title?: string
  description?: string
  priority?: string
  dueAt?: number | null
  assigneeId?: string | null
  tags?: string[]
  columnId?: string
  position?: number
  recurringRule?: string
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  const body = await readJson<PatchBody>(context.request)
  if (!body) return json({ error: 'Invalid body' }, 400)

  const current = await context.env.DB.prepare(
    `SELECT title, description, priority, due_at, assignee_id, column_id, position,
            recurring_rule AS recurringRule
       FROM tasks WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(taskId)
    .first<{
      title: string
      description: string
      priority: string
      due_at: number | null
      assignee_id: string | null
      column_id: string
      position: number
      recurringRule: string | null
    }>()
  if (!current) return json({ error: 'Not found' }, 404)

  const title =
    body.title !== undefined ? body.title.trim().slice(0, 200) : current.title
  if (!title) return json({ error: 'Title required' }, 400)

  const description =
    body.description !== undefined
      ? body.description.slice(0, 5000)
      : current.description
  const priority =
    body.priority && PRIORITIES.has(body.priority) ? body.priority : current.priority
  const dueAt = body.dueAt !== undefined ? body.dueAt : current.due_at
  const assigneeId = body.assigneeId !== undefined ? body.assigneeId : current.assignee_id
  const recurringRule =
    body.recurringRule && RECUR.has(body.recurringRule)
      ? body.recurringRule
      : current.recurringRule || 'none'

  let columnId = current.column_id
  let position = current.position
  if (body.columnId) {
    const col = await context.env.DB.prepare(
      `SELECT id FROM columns WHERE id = ? AND board_id = ?`,
    )
      .bind(body.columnId, access.boardId)
      .first()
    if (!col) return json({ error: 'Invalid column' }, 400)
    columnId = body.columnId
  }
  if (typeof body.position === 'number' && Number.isFinite(body.position)) {
    position = body.position
  }

  const now = Date.now()
  await context.env.DB.prepare(
    `UPDATE tasks SET title = ?, description = ?, priority = ?, due_at = ?,
      assignee_id = ?, column_id = ?, position = ?, recurring_rule = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      title,
      description,
      priority,
      dueAt,
      assigneeId,
      columnId,
      position,
      recurringRule,
      now,
      taskId,
    )
    .run()

  if (body.tags) {
    await context.env.DB.prepare(`DELETE FROM task_tags WHERE task_id = ?`).bind(taskId).run()
    const tags = body.tags.map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 10)
    if (tags.length) {
      await context.env.DB.batch(
        tags.map((tag) =>
          context.env.DB.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).bind(
            taskId,
            tag,
          ),
        ),
      )
    }
  }

  await logActivity(context.env, taskId, session.userId, 'update', `Updated “${title}”`)

  if (
    body.assigneeId !== undefined &&
    body.assigneeId &&
    body.assigneeId !== current.assignee_id &&
    body.assigneeId !== session.userId
  ) {
    await notifyUser(
      context.env,
      body.assigneeId,
      'assign',
      `Assigned: ${title}`,
      `${session.name || session.email} assigned you a task`,
      `/app/projects/${access.projectId}?task=${taskId}`,
    )
  }

  await context.env.DB.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .bind(now, access.projectId)
    .run()

  return json({ ok: true })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  const now = Date.now()
  await context.env.DB.prepare(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, taskId)
    .run()

  await logActivity(context.env, taskId, session.userId, 'delete', 'Task deleted')
  return json({ ok: true })
}
