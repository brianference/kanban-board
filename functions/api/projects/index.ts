import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { createProjectWithTemplate } from '../../_lib/project-service'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const { results } = await context.env.DB.prepare(
    `SELECT p.id, p.name, p.owner_id AS ownerId, p.created_at AS createdAt,
            p.updated_at AS updatedAt, m.role AS role
       FROM projects p
       JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
      ORDER BY p.updated_at DESC`,
  )
    .bind(session.userId)
    .all()

  return json({ projects: results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const body = await readJson<{ name?: string; template?: string }>(context.request)
  const name = (body?.name || '').trim()
  if (!name || name.length > 120) {
    return json({ error: 'Project name required (max 120 chars)' }, 400)
  }

  const { projectId, boardId } = await createProjectWithTemplate(
    context.env,
    session.userId,
    name,
    body?.template,
  )
  return json({ ok: true, projectId, boardId }, 201)
}
