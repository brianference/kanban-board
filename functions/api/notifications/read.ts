/** POST /api/notifications/read — mark one or all as read */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'

interface Body {
  id?: string
  all?: boolean
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const body = await readJson<Body>(context.request)
  const now = Date.now()

  if (body?.all) {
    await context.env.DB.prepare(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
    )
      .bind(now, session.userId)
      .run()
    return json({ ok: true })
  }

  if (!body?.id) return json({ error: 'id or all required' }, 400)

  await context.env.DB.prepare(
    `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`,
  )
    .bind(now, body.id, session.userId)
    .run()

  return json({ ok: true })
}
