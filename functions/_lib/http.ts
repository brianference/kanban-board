/** JSON + cookie helpers. */

const COOKIE = 'fb_token'
const MAX_AGE = 60 * 60 * 24 * 30

export function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  })
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('Cookie') || ''
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

export function sessionCookie(token: string): string {
  return [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`,
  ].join('; ')
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function readSessionToken(request: Request): string | null {
  const bearer = request.headers.get('Authorization')
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7)
  return readCookie(request, COOKIE)
}

export function assertSameOrigin(request: Request): Response | null {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return null
  }
  const origin = request.headers.get('Origin')
  if (!origin) return null
  const url = new URL(request.url)
  if (origin !== url.origin) {
    return json({ error: 'Cross-origin request blocked' }, 403)
  }
  return null
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export { COOKIE, MAX_AGE }
