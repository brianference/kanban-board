/** POST /api/invites/accept — accept invite by token (authenticated) */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { sha256hex } from '../../_lib/crypto'

interface Body {
  token?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const body = await readJson<Body>(context.request)
  if (!body?.token) return json({ error: 'token required' }, 400)

  const tokenHash = await sha256hex(body.token)
  const invite = await context.env.DB.prepare(
    `SELECT id, project_id AS projectId, email, role, expires_at AS expiresAt, accepted_at AS acceptedAt
       FROM invites WHERE token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      id: string
      projectId: string
      email: string
      role: 'member' | 'viewer'
      expiresAt: number
      acceptedAt: number | null
    }>()

  if (!invite) return json({ error: 'Invite not found' }, 404)
  if (invite.acceptedAt) return json({ error: 'Invite already used' }, 410)
  if (invite.expiresAt < Date.now()) return json({ error: 'Invite expired' }, 410)
  if (invite.email !== session.email) {
    return json({ error: 'Invite email does not match signed-in account' }, 403)
  }

  const now = Date.now()
  const existing = await context.env.DB.prepare(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`,
  )
    .bind(invite.projectId, session.userId)
    .first()

  if (!existing) {
    await context.env.DB.prepare(
      `INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(invite.projectId, session.userId, invite.role, now)
      .run()
  }

  await context.env.DB.prepare(
    `UPDATE invites SET accepted_at = ? WHERE id = ?`,
  )
    .bind(now, invite.id)
    .run()

  return json({ ok: true, projectId: invite.projectId })
}
