/** DELETE /api/views/:viewId */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const viewId = context.params.viewId as string
  await context.env.DB.prepare(`DELETE FROM saved_views WHERE id = ? AND user_id = ?`)
    .bind(viewId, session.userId)
    .run()

  return json({ ok: true })
}
