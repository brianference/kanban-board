/** GET/POST /api/tasks/:taskId/comments */
import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { getTaskAccess } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'
import {
  logActivity,
  notifyUser,
  parseMentions,
  resolveMentionUserIds,
} from '../../../_lib/activity'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access) return json({ error: 'Not found' }, 404)

  const { results } = await context.env.DB.prepare(
    `SELECT c.id, c.task_id AS taskId, c.user_id AS userId, c.body, c.created_at AS createdAt,
            u.name AS userName, u.email AS userEmail
       FROM task_comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC`,
  )
    .bind(taskId)
    .all()

  return json({ comments: results ?? [] })
}

interface Body {
  body?: string
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
  const body = (payload?.body || '').trim()
  if (!body || body.length > 4000) return json({ error: 'Comment required (max 4000)' }, 400)

  const id = randomToken(12)
  const now = Date.now()
  await context.env.DB.prepare(
    `INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, taskId, session.userId, body, now)
    .run()

  await logActivity(context.env, taskId, session.userId, 'comment', `Commented: ${body.slice(0, 80)}`)

  const task = await context.env.DB.prepare(
    `SELECT title, assignee_id AS assigneeId, board_id AS boardId FROM tasks WHERE id = ?`,
  )
    .bind(taskId)
    .first<{ title: string; assigneeId: string | null; boardId: string }>()

  const link = `/app/projects/${access.projectId}?task=${taskId}`

  // Notify assignee
  if (task?.assigneeId && task.assigneeId !== session.userId) {
    await notifyUser(
      context.env,
      task.assigneeId,
      'comment',
      `Comment on ${task.title}`,
      body.slice(0, 200),
      link,
    )
  }

  // @mentions
  const tokens = parseMentions(body)
  const mentioned = await resolveMentionUserIds(context.env, access.projectId, tokens)
  for (const uid of mentioned) {
    if (uid === session.userId) continue
    await notifyUser(
      context.env,
      uid,
      'mention',
      `${session.name || session.email} mentioned you`,
      body.slice(0, 200),
      link,
    )
  }

  return json(
    {
      ok: true,
      comment: {
        id,
        taskId,
        userId: session.userId,
        body,
        createdAt: now,
        userName: session.name,
        userEmail: session.email,
      },
    },
    201,
  )
}
