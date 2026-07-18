/** POST /api/auth/login — email + password. */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson, sessionCookie, SESSION_TTL_SECONDS } from '../../_lib/http'
import { randomToken } from '../../_lib/crypto'
import { rateLimit, verifyPassword } from '../../_lib/auth'

interface Body {
  email?: string
  password?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!rateLimit(`login:${ip}`, 20, 60_000)) {
    return json({ error: 'Too many login attempts' }, 429)
  }

  const body = await readJson<Body>(context.request)
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password required' }, 400)
  }

  const email = body.email.trim().toLowerCase()
  if (!rateLimit(`login-email:${email}`, 10, 60_000)) {
    return json({ error: 'Too many login attempts for this account' }, 429)
  }

  const user = await context.env.DB.prepare(
    `SELECT id, email, name, password_hash, password_salt FROM users WHERE email = ?`,
  )
    .bind(email)
    .first<{
      id: string
      email: string
      name: string
      password_hash: string
      password_salt: string
    }>()

  // Constant-ish failure path
  if (!user) {
    return json({ error: 'Invalid email or password' }, 401)
  }

  const ok = await verifyPassword(body.password, user.password_salt, user.password_hash)
  if (!ok) return json({ error: 'Invalid email or password' }, 401)

  const now = Date.now()
  const sessionId = randomToken(32)
  await context.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(sessionId, user.id, now, now + SESSION_TTL_SECONDS * 1000)
    .run()

  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name } },
    200,
    { 'Set-Cookie': sessionCookie(sessionId) },
  )
}
