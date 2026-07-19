/**
 * D1-safe binary helpers. Storing raw BLOB via Uint8Array is unreliable
 * across Workers/D1 versions; base64 TEXT in the BLOB column is stable.
 */

const CHUNK = 0x8000

/**
 * Encode bytes to base64 (chunked — avoids stack overflow on large files).
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

/**
 * Decode base64 to bytes.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * Normalize a D1 BLOB cell (ArrayBuffer | Uint8Array | base64 string) to bytes.
 */
export function d1BlobToBytes(data: unknown): Uint8Array | null {
  if (data == null) return null
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (data instanceof Uint8Array) return data
  if (typeof data === 'string') {
    if (!data) return null
    // Prefer base64; fall back to raw binary string
    try {
      if (/^[A-Za-z0-9+/=\s]+$/.test(data) && data.length >= 4) {
        return base64ToBytes(data.replace(/\s/g, ''))
      }
    } catch {
      /* fall through */
    }
    const out = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i++) out[i] = data.charCodeAt(i) & 0xff
    return out
  }
  // Some D1 drivers return number[]
  if (Array.isArray(data)) return new Uint8Array(data as number[])
  return null
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

/**
 * Resolve image content-type from File type and/or filename extension.
 */
export function resolveImageMime(file: File): string | null {
  const raw = (file.type || '').toLowerCase().trim()
  if (raw === 'image/png' || raw === 'image/jpeg' || raw === 'image/gif' || raw === 'image/webp') {
    return raw
  }
  if (raw === 'image/jpg') return 'image/jpeg'
  const name = (file.name || '').toLowerCase()
  const m = name.match(/\.([a-z0-9]+)$/)
  if (m?.[1] && EXT_MIME[m[1]]) return EXT_MIME[m[1]]
  return null
}
