import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { canWrite, getTaskAccess } from '../../../_lib/tenancy'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const body = await readJson<{ columnId?: string; position?: number }>(context.request)
  if (!body?.columnId || typeof body.position !== 'number') {
    return json({ error: 'columnId and position required' }, 400)
  }

  const col = await context.env.DB.prepare(
    `SELECT id, name, wip_limit AS wipLimit FROM columns WHERE id = ? AND board_id = ?`,
  )
    .bind(body.columnId, access.boardId)
    .first<{ id: string; name: string; wipLimit: number | null }>()
  if (!col) return json({ error: 'Invalid column' }, 400)

  if (col.wipLimit != null && col.wipLimit > 0) {
    const count = await context.env.DB.prepare(
      `SELECT COUNT(*) AS c FROM tasks
        WHERE board_id = ? AND column_id = ? AND deleted_at IS NULL AND id != ?`,
    )
      .bind(access.boardId, body.columnId, taskId)
      .first<{ c: number }>()
    if ((count?.c ?? 0) >= col.wipLimit) {
      return json({ error: `WIP limit reached for “${col.name}”` }, 400)
    }
  }

  const now = Date.now()
  await context.env.DB.prepare(
    `UPDATE tasks SET column_id = ?, position = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(body.columnId, body.position, now, taskId)
    .run()
  await context.env.DB.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .bind(now, access.projectId)
    .run()
  return json({ ok: true })
}
