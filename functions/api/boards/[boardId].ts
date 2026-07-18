/** GET /api/boards/:boardId — board + columns + tasks */
import type { Env } from '../../_lib/types'
import { json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { getBoardAccess } from '../../_lib/tenancy'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const boardId = context.params.boardId as string
  const access = await getBoardAccess(context.env, session.userId, boardId)
  if (!access) return json({ error: 'Not found' }, 404)

  const board = await context.env.DB.prepare(
    `SELECT id, project_id AS projectId, name, kind, created_at AS createdAt
       FROM boards WHERE id = ?`,
  )
    .bind(boardId)
    .first()

  const { results: columns } = await context.env.DB.prepare(
    `SELECT id, key_name AS key, name, position
       FROM columns WHERE board_id = ? ORDER BY position`,
  )
    .bind(boardId)
    .all()

  const { results: taskRows } = await context.env.DB.prepare(
    `SELECT t.id, t.board_id AS boardId, t.column_id AS columnId, t.title, t.description,
            t.priority, t.position, t.due_at AS dueAt, t.assignee_id AS assigneeId,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt,
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
  if (taskIds.length) {
    const placeholders = taskIds.map(() => '?').join(',')
    const { results: tagRows } = await context.env.DB.prepare(
      `SELECT task_id AS taskId, tag FROM task_tags WHERE task_id IN (${placeholders})`,
    )
      .bind(...taskIds)
      .all<{ taskId: string; tag: string }>()
    for (const row of tagRows ?? []) {
      const list = tagsByTask.get(row.taskId) || []
      list.push(row.tag)
      tagsByTask.set(row.taskId, list)
    }
  }

  const tasks = (taskRows ?? []).map((t) => {
    const row = t as Record<string, unknown>
    return {
      ...row,
      tags: tagsByTask.get(String(row.id)) || [],
    }
  })

  return json({
    board,
    columns: columns ?? [],
    tasks,
    role: access.role,
    projectId: access.projectId,
  })
}
