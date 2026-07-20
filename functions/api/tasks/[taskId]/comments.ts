import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { canWrite, getTaskAccess } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'
import { bytesToBase64, resolveImageMime } from '../../../_lib/blobs'
import {
  logActivity,
  notifyUser,
  parseMentions,
  resolveMentionUserIds,
} from '../../../_lib/activity'

const MAX_BYTES = 900_000
const MAX_IMAGES = 4

/**
 * POST /api/tasks/:taskId/comments
 * JSON { body } or multipart: body + file/files images.
 * Parses @mentions and notifies project members.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const blocked = assertSameOrigin(context.request)
    if (blocked) return blocked
    const session = await requireSession(context.env, context.request)
    if (session instanceof Response) return session

    const taskId = context.params.taskId as string
    const access = await getTaskAccess(context.env, session.userId, taskId)
    if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

    const contentType = (context.request.headers.get('Content-Type') || '').toLowerCase()
    let text = ''
    const files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      let form: FormData
      try {
        form = await context.request.formData()
      } catch {
        return json({ error: 'Expected multipart form data' }, 400)
      }
      text = String(form.get('body') || '').trim()
      for (const key of ['file', 'files', 'image', 'images']) {
        for (const entry of form.getAll(key)) {
          if (entry && typeof entry !== 'string') files.push(entry as File)
        }
      }
    } else {
      const body = await readJson<{ body?: string }>(context.request)
      text = (body?.body || '').trim()
    }

    if ((!text || text.length === 0) && files.length === 0) {
      return json({ error: 'Comment text or image required' }, 400)
    }
    if (text.length > 4000) return json({ error: 'Comment too long (max 4000)' }, 400)
    if (files.length > MAX_IMAGES) {
      return json({ error: `Max ${MAX_IMAGES} images per comment` }, 400)
    }

    const id = randomToken(12)
    const now = Date.now()
    const bodyText = text || (files.length ? '(image)' : '')

    await context.env.DB.prepare(
      `INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, taskId, session.userId, bodyText, now)
      .run()

    const attachments: Array<{
      id: string
      filename: string
      contentType: string
      sizeBytes: number
      url: string
      createdAt: number
    }> = []

    for (const file of files) {
      const mime = resolveImageMime(file)
      if (!mime) {
        await context.env.DB.prepare(`DELETE FROM task_comments WHERE id = ?`).bind(id).run()
        return json({ error: `Invalid image type: ${file.name || 'file'}` }, 400)
      }
      if (file.size <= 0 || file.size > MAX_BYTES) {
        await context.env.DB.prepare(`DELETE FROM task_comments WHERE id = ?`).bind(id).run()
        return json(
          {
            error: `Image too large (${Math.round(file.size / 1024)}KB). Compress first or use a smaller file.`,
          },
          400,
        )
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const attId = randomToken(16)
      const filename = (file.name || 'image.jpg').slice(0, 120)
      const b64 = bytesToBase64(bytes)

      await context.env.DB.prepare(
        `INSERT INTO comment_attachments (id, comment_id, filename, content_type, size_bytes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(attId, id, filename, mime, bytes.byteLength, session.userId, now)
        .run()

      try {
        await context.env.DB.prepare(
          `INSERT INTO comment_attachment_blobs (attachment_id, data) VALUES (?, ?)`,
        )
          .bind(attId, b64)
          .run()
      } catch (e) {
        await context.env.DB.prepare(`DELETE FROM comment_attachments WHERE id = ?`)
          .bind(attId)
          .run()
        await context.env.DB.prepare(`DELETE FROM task_comments WHERE id = ?`).bind(id).run()
        const msg = e instanceof Error ? e.message : 'blob store failed'
        return json({ error: `Failed to store image: ${msg}` }, 500)
      }

      attachments.push({
        id: attId,
        filename,
        contentType: mime,
        sizeBytes: bytes.byteLength,
        url: `/api/comment-attachments/${attId}`,
        createdAt: now,
      })
    }

    // Mentions → notify project members
    const tokens = parseMentions(bodyText)
    const mentionedIds = await resolveMentionUserIds(context.env, access.projectId, tokens)
    const link = `/app/tasks/${taskId}`
    for (const uid of mentionedIds) {
      if (uid === session.userId) continue
      await notifyUser(
        context.env,
        uid,
        'mention',
        `${session.name || session.email} mentioned you`,
        bodyText.slice(0, 200),
        link,
      )
    }

    try {
      await logActivity(
        context.env,
        taskId,
        session.userId,
        'comment',
        attachments.length
          ? `Commented${text ? '' : ' with image'}${attachments.length > 1 ? `s (${attachments.length})` : ''}`
          : 'Commented',
      )
    } catch {
      /* optional */
    }

    return json(
      {
        ok: true,
        comment: {
          id,
          body: bodyText,
          createdAt: now,
          userName: session.name,
          userEmail: session.email,
          attachments,
          mentions: tokens,
        },
      },
      201,
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Comment failed'
    return json({ error: message }, 500)
  }
}
