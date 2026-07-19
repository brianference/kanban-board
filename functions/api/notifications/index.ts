/** GET /api/notifications — list current user's notifications */
import type { Env } from '../../_lib/types'
import { json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const { results } = await context.env.DB.prepare(
    `SELECT id, kind, title, body, link, read_at AS readAt, created_at AS createdAt
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50`,
  )
    .bind(session.userId)
    .all()

  const unread = await context.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
  )
    .bind(session.userId)
    .first<{ c: number }>()

  return json({ notifications: results ?? [], unread: unread?.c ?? 0 })
}
