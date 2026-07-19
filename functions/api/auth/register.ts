import type { Env } from '../../_lib/types'
import {
  assertSameOrigin,
  json,
  readJson,
  sessionCookie,
} from '../../_lib/http'
import { createPasswordHash, randomToken, signJwt, jwtSecret } from '../../_lib/crypto'
import { rateLimit } from '../../_lib/auth'
import { createProjectWithTemplate } from '../../_lib/project-service'

interface Body {
  email?: string
  password?: string
  name?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!rateLimit(`reg:${ip}`, 15, 60_000)) {
    return json({ error: 'Too many registration attempts' }, 429)
  }

  const body = await readJson<Body>(context.request)
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password required' }, 400)
  }
  const email = body.email.trim().toLowerCase()
  const password = body.password
  const name = (body.name || email.split('@')[0] || 'User').trim().slice(0, 80)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'Invalid email' }, 400)
  }
  if (password.length < 8 || password.length > 128) {
    return json({ error: 'Password must be 8–128 characters' }, 400)
  }

  const existing = await context.env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first()
  if (existing) return json({ error: 'Email already registered' }, 409)

  const userId = randomToken(16)
  const { salt, hash } = await createPasswordHash(password)
  const now = Date.now()

  await context.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(userId, email, name, hash, salt, now)
    .run()

  const { projectId } = await createProjectWithTemplate(
    context.env,
    userId,
    'My first project',
    'personal',
  )

  const token = await signJwt(
    { sub: userId, email, name },
    jwtSecret(context.env),
  )

  return json(
    { ok: true, user: { id: userId, email, name }, projectId, token },
    201,
    { 'Set-Cookie': sessionCookie(token) },
  )
}
