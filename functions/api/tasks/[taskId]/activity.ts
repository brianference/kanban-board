/** GET /api/tasks/:taskId/activity */
import type { Env } from '../../../_lib/types'
import { json } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { getTaskAccess } from '../../../_lib/tenancy'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access) return json({ error: 'Not found' }, 404)

  const { results } = await context.env.DB.prepare(
    `SELECT a.id, a.kind, a.message, a.created_at AS createdAt,
            u.name AS userName, u.email AS userEmail
       FROM task_activity a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
      LIMIT 100`,
  )
    .bind(taskId)
    .all()

  return json({ activity: results ?? [] })
}
