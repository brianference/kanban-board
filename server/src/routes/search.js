import { Router } from 'express'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errors.js'

const router = Router()
router.use(requireAuth)

/**
 * Global search across projects/tasks the user can access.
 * Query params: q, priority, tag, due (overdue|week|none), assigneeId, projectId
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase()
    const priority = String(req.query.priority || '')
    const tag = String(req.query.tag || '').toLowerCase()
    const due = String(req.query.due || '')
    const assigneeId = String(req.query.assigneeId || '')
    const projectId = String(req.query.projectId || '')

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

    const params = [req.user.id]

    if (projectId) {
      sql += ` AND p.id = ?`
      params.push(projectId)
    }
    if (q) {
      sql += ` AND (lower(t.title) LIKE ? OR lower(t.description) LIKE ? OR EXISTS (
        SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND lower(tt.tag) LIKE ?
      ))`
      const like = `%${q}%`
      params.push(like, like, like)
    }
    if (['critical', 'high', 'medium', 'low'].includes(priority)) {
      sql += ` AND t.priority = ?`
      params.push(priority)
    }
    if (assigneeId) {
      sql += ` AND t.assignee_id = ?`
      params.push(assigneeId)
    }
    if (tag) {
      sql += ` AND EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND lower(tt.tag) = ?)`
      params.push(tag)
    }
    const day = Date.now()
    if (due === 'overdue') {
      sql += ` AND t.due_at IS NOT NULL AND t.due_at < ?`
      params.push(day)
    } else if (due === 'week') {
      sql += ` AND t.due_at IS NOT NULL AND t.due_at >= ? AND t.due_at <= ?`
      params.push(day, day + 7 * 864e5)
    } else if (due === 'none') {
      sql += ` AND t.due_at IS NULL`
    }

    sql += ` ORDER BY t.updated_at DESC LIMIT 100`

    const results = db.prepare(sql).all(...params)
    const withTags = results.map((r) => {
      const tags = db
        .prepare(`SELECT tag FROM task_tags WHERE task_id = ?`)
        .all(r.id)
        .map((x) => x.tag)
      return { ...r, tags }
    })

    res.json({ results: withTags, count: withTags.length })
  }),
)

export default router
