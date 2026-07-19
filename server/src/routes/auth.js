import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { db, id, now } from '../db/index.js'
import { signToken, cookieOptions, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errors.js'
import { resolveTemplate } from '../lib/templates.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again later.' },
})

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().max(80).optional(),
})

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
})

function seedProject(userId, projectName, templateId = 'personal') {
  const t = now()
  const projectId = id()
  const boardId = id()
  const tpl = resolveTemplate(templateId)

  db.prepare(
    `INSERT INTO projects (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(projectId, projectName, userId, t, t)
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`,
  ).run(projectId, userId, t)
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
      userId,
      t,
      t,
    )
    for (const tag of task.tags || []) {
      db.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).run(tid, tag)
    }
  })

  return { projectId, boardId }
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body)
    const email = body.email.trim().toLowerCase()
    const name = (body.name || email.split('@')[0] || 'User').trim().slice(0, 80)

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const userId = id()
    const passwordHash = await bcrypt.hash(body.password, 12)
    const t = now()
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, email, name, passwordHash, t)

    const { projectId } = seedProject(userId, 'My first project', 'personal')
    const user = { id: userId, email, name }
    const token = signToken(user)
    res.cookie('fb_token', token, cookieOptions())
    res.status(201).json({ ok: true, user, projectId, token })
  }),
)

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const email = body.email.trim().toLowerCase()
    const row = db
      .prepare(`SELECT id, email, name, password_hash FROM users WHERE email = ?`)
      .get(email)
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const ok = await bcrypt.compare(body.password, row.password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const user = { id: row.id, email: row.email, name: row.name }
    const token = signToken(user)
    res.cookie('fb_token', token, cookieOptions())
    res.json({ ok: true, user, token })
  }),
)

router.post('/logout', (_req, res) => {
  res.clearCookie('fb_token', { path: '/' })
  res.json({ ok: true })
})

router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = db
      .prepare(`SELECT id, email, name, created_at AS createdAt FROM users WHERE id = ?`)
      .get(req.user.id)
    if (!row) return res.status(401).json({ error: 'Unauthorized' })
    res.json({ user: row })
  }),
)

export default router
