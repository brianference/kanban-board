/** GET/POST checklist; PATCH/DELETE via item routes */
import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { getTaskAccess } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'
import { logActivity } from '../../../_lib/activity'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access) return json({ error: 'Not found' }, 404)

  const { results } = await context.env.DB.prepare(
    `SELECT id, task_id AS taskId, title, done, position, created_at AS createdAt
       FROM task_checklist_items WHERE task_id = ? ORDER BY position ASC, created_at ASC`,
  )
    .bind(taskId)
    .all()

  const items = (results ?? []).map((r) => {
    const row = r as { done: number; [k: string]: unknown }
    return { ...row, done: Boolean(row.done) }
  })
  return json({ items })
}

interface Body {
  title?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  const payload = await readJson<Body>(context.request)
  const title = (payload?.title || '').trim().slice(0, 200)
  if (!title) return json({ error: 'title required' }, 400)

  const max = await context.env.DB.prepare(
    `SELECT COALESCE(MAX(position), -1) AS m FROM task_checklist_items WHERE task_id = ?`,
  )
    .bind(taskId)
    .first<{ m: number }>()

  const id = randomToken(12)
  const now = Date.now()
  const position = (max?.m ?? -1) + 1
  await context.env.DB.prepare(
    `INSERT INTO task_checklist_items (id, task_id, title, done, position, created_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
  )
    .bind(id, taskId, title, position, now)
    .run()

  await logActivity(context.env, taskId, session.userId, 'checklist', `Added checklist: ${title}`)

  return json({ ok: true, item: { id, taskId, title, done: false, position, createdAt: now } }, 201)
}
