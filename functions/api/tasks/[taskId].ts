import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { canWrite, getTaskAccess } from '../../_lib/tenancy'

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access) return json({ error: 'Not found' }, 404)

  const task = await context.env.DB.prepare(
    `SELECT t.id, t.board_id AS boardId, t.column_id AS columnId, t.title, t.description,
            t.priority, t.position, t.due_at AS dueAt, t.assignee_id AS assigneeId,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt,
            t.recurring_rule AS recurringRule,
            u.name AS assigneeName, u.email AS assigneeEmail,
            bo.project_id AS projectId, c.name AS columnName, bo.name AS boardName,
            p.name AS projectName
       FROM tasks t
       JOIN boards bo ON bo.id = t.board_id
       JOIN projects p ON p.id = bo.project_id
       JOIN columns c ON c.id = t.column_id
       LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.id = ? AND t.deleted_at IS NULL`,
  )
    .bind(taskId)
    .first()

  if (!task) return json({ error: 'Not found' }, 404)

  const { results: tagRows } = await context.env.DB.prepare(
    `SELECT tag FROM task_tags WHERE task_id = ?`,
  )
    .bind(taskId)
    .all<{ tag: string }>()

  let attachments: unknown[] = []
  try {
    const { results } = await context.env.DB.prepare(
      `SELECT id, filename, content_type AS contentType, size_bytes AS sizeBytes, created_at AS createdAt
         FROM task_attachments WHERE task_id = ? ORDER BY created_at`,
    )
      .bind(taskId)
      .all()
    attachments = (results ?? []).map((a) => ({
      ...(a as object),
      url: `/api/attachments/${(a as { id: string }).id}`,
    }))
  } catch {
    /* */
  }

  let checklist: unknown[] = []
  try {
    const { results } = await context.env.DB.prepare(
      `SELECT id, title, done, position, created_at AS createdAt
         FROM task_checklist_items WHERE task_id = ? ORDER BY position`,
    )
      .bind(taskId)
      .all()
    checklist = (results ?? []).map((r) => {
      const row = r as { done: number }
      return { ...row, done: Boolean(row.done) }
    })
  } catch {
    /* */
  }

  let comments: unknown[] = []
  try {
    const { results } = await context.env.DB.prepare(
      `SELECT c.id, c.body, c.created_at AS createdAt, u.name AS userName, u.email AS userEmail
         FROM task_comments c JOIN users u ON u.id = c.user_id
        WHERE c.task_id = ? ORDER BY c.created_at`,
    )
      .bind(taskId)
      .all<{
        id: string
        body: string
        createdAt: number
        userName: string
        userEmail: string
      }>()

    const commentIds = (results ?? []).map((c) => c.id)
    const attByComment = new Map<
      string,
      Array<{ id: string; filename: string; url: string; contentType?: string }>
    >()

    if (commentIds.length) {
      try {
        const ph = commentIds.map(() => '?').join(',')
        const { results: attRows } = await context.env.DB.prepare(
          `SELECT id, comment_id AS commentId, filename, content_type AS contentType
             FROM comment_attachments WHERE comment_id IN (${ph}) ORDER BY created_at`,
        )
          .bind(...commentIds)
          .all<{
            id: string
            commentId: string
            filename: string
            contentType: string
          }>()
        for (const row of attRows ?? []) {
          const list = attByComment.get(row.commentId) || []
          list.push({
            id: row.id,
            filename: row.filename,
            contentType: row.contentType,
            url: `/api/comment-attachments/${row.id}`,
          })
          attByComment.set(row.commentId, list)
        }
      } catch {
        /* table may not exist yet */
      }
    }

    comments = (results ?? []).map((c) => ({
      ...c,
      attachments: attByComment.get(c.id) || [],
    }))
  } catch {
    /* */
  }

  // Project members for @mention autocomplete
  let members: Array<{ userId: string; email: string; name: string; role: string }> = []
  try {
    const { results: memberRows } = await context.env.DB.prepare(
      `SELECT m.user_id AS userId, m.role AS role, u.email AS email, u.name AS name
         FROM project_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.project_id = ?
        ORDER BY u.name COLLATE NOCASE`,
    )
      .bind(access.projectId)
      .all<{ userId: string; role: string; email: string; name: string }>()
    members = memberRows ?? []
  } catch {
    /* */
  }

  return json({
    task: {
      ...task,
      tags: (tagRows ?? []).map((t) => t.tag),
      attachments,
    },
    checklist,
    comments,
    members,
    role: access.role,
  })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const body = await readJson<Record<string, unknown>>(context.request)
  if (!body) return json({ error: 'Invalid body' }, 400)

  const current = await context.env.DB.prepare(
    `SELECT title, description, priority, due_at, assignee_id, column_id, position, recurring_rule
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
      recurring_rule: string | null
    }>()
  if (!current) return json({ error: 'Not found' }, 404)

  const title =
    body.title !== undefined ? String(body.title).trim().slice(0, 200) : current.title
  if (!title) return json({ error: 'Title required' }, 400)
  const description =
    body.description !== undefined
      ? String(body.description).slice(0, 5000)
      : current.description
  const priority =
    typeof body.priority === 'string' && PRIORITIES.has(body.priority)
      ? body.priority
      : current.priority
  const dueAt = body.dueAt !== undefined ? (body.dueAt as number | null) : current.due_at
  const assigneeId =
    body.assigneeId !== undefined ? (body.assigneeId as string | null) : current.assignee_id
  const recurringRule =
    typeof body.recurringRule === 'string' &&
    ['none', 'daily', 'weekly', 'monthly'].includes(body.recurringRule)
      ? body.recurringRule
      : current.recurring_rule || 'none'

  let columnId = current.column_id
  let position = current.position
  if (body.columnId) {
    const col = await context.env.DB.prepare(
      `SELECT id FROM columns WHERE id = ? AND board_id = ?`,
    )
      .bind(String(body.columnId), access.boardId)
      .first()
    if (!col) return json({ error: 'Invalid column' }, 400)
    columnId = String(body.columnId)
  }
  if (typeof body.position === 'number') position = body.position

  const now = Date.now()
  await context.env.DB.prepare(
    `UPDATE tasks SET title=?, description=?, priority=?, due_at=?, assignee_id=?,
      column_id=?, position=?, recurring_rule=?, updated_at=? WHERE id=?`,
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

  if (Array.isArray(body.tags)) {
    await context.env.DB.prepare(`DELETE FROM task_tags WHERE task_id = ?`).bind(taskId).run()
    for (const tag of (body.tags as string[]).slice(0, 10)) {
      const clean = String(tag).trim().slice(0, 40)
      if (clean) {
        await context.env.DB.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).bind(
          taskId,
          clean,
        ).run()
      }
    }
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
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const now = Date.now()
  await context.env.DB.prepare(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, taskId)
    .run()
  return json({ ok: true })
}
