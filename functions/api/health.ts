/** GET /api/health — liveness including D1. */
import type { Env } from '../_lib/types'
import { json } from '../_lib/http'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await context.env.DB.prepare('SELECT 1 AS ok').first()
    return json({ ok: true, service: 'kanban-board', db: 'up', ts: Date.now() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'db error'
    return json({ ok: false, service: 'kanban-board', db: 'down', error: message }, 503)
  }
}
