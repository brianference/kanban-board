/** Password hashing + JWT (HS256) for Workers — no Node bcrypt/jsonwebtoken. */

const PBKDF2_ITERATIONS = 60_000

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return toHex(arr)
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = fromHex(saltHex)
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return toHex(bits)
}

export async function createPasswordHash(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomToken(16)
  const hash = await hashPassword(password, salt)
  return { salt, hash }
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function b64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Sign a compact JWT (HS256).
 */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec = 60 * 60 * 24 * 30,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresInSec }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const data = `${h}.${p}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${b64url(sig)}`
}

/**
 * Verify JWT; returns payload or null.
 */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts as [string, string, string]
  const data = `${h}.${p}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const sig = b64urlDecode(s)
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data))
  if (!ok) return null
  try {
    const json = new TextDecoder().decode(b64urlDecode(p))
    const payload = JSON.parse(json) as Record<string, unknown>
    const exp = Number(payload.exp || 0)
    if (exp && exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function jwtSecret(env: { JWT_SECRET?: string }): string {
  return env.JWT_SECRET || 'dev-only-flowboard-jwt-secret-change-me-32'
}

/** SHA-256 hex digest (invite tokens, etc.). */
export async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}
