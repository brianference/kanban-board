import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { canWrite, getProjectAccess } from '../../_lib/tenancy'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const projectId = context.params.projectId as string
  const access = await getProjectAccess(context.env, session.userId, projectId)
  if (!access) return json({ error: 'Not found' }, 404)

  const project = await context.env.DB.prepare(
    `SELECT id, name, owner_id AS ownerId, created_at AS createdAt, updated_at AS updatedAt
       FROM projects WHERE id = ?`,
  )
    .bind(projectId)
    .first()

  const { results: boards } = await context.env.DB.prepare(
    `SELECT id, name, kind, created_at AS createdAt FROM boards WHERE project_id = ? ORDER BY created_at`,
  )
    .bind(projectId)
    .all()

  const { results: members } = await context.env.DB.prepare(
    `SELECT m.user_id AS userId, m.role, u.email, u.name
       FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = ?`,
  )
    .bind(projectId)
    .all()

  return json({ project, boards: boards ?? [], members: members ?? [], role: access.role })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const projectId = context.params.projectId as string
  const access = await getProjectAccess(context.env, session.userId, projectId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const body = await readJson<{ name?: string }>(context.request)
  const name = (body?.name || '').trim()
  if (!name || name.length > 120) return json({ error: 'Invalid name' }, 400)

  await context.env.DB.prepare(`UPDATE projects SET name = ?, updated_at = ? WHERE id = ?`)
    .bind(name, Date.now(), projectId)
    .run()
  return json({ ok: true })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const projectId = context.params.projectId as string
  const access = await getProjectAccess(context.env, session.userId, projectId)
  if (!access || access.role !== 'owner') return json({ error: 'Not found' }, 404)

  await context.env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(projectId).run()
  return json({ ok: true })
}
