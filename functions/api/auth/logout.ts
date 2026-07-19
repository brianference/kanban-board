import type { Env } from '../../_lib/types'
import { assertSameOrigin, clearSessionCookie, json } from '../../_lib/http'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
}
