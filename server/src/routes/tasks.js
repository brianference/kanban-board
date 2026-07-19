import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db, id, now, uploadsDir } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errors.js'
import { canWrite, getBoardAccess, getTaskAccess } from '../lib/tenancy.js'

const router = Router()
router.use(requireAuth)

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 10) || '.bin'
      cb(null, `${id(16)}${ext}`)
    },
  }),
  limits: { fileSize: 1_500_000 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('Only JPEG, PNG, GIF, or WebP images allowed'), ok)
  },
})

const createSchema = z.object({
  boardId: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  dueAt: z.number().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  tags: z.array(z.string().max(40)).optional(),
  recurringRule: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
})

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body)
    const access = getBoardAccess(req.user.id, body.boardId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })

    const col = db
      .prepare(`SELECT id FROM columns WHERE id = ? AND board_id = ?`)
      .get(body.columnId, body.boardId)
    if (!col) return res.status(400).json({ error: 'Invalid column' })

    const max = db
      .prepare(
        `SELECT COALESCE(MAX(position), -1) AS m FROM tasks
          WHERE board_id = ? AND column_id = ? AND deleted_at IS NULL`,
      )
      .get(body.boardId, body.columnId)

    const taskId = id()
    const t = now()
    db.prepare(
      `INSERT INTO tasks (
        id, board_id, column_id, title, description, priority, position,
        due_at, assignee_id, created_by, recurring_rule, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      taskId,
      body.boardId,
      body.columnId,
      body.title.trim(),
      body.description || '',
      body.priority || 'medium',
      (max?.m ?? -1) + 1,
      body.dueAt ?? null,
      body.assigneeId || null,
      req.user.id,
      body.recurringRule || 'none',
      t,
      t,
    )

    for (const tag of (body.tags || []).slice(0, 10)) {
      const clean = tag.trim().slice(0, 40)
      if (clean) db.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).run(taskId, clean)
    }

    db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(t, access.projectId)
    res.status(201).json({ ok: true, taskId })
  }),
)

router.get(
  '/:taskId',
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access) return res.status(404).json({ error: 'Not found' })

    const task = db
      .prepare(
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
      .get(req.params.taskId)

    if (!task) return res.status(404).json({ error: 'Not found' })

    const tags = db
      .prepare(`SELECT tag FROM task_tags WHERE task_id = ?`)
      .all(req.params.taskId)
      .map((r) => r.tag)
    const attachments = db
      .prepare(
        `SELECT id, filename, content_type AS contentType, size_bytes AS sizeBytes, created_at AS createdAt
           FROM task_attachments WHERE task_id = ? ORDER BY created_at`,
      )
      .all(req.params.taskId)
      .map((a) => ({ ...a, url: `/api/attachments/${a.id}` }))
    const checklist = db
      .prepare(
        `SELECT id, title, done, position, created_at AS createdAt
           FROM task_checklist_items WHERE task_id = ? ORDER BY position`,
      )
      .all(req.params.taskId)
      .map((i) => ({ ...i, done: Boolean(i.done) }))
    const comments = db
      .prepare(
        `SELECT c.id, c.body, c.created_at AS createdAt, u.name AS userName, u.email AS userEmail
           FROM task_comments c JOIN users u ON u.id = c.user_id
          WHERE c.task_id = ? ORDER BY c.created_at`,
      )
      .all(req.params.taskId)

    res.json({
      task: { ...task, tags, attachments },
      checklist,
      comments,
      role: access.role,
    })
  }),
)

router.patch(
  '/:taskId',
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })

    const current = db
      .prepare(
        `SELECT title, description, priority, due_at, assignee_id, column_id, position, recurring_rule
           FROM tasks WHERE id = ? AND deleted_at IS NULL`,
      )
      .get(req.params.taskId)
    if (!current) return res.status(404).json({ error: 'Not found' })

    const title =
      req.body?.title !== undefined ? String(req.body.title).trim().slice(0, 200) : current.title
    if (!title) return res.status(400).json({ error: 'Title required' })
    const description =
      req.body?.description !== undefined
        ? String(req.body.description).slice(0, 5000)
        : current.description
    const priority = ['critical', 'high', 'medium', 'low'].includes(req.body?.priority)
      ? req.body.priority
      : current.priority
    const dueAt = req.body?.dueAt !== undefined ? req.body.dueAt : current.due_at
    const assigneeId =
      req.body?.assigneeId !== undefined ? req.body.assigneeId || null : current.assignee_id
    const recurringRule = ['none', 'daily', 'weekly', 'monthly'].includes(req.body?.recurringRule)
      ? req.body.recurringRule
      : current.recurring_rule
    let columnId = current.column_id
    let position = current.position
    if (req.body?.columnId) {
      const col = db
        .prepare(`SELECT id FROM columns WHERE id = ? AND board_id = ?`)
        .get(req.body.columnId, access.boardId)
      if (!col) return res.status(400).json({ error: 'Invalid column' })
      columnId = req.body.columnId
    }
    if (typeof req.body?.position === 'number') position = req.body.position

    const t = now()
    db.prepare(
      `UPDATE tasks SET title=?, description=?, priority=?, due_at=?, assignee_id=?,
        column_id=?, position=?, recurring_rule=?, updated_at=? WHERE id=?`,
    ).run(
      title,
      description,
      priority,
      dueAt,
      assigneeId,
      columnId,
      position,
      recurringRule,
      t,
      req.params.taskId,
    )

    if (Array.isArray(req.body?.tags)) {
      db.prepare(`DELETE FROM task_tags WHERE task_id = ?`).run(req.params.taskId)
      for (const tag of req.body.tags.slice(0, 10)) {
        const clean = String(tag).trim().slice(0, 40)
        if (clean) {
          db.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).run(
            req.params.taskId,
            clean,
          )
        }
      }
    }

    db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(t, access.projectId)
    res.json({ ok: true })
  }),
)

router.delete(
  '/:taskId',
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    const t = now()
    db.prepare(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(
      t,
      t,
      req.params.taskId,
    )
    res.json({ ok: true })
  }),
)

router.post(
  '/:taskId/move',
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    const columnId = req.body?.columnId
    const position = req.body?.position
    if (!columnId || typeof position !== 'number') {
      return res.status(400).json({ error: 'columnId and position required' })
    }
    const col = db
      .prepare(`SELECT id, name, wip_limit AS wipLimit FROM columns WHERE id = ? AND board_id = ?`)
      .get(columnId, access.boardId)
    if (!col) return res.status(400).json({ error: 'Invalid column' })
    if (col.wipLimit != null && col.wipLimit > 0) {
      const count = db
        .prepare(
          `SELECT COUNT(*) AS c FROM tasks
            WHERE board_id = ? AND column_id = ? AND deleted_at IS NULL AND id != ?`,
        )
        .get(access.boardId, columnId, req.params.taskId)
      if (count.c >= col.wipLimit) {
        return res.status(400).json({ error: `WIP limit reached for “${col.name}”` })
      }
    }
    const t = now()
    db.prepare(
      `UPDATE tasks SET column_id = ?, position = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    ).run(columnId, position, t, req.params.taskId)
    db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(t, access.projectId)
    res.json({ ok: true })
  }),
)

router.post(
  '/:taskId/comments',
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    const body = String(req.body?.body || '').trim()
    if (!body || body.length > 4000) return res.status(400).json({ error: 'Comment required' })
    const cid = id()
    const t = now()
    db.prepare(
      `INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(cid, req.params.taskId, req.user.id, body, t)
    res.status(201).json({
      ok: true,
      comment: {
        id: cid,
        body,
        createdAt: t,
        userName: req.user.name,
        userEmail: req.user.email,
      },
    })
  }),
)

router.post(
  '/:taskId/checklist',
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    const title = String(req.body?.title || '').trim().slice(0, 200)
    if (!title) return res.status(400).json({ error: 'title required' })
    const max = db
      .prepare(
        `SELECT COALESCE(MAX(position), -1) AS m FROM task_checklist_items WHERE task_id = ?`,
      )
      .get(req.params.taskId)
    const itemId = id()
    const t = now()
    db.prepare(
      `INSERT INTO task_checklist_items (id, task_id, title, done, position, created_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
    ).run(itemId, req.params.taskId, title, (max?.m ?? -1) + 1, t)
    res.status(201).json({
      ok: true,
      item: { id: itemId, title, done: false, position: (max?.m ?? -1) + 1, createdAt: t },
    })
  }),
)

router.post(
  '/:taskId/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const access = getTaskAccess(req.user.id, req.params.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    if (!req.file) return res.status(400).json({ error: 'file required' })
    const count = db
      .prepare(`SELECT COUNT(*) AS c FROM task_attachments WHERE task_id = ?`)
      .get(req.params.taskId)
    if (count.c >= 8) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Max 8 images per task' })
    }
    const attId = id()
    const t = now()
    db.prepare(
      `INSERT INTO task_attachments (
        id, task_id, filename, stored_name, content_type, size_bytes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      attId,
      req.params.taskId,
      (req.file.originalname || 'image').slice(0, 120),
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      req.user.id,
      t,
    )
    res.status(201).json({
      ok: true,
      attachment: {
        id: attId,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        sizeBytes: req.file.size,
        url: `/api/attachments/${attId}`,
        createdAt: t,
      },
    })
  }),
)

export default router
