/** JSON, cookies, CSRF/origin helpers for Pages Functions. */

const COOKIE_NAME = 'kb_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

/**
 * Build a JSON response with no-store cache policy.
 */
export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

/**
 * Read a named cookie value from the request.
 */
export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

/**
 * Serialize an httpOnly session cookie.
 */
export function sessionCookie(id: string): string {
  return [
    `${COOKIE_NAME}=${id}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/**
 * Read session id from cookie.
 */
export function readSessionId(request: Request): string | null {
  return readCookie(request, COOKIE_NAME)
}

export { SESSION_TTL_SECONDS, COOKIE_NAME }

/**
 * Reject cross-site mutating requests (CSRF defense for cookie sessions).
 */
export function assertSameOrigin(request: Request): Response | null {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return null
  }
  const origin = request.headers.get('Origin')
  if (!origin) {
    // Non-browser clients (curl/tests) may omit Origin — allow when no Origin present.
    return null
  }
  const url = new URL(request.url)
  if (origin !== url.origin) {
    return json({ error: 'Cross-origin request blocked' }, 403)
  }
  return null
}

/**
 * Parse JSON body safely.
 */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
