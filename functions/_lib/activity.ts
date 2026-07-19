/** Activity log + in-app notifications helpers. */
import type { Env } from './types'
import { randomToken } from './crypto'

/**
 * Append a task activity row.
 */
export async function logActivity(
  env: Env,
  taskId: string,
  userId: string | null,
  kind: string,
  message: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO task_activity (id, task_id, user_id, kind, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(randomToken(12), taskId, userId, kind, message.slice(0, 500), Date.now())
    .run()
}

/**
 * Create an in-app notification for a user.
 */
export async function notifyUser(
  env: Env,
  userId: string,
  kind: string,
  title: string,
  body: string,
  link = '',
): Promise<void> {
  if (!userId) return
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
    .bind(randomToken(12), userId, kind, title.slice(0, 120), body.slice(0, 400), link, Date.now())
    .run()
}

/**
 * Parse @mentions from comment body. Matches @email or @"Display Name" or @word.
 */
export function parseMentions(body: string): string[] {
  const found = new Set<string>()
  const emailRe = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const nameRe = /@([A-Za-z][A-Za-z0-9._-]{1,40})/g
  let m: RegExpExecArray | null
  while ((m = emailRe.exec(body))) found.add(m[1]!.toLowerCase())
  while ((m = nameRe.exec(body))) {
    const token = m[1]!
    if (!token.includes('@')) found.add(token.toLowerCase())
  }
  return [...found]
}

/**
 * Resolve mention tokens to user ids within a project.
 */
export async function resolveMentionUserIds(
  env: Env,
  projectId: string,
  tokens: string[],
): Promise<string[]> {
  if (!tokens.length) return []
  const { results } = await env.DB.prepare(
    `SELECT u.id, lower(u.email) AS email, lower(u.name) AS name
       FROM project_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.project_id = ?`,
  )
    .bind(projectId)
    .all<{ id: string; email: string; name: string }>()

  const ids = new Set<string>()
  for (const token of tokens) {
    const t = token.toLowerCase()
    for (const row of results ?? []) {
      if (row.email === t || row.name === t || row.email.startsWith(t + '@') || row.name.includes(t)) {
        ids.add(row.id)
      }
    }
  }
  return [...ids]
}
