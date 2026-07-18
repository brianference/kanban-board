/** POST /api/auth/logout */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, clearSessionCookie, json, readSessionId } from '../../_lib/http'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const sid = readSessionId(context.request)
  if (sid) {
    await context.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run()
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
}
