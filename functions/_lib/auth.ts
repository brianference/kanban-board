/** Session resolution and rate-limit helpers. */
import type { Env, SessionUser } from './types'
import { readSessionId } from './http'
import { hashPassword, safeEqual } from './crypto'

/**
 * Resolve the current session user from the cookie, or null.
 */
export async function getSession(env: Env, request: Request): Promise<SessionUser | null> {
  const sid = readSessionId(request)
  if (!sid) return null
  const row = await env.DB.prepare(
    `SELECT s.user_id AS userId, u.email AS email, u.name AS name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sid, Date.now())
    .first<{ userId: string; email: string; name: string }>()
  return row ?? null
}

/**
 * Require a session or return 401 payload.
 */
export async function requireSession(
  env: Env,
  request: Request,
): Promise<SessionUser | Response> {
  const session = await getSession(env, request)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  return session
}

/**
 * Verify email/password against stored hash.
 */
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const got = await hashPassword(password, salt)
  return safeEqual(got, expectedHash)
}

/** In-memory rate limit buckets (per isolate; best-effort on edge). */
const buckets = new Map<string, { count: number; resetAt: number }>()

/**
 * Simple sliding window rate limit. Returns true if allowed.
 */
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
