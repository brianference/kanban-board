import type { Env } from '../../_lib/types'
import { getSession } from '../../_lib/auth'
import { json } from '../../_lib/http'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await getSession(context.env, context.request)
  if (!session) return json({ error: 'Unauthorized' }, 401)
  return json({
    user: { id: session.userId, email: session.email, name: session.name },
  })
}
