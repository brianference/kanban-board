import type { Env } from '../_lib/types'
import { json } from '../_lib/http'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await context.env.DB.prepare('SELECT 1 AS ok').first()
    return json({ ok: true, service: 'flowboard', db: 'up', ts: Date.now(), version: '6.0.0' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'db error'
    return json({ ok: false, service: 'flowboard', db: 'down', error: message }, 503)
  }
}
