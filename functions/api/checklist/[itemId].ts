import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { canWrite, getTaskAccess } from '../../_lib/tenancy'

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const itemId = context.params.itemId as string
  const item = await context.env.DB.prepare(
    `SELECT id, task_id AS taskId, title, done FROM task_checklist_items WHERE id = ?`,
  )
    .bind(itemId)
    .first<{ id: string; taskId: string; title: string; done: number }>()
  if (!item) return json({ error: 'Not found' }, 404)

  const access = await getTaskAccess(context.env, session.userId, item.taskId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const body = await readJson<{ title?: string; done?: boolean }>(context.request)
  const title = body?.title !== undefined ? body.title.trim().slice(0, 200) : item.title
  const done = body?.done !== undefined ? (body.done ? 1 : 0) : item.done
  if (!title) return json({ error: 'title required' }, 400)

  await context.env.DB.prepare(
    `UPDATE task_checklist_items SET title = ?, done = ? WHERE id = ?`,
  )
    .bind(title, done, itemId)
    .run()
  return json({ ok: true })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const itemId = context.params.itemId as string
  const item = await context.env.DB.prepare(
    `SELECT id, task_id AS taskId FROM task_checklist_items WHERE id = ?`,
  )
    .bind(itemId)
    .first<{ id: string; taskId: string }>()
  if (!item) return json({ error: 'Not found' }, 404)

  const access = await getTaskAccess(context.env, session.userId, item.taskId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  await context.env.DB.prepare(`DELETE FROM task_checklist_items WHERE id = ?`).bind(itemId).run()
  return json({ ok: true })
}
