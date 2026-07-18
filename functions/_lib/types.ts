/** Cloudflare Pages Function environment bindings. */
export interface Env {
  DB: D1Database
}

export interface SessionUser {
  userId: string
  email: string
  name: string
}

export type MemberRole = 'owner' | 'member' | 'viewer'
