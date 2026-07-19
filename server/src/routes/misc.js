import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { db, id, now, uploadsDir } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errors.js'
import { canWrite, getTaskAccess } from '../lib/tenancy.js'

const router = Router()

router.get('/health', (_req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get()
    res.json({ ok: true, service: 'flowboard', db: 'up', ts: Date.now(), version: '3.0.0' })
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down', error: e.message })
  }
})

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
})

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many messages. Try later.' },
})

router.post(
  '/contact',
  contactLimiter,
  asyncHandler(async (req, res) => {
    const body = contactSchema.parse(req.body)
    const mid = id()
    db.prepare(
      `INSERT INTO contact_messages (id, name, email, subject, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(mid, body.name.trim(), body.email.trim().toLowerCase(), body.subject.trim(), body.message.trim(), now())
    res.status(201).json({ ok: true, message: 'Thanks — we received your message.' })
  }),
)

router.get(
  '/attachments/:attachmentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const att = db
      .prepare(
        `SELECT id, task_id AS taskId, filename, stored_name AS storedName,
                content_type AS contentType, size_bytes AS sizeBytes
           FROM task_attachments WHERE id = ?`,
      )
      .get(req.params.attachmentId)
    if (!att) return res.status(404).json({ error: 'Not found' })
    const access = getTaskAccess(req.user.id, att.taskId)
    if (!access) return res.status(404).json({ error: 'Not found' })
    const filePath = path.join(uploadsDir, att.storedName)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' })
    res.setHeader('Content-Type', att.contentType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${att.filename.replace(/"/g, '')}"`,
    )
    fs.createReadStream(filePath).pipe(res)
  }),
)

router.delete(
  '/attachments/:attachmentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const att = db
      .prepare(
        `SELECT id, task_id AS taskId, stored_name AS storedName FROM task_attachments WHERE id = ?`,
      )
      .get(req.params.attachmentId)
    if (!att) return res.status(404).json({ error: 'Not found' })
    const access = getTaskAccess(req.user.id, att.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    db.prepare(`DELETE FROM task_attachments WHERE id = ?`).run(att.id)
    const filePath = path.join(uploadsDir, att.storedName)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json({ ok: true })
  }),
)

router.patch(
  '/checklist/:itemId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = db
      .prepare(`SELECT id, task_id AS taskId, title, done FROM task_checklist_items WHERE id = ?`)
      .get(req.params.itemId)
    if (!item) return res.status(404).json({ error: 'Not found' })
    const access = getTaskAccess(req.user.id, item.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    const title =
      req.body?.title !== undefined ? String(req.body.title).trim().slice(0, 200) : item.title
    const done = req.body?.done !== undefined ? (req.body.done ? 1 : 0) : item.done
    db.prepare(`UPDATE task_checklist_items SET title = ?, done = ? WHERE id = ?`).run(
      title,
      done,
      item.id,
    )
    res.json({ ok: true })
  }),
)

router.delete(
  '/checklist/:itemId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = db
      .prepare(`SELECT id, task_id AS taskId FROM task_checklist_items WHERE id = ?`)
      .get(req.params.itemId)
    if (!item) return res.status(404).json({ error: 'Not found' })
    const access = getTaskAccess(req.user.id, item.taskId)
    if (!access || !canWrite(access.role)) return res.status(404).json({ error: 'Not found' })
    db.prepare(`DELETE FROM task_checklist_items WHERE id = ?`).run(item.id)
    res.json({ ok: true })
  }),
)

router.patch(
  '/columns/:columnId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const col = db
      .prepare(
        `SELECT c.id, c.board_id AS boardId, c.name, c.wip_limit AS wipLimit
           FROM columns c WHERE c.id = ?`,
      )
      .get(req.params.columnId)
    if (!col) return res.status(404).json({ error: 'Not found' })
    const board = db
      .prepare(
        `SELECT b.id, m.role FROM boards b
           JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
          WHERE b.id = ?`,
      )
      .get(req.user.id, col.boardId)
    if (!board || !canWrite(board.role)) return res.status(404).json({ error: 'Not found' })
    const name =
      req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 60) : col.name
    let wip = col.wipLimit
    if (req.body && 'wipLimit' in req.body) {
      if (req.body.wipLimit === null || req.body.wipLimit === '') wip = null
      else wip = Math.floor(Number(req.body.wipLimit))
      if (wip !== null && (!Number.isFinite(wip) || wip < 0 || wip > 99)) {
        return res.status(400).json({ error: 'Invalid wipLimit' })
      }
    }
    db.prepare(`UPDATE columns SET name = ?, wip_limit = ? WHERE id = ?`).run(name, wip, col.id)
    res.json({ ok: true, name, wipLimit: wip })
  }),
)

export default router
