import type { Env } from '../../_lib/types'
import { json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const url = new URL(context.request.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const priority = url.searchParams.get('priority') || ''
  const due = url.searchParams.get('due') || ''
  const projectId = url.searchParams.get('projectId') || ''
  const assigneeId = url.searchParams.get('assigneeId') || ''
  const tag = (url.searchParams.get('tag') || '').toLowerCase()

  let sql = `
    SELECT t.id, t.title, t.description, t.priority, t.due_at AS dueAt,
           t.column_id AS columnId, t.board_id AS boardId, t.assignee_id AS assigneeId,
           t.updated_at AS updatedAt, p.id AS projectId, p.name AS projectName,
           b.name AS boardName, c.name AS columnName,
           u.name AS assigneeName, u.email AS assigneeEmail
      FROM tasks t
      JOIN boards b ON b.id = t.board_id
      JOIN projects p ON p.id = b.project_id
      JOIN columns c ON c.id = t.column_id
      JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
      LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.deleted_at IS NULL`
  const binds: unknown[] = [session.userId]

  if (projectId) {
    sql += ` AND p.id = ?`
    binds.push(projectId)
  }
  if (q) {
    sql += ` AND (lower(t.title) LIKE ? OR lower(t.description) LIKE ? OR EXISTS (
      SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND lower(tt.tag) LIKE ?
    ))`
    const like = `%${q}%`
    binds.push(like, like, like)
  }
  if (['critical', 'high', 'medium', 'low'].includes(priority)) {
    sql += ` AND t.priority = ?`
    binds.push(priority)
  }
  if (assigneeId) {
    sql += ` AND t.assignee_id = ?`
    binds.push(assigneeId)
  }
  if (tag) {
    sql += ` AND EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND lower(tt.tag) = ?)`
    binds.push(tag)
  }
  const day = Date.now()
  if (due === 'overdue') {
    sql += ` AND t.due_at IS NOT NULL AND t.due_at < ?`
    binds.push(day)
  } else if (due === 'week') {
    sql += ` AND t.due_at IS NOT NULL AND t.due_at >= ? AND t.due_at <= ?`
    binds.push(day, day + 7 * 864e5)
  } else if (due === 'none') {
    sql += ` AND t.due_at IS NULL`
  }

  sql += ` ORDER BY t.updated_at DESC LIMIT 100`

  const { results } = await context.env.DB.prepare(sql)
    .bind(...binds)
    .all()

  const out = []
  for (const r of results ?? []) {
    const row = r as { id: string }
    const { results: tags } = await context.env.DB.prepare(
      `SELECT tag FROM task_tags WHERE task_id = ?`,
    )
      .bind(row.id)
      .all<{ tag: string }>()
    out.push({ ...row, tags: (tags ?? []).map((t) => t.tag) })
  }

  return json({ results: out, count: out.length })
}
