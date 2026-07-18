/** Password hashing and random ids using Web Crypto (Workers-safe). */

/** Edge-safe iteration count (Workers CPU budget). Raise later with async job if needed. */
const PBKDF2_ITERATIONS = 60_000

/**
 * Hex-encode bytes.
 */
export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Decode hex string to bytes.
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex salt')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * URL-safe random hex token.
 */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return toHex(arr)
}

/**
 * SHA-256 hex of a string.
 */
export async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return toHex(buf)
}

/**
 * Derive a password hash with PBKDF2-SHA-256.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const saltBytes = fromHex(saltHex)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return toHex(bits)
}

/**
 * Generate a new salt + password hash pair.
 */
export async function createPasswordHash(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomToken(16)
  const hash = await hashPassword(password, salt)
  return { salt, hash }
}

/**
 * Constant-time-ish string compare (length leak only).
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

export { PBKDF2_ITERATIONS }
