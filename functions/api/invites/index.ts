/** POST /api/invites — create share invite for a project */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { requireProjectWrite } from '../../_lib/tenancy'
import { randomToken, sha256hex } from '../../_lib/crypto'

interface Body {
  projectId?: string
  email?: string
  role?: 'member' | 'viewer'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const body = await readJson<Body>(context.request)
  if (!body?.projectId || !body?.email) {
    return json({ error: 'projectId and email required' }, 400)
  }

  const access = await requireProjectWrite(context.env, session, body.projectId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)
  // Only owner/member can invite; prefer owner for production but allow member

  const email = body.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email' }, 400)
  }

  const role = body.role === 'viewer' ? 'viewer' : 'member'
  const token = randomToken(24)
  const tokenHash = await sha256hex(token)
  const id = randomToken(16)
  const now = Date.now()
  const expires = now + 7 * 24 * 60 * 60 * 1000

  await context.env.DB.prepare(
    `INSERT INTO invites (id, project_id, email, role, token_hash, invited_by, created_at, expires_at, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  )
    .bind(id, body.projectId, email, role, tokenHash, session.userId, now, expires)
    .run()

  // Token returned once so client can show share link (no email provider).
  return json({
    ok: true,
    inviteId: id,
    token,
    sharePath: `/invite/${token}`,
    expiresAt: expires,
  }, 201)
}
