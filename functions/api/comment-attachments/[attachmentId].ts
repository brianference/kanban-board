import type { Env } from '../../_lib/types'
import { assertSameOrigin, json } from '../../_lib/http'
import { requireSession } from '../../_lib/auth'
import { canWrite, getTaskAccess } from '../../_lib/tenancy'
import { d1BlobToBytes } from '../../_lib/blobs'

/**
 * GET /api/comment-attachments/:id — serve comment image (auth required).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const session = await requireSession(context.env, context.request)
    if (session instanceof Response) return session

    const attachmentId = context.params.attachmentId as string
    if (!attachmentId || attachmentId.length > 80) return json({ error: 'Not found' }, 404)

    const meta = await context.env.DB.prepare(
      `SELECT a.id, a.comment_id AS commentId, a.filename, a.content_type AS contentType,
              a.size_bytes AS sizeBytes, c.task_id AS taskId
         FROM comment_attachments a
         JOIN task_comments c ON c.id = a.comment_id
        WHERE a.id = ?`,
    )
      .bind(attachmentId)
      .first<{
        id: string
        commentId: string
        filename: string
        contentType: string
        sizeBytes: number
        taskId: string
      }>()
    if (!meta) return json({ error: 'Not found' }, 404)

    const access = await getTaskAccess(context.env, session.userId, meta.taskId)
    if (!access) return json({ error: 'Not found' }, 404)

    const blobRow = await context.env.DB.prepare(
      `SELECT data FROM comment_attachment_blobs WHERE attachment_id = ?`,
    )
      .bind(attachmentId)
      .first<{ data: unknown }>()

    const bytes = d1BlobToBytes(blobRow?.data)
    if (!bytes || bytes.byteLength === 0) {
      return json({ error: 'Image data missing' }, 404)
    }

    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const safeName = (meta.filename || 'image').replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 100)

    return new Response(copy.buffer, {
      status: 200,
      headers: {
        'Content-Type': meta.contentType || 'application/octet-stream',
        'Content-Length': String(copy.byteLength),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load image'
    return json({ error: message }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const attachmentId = context.params.attachmentId as string
  const meta = await context.env.DB.prepare(
    `SELECT a.id, c.task_id AS taskId
       FROM comment_attachments a
       JOIN task_comments c ON c.id = a.comment_id
      WHERE a.id = ?`,
  )
    .bind(attachmentId)
    .first<{ id: string; taskId: string }>()
  if (!meta) return json({ error: 'Not found' }, 404)

  const access = await getTaskAccess(context.env, session.userId, meta.taskId)
  if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

  await context.env.DB.prepare(`DELETE FROM comment_attachment_blobs WHERE attachment_id = ?`)
    .bind(attachmentId)
    .run()
  await context.env.DB.prepare(`DELETE FROM comment_attachments WHERE id = ?`)
    .bind(attachmentId)
    .run()
  return json({ ok: true })
}
