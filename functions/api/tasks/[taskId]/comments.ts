import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { canWrite, getTaskAccess } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const body = await readJson<{ body?: string }>(context.request)
  const text = (body?.body || '').trim()
  if (!text || text.length > 4000) return json({ error: 'Comment required' }, 400)

  const id = randomToken(12)
  const now = Date.now()
  await context.env.DB.prepare(
    `INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, taskId, session.userId, text, now)
    .run()

  return json(
    {
      ok: true,
      comment: {
        id,
        body: text,
        createdAt: now,
        userName: session.name,
        userEmail: session.email,
      },
    },
    201,
  )
}
