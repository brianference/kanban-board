import type { Env, SessionUser } from './types'
import { readSessionToken, json } from './http'
import { verifyJwt, jwtSecret, hashPassword, safeEqual } from './crypto'

/**
 * Resolve JWT session user.
 */
export async function getSession(env: Env, request: Request): Promise<SessionUser | null> {
  const token = readSessionToken(request)
  if (!token) return null
  const payload = await verifyJwt(token, jwtSecret(env))
  if (!payload?.sub || !payload.email) return null
  return {
    userId: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name || ''),
  }
}

export async function requireSession(
  env: Env,
  request: Request,
): Promise<SessionUser | Response> {
  const session = await getSession(env, request)
  if (!session) return json({ error: 'Unauthorized' }, 401)
  return session
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const got = await hashPassword(password, salt)
  return safeEqual(got, expectedHash)
}

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count += 1
  return true
}
