/** GET/DELETE /api/attachments/:attachmentId */
import type { Env } from '../../_lib/types'
import { assertSameOrigin, json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { getTaskAccess } from '../../_lib/tenancy'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const attachmentId = context.params.attachmentId as string
  const meta = await context.env.DB.prepare(
    `SELECT id, task_id AS taskId, filename, content_type AS contentType, size_bytes AS sizeBytes
       FROM task_attachments WHERE id = ?`,
  )
    .bind(attachmentId)
    .first<{
      id: string
      taskId: string
      filename: string
      contentType: string
      sizeBytes: number
    }>()

  if (!meta) return json({ error: 'Not found' }, 404)

  const access = await getTaskAccess(context.env, session.userId, meta.taskId)
  if (!access) return json({ error: 'Not found' }, 404)

  const blobRow = await context.env.DB.prepare(
    `SELECT data FROM task_attachment_blobs WHERE attachment_id = ?`,
  )
    .bind(attachmentId)
    .first<{ data: ArrayBuffer }>()

  if (!blobRow?.data) return json({ error: 'Not found' }, 404)

  return new Response(blobRow.data, {
    status: 200,
    headers: {
      'Content-Type': meta.contentType,
      'Content-Length': String(meta.sizeBytes),
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${meta.filename.replace(/"/g, '')}"`,
    },
  })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const attachmentId = context.params.attachmentId as string
  const meta = await context.env.DB.prepare(
    `SELECT id, task_id AS taskId FROM task_attachments WHERE id = ?`,
  )
    .bind(attachmentId)
    .first<{ id: string; taskId: string }>()

  if (!meta) return json({ error: 'Not found' }, 404)

  const access = await getTaskAccess(context.env, session.userId, meta.taskId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  await context.env.DB.prepare(`DELETE FROM task_attachments WHERE id = ?`)
    .bind(attachmentId)
    .run()
  // blobs cascade via FK if supported; also delete explicitly
  await context.env.DB.prepare(`DELETE FROM task_attachment_blobs WHERE attachment_id = ?`)
    .bind(attachmentId)
    .run()

  return json({ ok: true })
}
