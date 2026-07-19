/** Cloudflare Pages Function environment. */
export interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export interface SessionUser {
  userId: string
  email: string
  name: string
}

export type MemberRole = 'owner' | 'member' | 'viewer'
