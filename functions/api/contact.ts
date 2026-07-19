import type { Env } from '../_lib/types'
import { assertSameOrigin, json, readJson } from '../_lib/http'
import { rateLimit } from '../_lib/auth'
import { randomToken } from '../_lib/crypto'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!rateLimit(`contact:${ip}`, 10, 3_600_000)) {
    return json({ error: 'Too many messages. Try later.' }, 429)
  }

  const body = await readJson<{
    name?: string
    email?: string
    subject?: string
    message?: string
  }>(context.request)

  const name = (body?.name || '').trim()
  const email = (body?.email || '').trim().toLowerCase()
  const subject = (body?.subject || '').trim()
  const message = (body?.message || '').trim()

  if (!name || name.length > 100) return json({ error: 'Name required' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Valid email required' }, 400)
  if (!subject || subject.length > 200) return json({ error: 'Subject required' }, 400)
  if (message.length < 10 || message.length > 5000) {
    return json({ error: 'Message must be 10–5000 characters' }, 400)
  }

  try {
    await context.env.DB.prepare(
      `INSERT INTO contact_messages (id, name, email, subject, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(randomToken(12), name, email, subject, message, Date.now())
      .run()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'store failed'
    return json({ error: msg }, 500)
  }

  return json({ ok: true, message: 'Thanks — we received your message.' }, 201)
}
