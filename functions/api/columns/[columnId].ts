import type { Env } from '../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { canWrite, getBoardAccess } from '../../_lib/tenancy'

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const columnId = context.params.columnId as string
  const col = await context.env.DB.prepare(
    `SELECT id, board_id AS boardId, name, wip_limit AS wipLimit FROM columns WHERE id = ?`,
  )
    .bind(columnId)
    .first<{ id: string; boardId: string; name: string; wipLimit: number | null }>()
  if (!col) return json({ error: 'Not found' }, 404)

  const access = await getBoardAccess(context.env, session.userId, col.boardId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  const body = await readJson<{ name?: string; wipLimit?: number | null }>(context.request)
  const name = body?.name !== undefined ? body.name.trim().slice(0, 60) : col.name
  if (!name) return json({ error: 'name required' }, 400)

  let wip = col.wipLimit
  if (body && 'wipLimit' in body) {
    if (body.wipLimit === null || body.wipLimit === undefined) wip = null
    else if (typeof body.wipLimit === 'number' && body.wipLimit >= 0 && body.wipLimit <= 99) {
      wip = Math.floor(body.wipLimit)
    } else return json({ error: 'Invalid wipLimit' }, 400)
  }

  await context.env.DB.prepare(`UPDATE columns SET name = ?, wip_limit = ? WHERE id = ?`)
    .bind(name, wip, columnId)
    .run()
  return json({ ok: true, name, wipLimit: wip })
}
