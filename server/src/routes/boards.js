import { Router } from 'express'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errors.js'
import { getBoardAccess } from '../lib/tenancy.js'

const router = Router()
router.use(requireAuth)

function loadTaskExtras(taskIds) {
  const tagsByTask = new Map()
  const attByTask = new Map()
  const checkByTask = new Map()
  const commentsByTask = new Map()
  if (!taskIds.length) {
    return { tagsByTask, attByTask, checkByTask, commentsByTask }
  }
  const ph = taskIds.map(() => '?').join(',')
  for (const row of db
    .prepare(`SELECT task_id AS taskId, tag FROM task_tags WHERE task_id IN (${ph})`)
    .all(...taskIds)) {
    const list = tagsByTask.get(row.taskId) || []
    list.push(row.tag)
    tagsByTask.set(row.taskId, list)
  }
  for (const row of db
    .prepare(
      `SELECT id, task_id AS taskId, filename, content_type AS contentType,
              size_bytes AS sizeBytes, created_at AS createdAt
         FROM task_attachments WHERE task_id IN (${ph}) ORDER BY created_at`,
    )
    .all(...taskIds)) {
    const list = attByTask.get(row.taskId) || []
    list.push({
      ...row,
      url: `/api/attachments/${row.id}`,
    })
    attByTask.set(row.taskId, list)
  }
  for (const row of db
    .prepare(
      `SELECT task_id AS taskId, COUNT(*) AS total, SUM(done) AS done
         FROM task_checklist_items WHERE task_id IN (${ph}) GROUP BY task_id`,
    )
    .all(...taskIds)) {
    checkByTask.set(row.taskId, { total: row.total, done: row.done || 0 })
  }
  for (const row of db
    .prepare(
      `SELECT task_id AS taskId, COUNT(*) AS c FROM task_comments
        WHERE task_id IN (${ph}) GROUP BY task_id`,
    )
    .all(...taskIds)) {
    commentsByTask.set(row.taskId, row.c)
  }
  return { tagsByTask, attByTask, checkByTask, commentsByTask }
}

router.get(
  '/:boardId',
  asyncHandler(async (req, res) => {
    const access = getBoardAccess(req.user.id, req.params.boardId)
    if (!access) return res.status(404).json({ error: 'Not found' })

    const board = db
      .prepare(
        `SELECT id, project_id AS projectId, name, kind, created_at AS createdAt
           FROM boards WHERE id = ?`,
      )
      .get(req.params.boardId)

    const columns = db
      .prepare(
        `SELECT id, key_name AS key, name, position, wip_limit AS wipLimit
           FROM columns WHERE board_id = ? ORDER BY position`,
      )
      .all(req.params.boardId)

    const taskRows = db
      .prepare(
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
      .all(req.params.boardId)

    const ids = taskRows.map((t) => t.id)
    const extras = loadTaskExtras(ids)
    const tasks = taskRows.map((t) => {
      const cl = extras.checkByTask.get(t.id)
      return {
        ...t,
        tags: extras.tagsByTask.get(t.id) || [],
        attachments: extras.attByTask.get(t.id) || [],
        checklistTotal: cl?.total || 0,
        checklistDone: cl?.done || 0,
        commentCount: extras.commentsByTask.get(t.id) || 0,
      }
    })

    res.json({
      board,
      columns,
      tasks,
      role: access.role,
      projectId: access.projectId,
    })
  }),
)

export default router
