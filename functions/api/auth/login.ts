import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson, sessionCookie } from '../../_lib/http'
import { rateLimit, verifyPassword } from '../../_lib/auth'
import { signJwt, jwtSecret } from '../../_lib/crypto'

interface Body {
  email?: string
  password?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!rateLimit(`login:${ip}`, 30, 60_000)) {
    return json({ error: 'Too many login attempts' }, 429)
  }

  const body = await readJson<Body>(context.request)
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password required' }, 400)
  }

  const email = body.email.trim().toLowerCase()
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

  if (!user) return json({ error: 'Invalid email or password' }, 401)
  const ok = await verifyPassword(body.password, user.password_salt, user.password_hash)
  if (!ok) return json({ error: 'Invalid email or password' }, 401)

  const token = await signJwt(
    { sub: user.id, email: user.email, name: user.name },
    jwtSecret(context.env),
  )

  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name }, token },
    200,
    { 'Set-Cookie': sessionCookie(token) },
  )
}
