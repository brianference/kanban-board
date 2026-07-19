import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { canWrite, getTaskAccess } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'
import { bytesToBase64, resolveImageMime } from '../../../_lib/blobs'

/** D1 value size is tight; keep under ~1MB after base64 (~0.75MB raw). */
const MAX_BYTES = 900_000

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const blocked = assertSameOrigin(context.request)
    if (blocked) return blocked
    const session = await requireSession(context.env, context.request)
    if (session instanceof Response) return session

    const taskId = context.params.taskId as string
    const access = await getTaskAccess(context.env, session.userId, taskId)
    if (!access || !canWrite(access.role)) return json({ error: 'Not found' }, 404)

    const countRow = await context.env.DB.prepare(
      `SELECT COUNT(*) AS c FROM task_attachments WHERE task_id = ?`,
    )
      .bind(taskId)
      .first<{ c: number }>()
    if ((countRow?.c ?? 0) >= 8) return json({ error: 'Max 8 images per task' }, 400)

    let form: FormData
    try {
      form = await context.request.formData()
    } catch {
      return json({ error: 'Expected multipart form data' }, 400)
    }
    const file = form.get('file')
    if (!file || typeof file === 'string') return json({ error: 'file field required' }, 400)

    const blob = file as File
    const contentType = resolveImageMime(blob)
    if (!contentType) {
      return json(
        {
          error: `Only JPEG, PNG, GIF, or WebP images allowed (got type "${blob.type || 'unknown'}")`,
        },
        400,
      )
    }
    if (blob.size <= 0) return json({ error: 'Empty file' }, 400)
    if (blob.size > MAX_BYTES) {
      return json(
        {
          error: `Image is too large (${Math.round(blob.size / 1024)}KB). Max is ${Math.round(MAX_BYTES / 1024)}KB — compress or resize the PNG.`,
        },
        400,
      )
    }

    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength === 0) return json({ error: 'Could not read image bytes' }, 400)

    // PNG/JPEG magic-byte check (catches renamed non-images)
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isGif =
      bytes.length >= 6 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    const isWebp =
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    if (!isPng && !isJpeg && !isGif && !isWebp) {
      return json({ error: 'File does not look like a valid image' }, 400)
    }

    const id = randomToken(16)
    const filename = (blob.name || 'image.png').slice(0, 120)
    const now = Date.now()
    const b64 = bytesToBase64(bytes)

    await context.env.DB.prepare(
      `INSERT INTO task_attachments (id, task_id, filename, content_type, size_bytes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, taskId, filename, contentType, bytes.byteLength, session.userId, now)
      .run()

    try {
      await context.env.DB.prepare(
        `INSERT INTO task_attachment_blobs (attachment_id, data) VALUES (?, ?)`,
      )
        .bind(id, b64)
        .run()
    } catch (blobErr) {
      // Roll back meta so we don't leave broken thumbnails
      await context.env.DB.prepare(`DELETE FROM task_attachments WHERE id = ?`).bind(id).run()
      const msg = blobErr instanceof Error ? blobErr.message : 'blob store failed'
      return json({ error: `Failed to store image: ${msg}` }, 500)
    }

    return json(
      {
        ok: true,
        attachment: {
          id,
          filename,
          contentType,
          sizeBytes: bytes.byteLength,
          url: `/api/attachments/${id}`,
          createdAt: now,
        },
      },
      201,
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    return json({ error: message }, 500)
  }
}
