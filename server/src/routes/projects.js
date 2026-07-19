import { Router } from 'express'
import { z } from 'zod'
import { db, id, now } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errors.js'
import { canWrite, getProjectAccess } from '../lib/tenancy.js'
import { resolveTemplate } from '../lib/templates.js'

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = db
      .prepare(
        `SELECT p.id, p.name, p.owner_id AS ownerId, p.created_at AS createdAt,
                p.updated_at AS updatedAt, m.role AS role
           FROM projects p
           JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
          ORDER BY p.updated_at DESC`,
      )
      .all(req.user.id)
    res.json({ projects })
  }),
)

const createSchema = z.object({
  name: z.string().min(1).max(120),
  template: z.enum(['blank', 'personal', 'side-project']).optional(),
})

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body)
    const t = now()
    const projectId = id()
    const boardId = id()
    const tpl = resolveTemplate(body.template || 'blank')

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO projects (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(projectId, body.name.trim(), req.user.id, t, t)
      db.prepare(
        `INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`,
      ).run(projectId, req.user.id, t)
      db.prepare(
        `INSERT INTO boards (id, project_id, name, kind, created_at) VALUES (?, ?, ?, 'kanban', ?)`,
      ).run(boardId, projectId, tpl.boardName, t)

      const colIds = {}
      for (const col of tpl.columns) {
        const cid = id()
        colIds[col.key] = cid
        db.prepare(
          `INSERT INTO columns (id, board_id, key_name, name, position, wip_limit)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        ).run(cid, boardId, col.key, col.name, col.position)
      }
      tpl.tasks.forEach((task, index) => {
        const tid = id()
        db.prepare(
          `INSERT INTO tasks (
            id, board_id, column_id, title, description, priority, position,
            due_at, assignee_id, created_by, recurring_rule, created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'none', ?, ?, NULL)`,
        ).run(
          tid,
          boardId,
          colIds[task.columnKey],
          task.title,
          task.description,
          task.priority,
          index,
          req.user.id,
          t,
          t,
        )
        for (const tag of task.tags || []) {
          db.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).run(tid, tag)
        }
      })
    })
    tx()
    res.status(201).json({ ok: true, projectId, boardId })
  }),
)

router.get(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const access = getProjectAccess(req.user.id, req.params.projectId)
    if (!access) return res.status(404).json({ error: 'Not found' })

    const project = db
      .prepare(
        `SELECT id, name, owner_id AS ownerId, created_at AS createdAt, updated_at AS updatedAt
           FROM projects WHERE id = ?`,
      )
      .get(req.params.projectId)

    const boards = db
      .prepare(
        `SELECT id, name, kind, created_at AS createdAt FROM boards WHERE project_id = ? ORDER BY created_at`,
      )
      .all(req.params.projectId)

    const members = db
      .prepare(
        `SELECT m.user_id AS userId, m.role, u.email, u.name
           FROM project_members m JOIN users u ON u.id = m.user_id
          WHERE m.project_id = ?`,
      )
      .all(req.params.projectId)

    res.json({ project, boards, members, role: access.role })
  }),
)

router.patch(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const access = getProjectAccess(req.user.id, req.params.projectId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    const name = String(req.body?.name || '').trim()
    if (!name || name.length > 120) return res.status(400).json({ error: 'Invalid name' })
    db.prepare(`UPDATE projects SET name = ?, updated_at = ? WHERE id = ?`).run(
      name,
      now(),
      req.params.projectId,
    )
    res.json({ ok: true })
  }),
)

router.delete(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const access = getProjectAccess(req.user.id, req.params.projectId)
    if (!access || access.role !== 'owner') return res.status(404).json({ error: 'Not found' })
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(req.params.projectId)
    res.json({ ok: true })
  }),
)

export default router
