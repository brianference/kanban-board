/** POST /api/tasks/:taskId/move — atomic column + position update */
import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { getTaskAccess } from '../../../_lib/tenancy'
import { logActivity, notifyUser } from '../../../_lib/activity'

interface Body {
  columnId?: string
  position?: number
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  const body = await readJson<Body>(context.request)
  if (!body?.columnId || typeof body.position !== 'number') {
    return json({ error: 'columnId and position required' }, 400)
  }

  const col = await context.env.DB.prepare(
    `SELECT id, name, wip_limit AS wipLimit FROM columns WHERE id = ? AND board_id = ?`,
  )
    .bind(body.columnId, access.boardId)
    .first<{ id: string; name: string; wipLimit: number | null }>()
  if (!col) return json({ error: 'Invalid column' }, 400)

  // Enforce WIP limit (exclude the task being moved into the column)
  if (col.wipLimit != null && col.wipLimit > 0) {
    const count = await context.env.DB.prepare(
      `SELECT COUNT(*) AS c FROM tasks
        WHERE board_id = ? AND column_id = ? AND deleted_at IS NULL AND id != ?`,
    )
      .bind(access.boardId, body.columnId, taskId)
      .first<{ c: number }>()
    if ((count?.c ?? 0) >= col.wipLimit) {
      return json(
        { error: `WIP limit reached for “${col.name}” (${col.wipLimit})` },
        400,
      )
    }
  }

  const task = await context.env.DB.prepare(
    `SELECT title, assignee_id AS assigneeId FROM tasks WHERE id = ?`,
  )
    .bind(taskId)
    .first<{ title: string; assigneeId: string | null }>()

  const now = Date.now()
  await context.env.DB.prepare(
    `UPDATE tasks SET column_id = ?, position = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(body.columnId, body.position, now, taskId)
    .run()

  await logActivity(
    context.env,
    taskId,
    session.userId,
    'move',
    `Moved to ${col.name}`,
  )

  if (task?.assigneeId && task.assigneeId !== session.userId) {
    await notifyUser(
      context.env,
      task.assigneeId,
      'move',
      `Moved: ${task.title}`,
      `Now in ${col.name}`,
      `/app/projects/${access.projectId}?task=${taskId}`,
    )
  }

  await context.env.DB.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .bind(now, access.projectId)
    .run()

  return json({ ok: true })
}
