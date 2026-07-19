/** GET/POST saved filter views for a project */
import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { requireProjectRead } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const projectId = context.params.projectId as string
  const access = await requireProjectRead(context.env, session, projectId)
  if (!access) return json({ error: 'Not found' }, 404)

  const { results } = await context.env.DB.prepare(
    `SELECT id, name, filters_json AS filtersJson, created_at AS createdAt
       FROM saved_views
      WHERE user_id = ? AND project_id = ?
      ORDER BY created_at DESC`,
  )
    .bind(session.userId, projectId)
    .all()

  const views = (results ?? []).map((r) => {
    const row = r as { id: string; name: string; filtersJson: string; createdAt: number }
    let filters: unknown = {}
    try {
      filters = JSON.parse(row.filtersJson)
    } catch {
      filters = {}
    }
    return { id: row.id, name: row.name, filters, createdAt: row.createdAt }
  })

  return json({ views })
}

interface Body {
  name?: string
  filters?: unknown
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const projectId = context.params.projectId as string
  const access = await requireProjectRead(context.env, session, projectId)
  if (!access) return json({ error: 'Not found' }, 404)

  const body = await readJson<Body>(context.request)
  const name = (body?.name || '').trim().slice(0, 80)
  if (!name) return json({ error: 'name required' }, 400)

  const id = randomToken(12)
  const now = Date.now()
  await context.env.DB.prepare(
    `INSERT INTO saved_views (id, user_id, project_id, name, filters_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, session.userId, projectId, name, JSON.stringify(body?.filters ?? {}), now)
    .run()

  return json({ ok: true, view: { id, name, filters: body?.filters ?? {}, createdAt: now } }, 201)
}
