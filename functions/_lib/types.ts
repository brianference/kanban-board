/** Cloudflare Pages Function environment bindings. */
export interface Env {
  DB: D1Database
  /** Optional R2 — not required; images use D1 blobs when unset. */
  ATTACHMENTS?: R2Bucket
}

export interface SessionUser {
  userId: string
  email: string
  name: string
}

export type MemberRole = 'owner' | 'member' | 'viewer'
