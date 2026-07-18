/** POST /api/auth/register — email + password signup. */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson, sessionCookie, SESSION_TTL_SECONDS } from '../../_lib/http'
import { createPasswordHash, randomToken } from '../../_lib/crypto'
import { rateLimit } from '../../_lib/auth'
import { createProjectWithTemplate } from '../../_lib/project-service'

interface Body {
  email?: string
  password?: string
  name?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!rateLimit(`register:${ip}`, 10, 60_000)) {
    return json({ error: 'Too many registration attempts' }, 429)
  }

  const body = await readJson<Body>(context.request)
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password required' }, 400)
  }

  const email = normalizeEmail(body.email)
  const password = body.password
  const name = (body.name || email.split('@')[0] || 'User').trim().slice(0, 80)

  if (!validEmail(email)) return json({ error: 'Invalid email' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
  if (password.length > 128) return json({ error: 'Password too long' }, 400)

  const existing = await context.env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first()
  if (existing) return json({ error: 'Email already registered' }, 409)

  try {
    const userId = randomToken(16)
    const { salt, hash } = await createPasswordHash(password)
    const now = Date.now()
    const sessionId = randomToken(32)

    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO users (id, email, name, password_hash, password_salt, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(userId, email, name, hash, salt, now),
      context.env.DB.prepare(
        `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
      ).bind(sessionId, userId, now, now + SESSION_TTL_SECONDS * 1000),
    ])

    // First project so users land with something real
    const { projectId } = await createProjectWithTemplate(
      context.env,
      userId,
      'My first project',
      'personal',
    )

    return json(
      { ok: true, user: { id: userId, email, name }, projectId },
      201,
      { 'Set-Cookie': sessionCookie(sessionId) },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    return json({ error: message }, 500)
  }
}
