/** GET /api/boards/:boardId — board + columns + tasks (+ counts) */
import type { Env } from '../../_lib/types'
import { json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { getBoardAccess } from '../../_lib/tenancy'
import { processRecurringForBoard } from '../../_lib/recurring'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const boardId = context.params.boardId as string
  const access = await getBoardAccess(context.env, session.userId, boardId)
  if (!access) return json({ error: 'Not found' }, 404)

  // Spawn due recurring tasks (templates feature)
  try {
    await processRecurringForBoard(context.env, boardId)
  } catch {
    /* non-fatal if migration not applied yet on old deploys */
  }

  const board = await context.env.DB.prepare(
    `SELECT id, project_id AS projectId, name, kind, created_at AS createdAt
       FROM boards WHERE id = ?`,
  )
    .bind(boardId)
    .first()

  const { results: columns } = await context.env.DB.prepare(
    `SELECT id, key_name AS key, name, position, wip_limit AS wipLimit
       FROM columns WHERE board_id = ? ORDER BY position`,
  )
    .bind(boardId)
    .all()

  const { results: taskRows } = await context.env.DB.prepare(
    `SELECT t.id, t.board_id AS boardId, t.column_id AS columnId, t.title, t.description,
            t.priority, t.position, t.due_at AS dueAt, t.assignee_id AS assigneeId,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt,
            t.recurring_rule AS recurringRule,
            u.name AS assigneeName, u.email AS assigneeEmail
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.board_id = ? AND t.deleted_at IS NULL
      ORDER BY t.position ASC, t.created_at ASC`,
  )
    .bind(boardId)
    .all()

  const taskIds = (taskRows ?? []).map((t) => (t as { id: string }).id)
  const tagsByTask = new Map<string, string[]>()
  const attachmentsByTask = new Map<string, unknown[]>()
  const checklistByTask = new Map<string, { total: number; done: number }>()
  const commentsByTask = new Map<string, number>()

  if (taskIds.length) {
    const ph = taskIds.map(() => '?').join(',')

    const { results: tagRows } = await context.env.DB.prepare(
      `SELECT task_id AS taskId, tag FROM task_tags WHERE task_id IN (${ph})`,
    )
      .bind(...taskIds)
      .all<{ taskId: string; tag: string }>()
    for (const row of tagRows ?? []) {
      const list = tagsByTask.get(row.taskId) || []
      list.push(row.tag)
      tagsByTask.set(row.taskId, list)
    }

    try {
      const { results: attRows } = await context.env.DB.prepare(
        `SELECT id, task_id AS taskId, filename, content_type AS contentType,
                size_bytes AS sizeBytes, created_at AS createdAt
           FROM task_attachments WHERE task_id IN (${ph}) ORDER BY created_at ASC`,
      )
        .bind(...taskIds)
        .all<{
          id: string
          taskId: string
          filename: string
          contentType: string
          sizeBytes: number
          createdAt: number
        }>()
      for (const row of attRows ?? []) {
        const list = attachmentsByTask.get(row.taskId) || []
        list.push({
          id: row.id,
          filename: row.filename,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          url: `/api/attachments/${row.id}`,
          createdAt: row.createdAt,
        })
        attachmentsByTask.set(row.taskId, list)
      }
    } catch {
      /* attachments table optional on very old DBs */
    }

    try {
      const { results: checkRows } = await context.env.DB.prepare(
        `SELECT task_id AS taskId, COUNT(*) AS total, SUM(done) AS done
           FROM task_checklist_items WHERE task_id IN (${ph}) GROUP BY task_id`,
      )
        .bind(...taskIds)
        .all<{ taskId: string; total: number; done: number }>()
      for (const row of checkRows ?? []) {
        checklistByTask.set(row.taskId, { total: row.total, done: row.done || 0 })
      }
    } catch {
      /* */
    }

    try {
      const { results: cRows } = await context.env.DB.prepare(
        `SELECT task_id AS taskId, COUNT(*) AS c FROM task_comments
          WHERE task_id IN (${ph}) GROUP BY task_id`,
      )
        .bind(...taskIds)
        .all<{ taskId: string; c: number }>()
      for (const row of cRows ?? []) commentsByTask.set(row.taskId, row.c)
    } catch {
      /* */
    }
  }

  const tasks = (taskRows ?? []).map((t) => {
    const row = t as Record<string, unknown>
    const id = String(row.id)
    const cl = checklistByTask.get(id)
    return {
      ...row,
      tags: tagsByTask.get(id) || [],
      attachments: attachmentsByTask.get(id) || [],
      checklistTotal: cl?.total ?? 0,
      checklistDone: cl?.done ?? 0,
      commentCount: commentsByTask.get(id) ?? 0,
      recurringRule: row.recurringRule || 'none',
    }
  })

  return json({
    board,
    columns: (columns ?? []).map((c) => {
      const col = c as Record<string, unknown>
      return {
        ...col,
        wipLimit: col.wipLimit ?? null,
      }
    }),
    tasks,
    role: access.role,
    projectId: access.projectId,
  })
}
