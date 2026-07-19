import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { canWrite, getBoardAccess } from '../../_lib/tenancy'
import { randomToken } from '../../_lib/crypto'

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])

interface Body {
  boardId?: string
  columnId?: string
  title?: string
  description?: string
  priority?: string
  dueAt?: number | null
  assigneeId?: string | null
  tags?: string[]
  recurringRule?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const body = await readJson<Body>(context.request)
  if (!body?.boardId || !body?.columnId || !body?.title?.trim()) {
    return json({ error: 'boardId, columnId, and title required' }, 400)
  }

  const access = await getBoardAccess(context.env, session.userId, body.boardId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const col = await context.env.DB.prepare(
    `SELECT id FROM columns WHERE id = ? AND board_id = ?`,
  )
    .bind(body.columnId, body.boardId)
    .first()
  if (!col) return json({ error: 'Invalid column' }, 400)

  const maxPos = await context.env.DB.prepare(
    `SELECT COALESCE(MAX(position), -1) AS m FROM tasks
      WHERE board_id = ? AND column_id = ? AND deleted_at IS NULL`,
  )
    .bind(body.boardId, body.columnId)
    .first<{ m: number }>()

  const taskId = randomToken(16)
  const now = Date.now()
  const priority = body.priority && PRIORITIES.has(body.priority) ? body.priority : 'medium'
  const recurring =
    body.recurringRule && ['none', 'daily', 'weekly', 'monthly'].includes(body.recurringRule)
      ? body.recurringRule
      : 'none'

  await context.env.DB.prepare(
    `INSERT INTO tasks (
      id, board_id, column_id, title, description, priority, position,
      due_at, assignee_id, created_by, created_at, updated_at, deleted_at,
      recurring_rule, last_recurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
  )
    .bind(
      taskId,
      body.boardId,
      body.columnId,
      body.title.trim().slice(0, 200),
      (body.description || '').slice(0, 5000),
      priority,
      (maxPos?.m ?? -1) + 1,
      typeof body.dueAt === 'number' ? body.dueAt : null,
      body.assigneeId || null,
      session.userId,
      now,
      now,
      recurring,
    )
    .run()

  for (const tag of (body.tags || []).slice(0, 10)) {
    const clean = tag.trim().slice(0, 40)
    if (clean) {
      await context.env.DB.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).bind(
        taskId,
        clean,
      ).run()
    }
  }

  await context.env.DB.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .bind(now, access.projectId)
    .run()

  return json({ ok: true, taskId }, 201)
}
