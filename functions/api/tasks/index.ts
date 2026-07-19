/** POST /api/tasks — create task */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { getBoardAccess } from '../../_lib/tenancy'
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
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  const title = body.title.trim().slice(0, 200)
  const description = (body.description || '').slice(0, 5000)
  const priority = PRIORITIES.has(body.priority || '') ? body.priority! : 'medium'

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

  const id = randomToken(16)
  const now = Date.now()
  const position = (maxPos?.m ?? -1) + 1
  const dueAt = typeof body.dueAt === 'number' ? body.dueAt : null
  const assigneeId = body.assigneeId || null

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
      id,
      body.boardId,
      body.columnId,
      title,
      description,
      priority,
      position,
      dueAt,
      assigneeId,
      session.userId,
      now,
      now,
      recurring,
    )
    .run()

  const tags = (body.tags || []).map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 10)
  if (tags.length) {
    await context.env.DB.batch(
      tags.map((tag) =>
        context.env.DB.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).bind(id, tag),
      ),
    )
  }

  await context.env.DB.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .bind(now, access.projectId)
    .run()

  return json({ ok: true, taskId: id }, 201)
}
