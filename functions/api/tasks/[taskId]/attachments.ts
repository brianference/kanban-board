/** POST /api/tasks/:taskId/attachments — upload image (multipart field "file") */
import type { Env } from '../../../_lib/types'
import { assertSameOrigin, json } from '../../../_lib/http'
import { requireSession } from '../../../_lib/auth'
import { getTaskAccess } from '../../../_lib/tenancy'
import { randomToken } from '../../../_lib/crypto'

const MAX_BYTES = 1_500_000 // 1.5 MB
const MAX_PER_TASK = 8
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blocked = assertSameOrigin(context.request)
  if (blocked) return blocked

  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access || access.role === 'viewer') return json({ error: 'Not found' }, 404)

  const countRow = await context.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM task_attachments WHERE task_id = ?`,
  )
    .bind(taskId)
    .first<{ c: number }>()
  if ((countRow?.c ?? 0) >= MAX_PER_TASK) {
    return json({ error: `Max ${MAX_PER_TASK} images per task` }, 400)
  }

  let form: FormData
  try {
    form = await context.request.formData()
  } catch {
    return json({ error: 'Expected multipart form data' }, 400)
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return json({ error: 'file field required' }, 400)
  }

  const blob = file as File
  const contentType = (blob.type || 'application/octet-stream').toLowerCase()
  if (!ALLOWED.has(contentType)) {
    return json({ error: 'Only JPEG, PNG, GIF, or WebP images allowed' }, 400)
  }
  if (blob.size <= 0 || blob.size > MAX_BYTES) {
    return json({ error: `Image must be under ${Math.round(MAX_BYTES / 1000)}KB` }, 400)
  }

  const bytes = new Uint8Array(await blob.arrayBuffer())
  const id = randomToken(16)
  const filename = (blob.name || 'image').slice(0, 120)
  const now = Date.now()

  await context.env.DB.prepare(
    `INSERT INTO task_attachments (id, task_id, filename, content_type, size_bytes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, taskId, filename, contentType, bytes.byteLength, session.userId, now)
    .run()

  await context.env.DB.prepare(
    `INSERT INTO task_attachment_blobs (attachment_id, data) VALUES (?, ?)`,
  )
    .bind(id, bytes)
    .run()

  await context.env.DB.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .bind(now, access.projectId)
    .run()

  return json(
    {
      ok: true,
      attachment: {
        id,
        taskId,
        filename,
        contentType,
        sizeBytes: bytes.byteLength,
        url: `/api/attachments/${id}`,
        createdAt: now,
      },
    },
    201,
  )
}

/** GET /api/tasks/:taskId/attachments — list metadata */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSession(context.env, context.request)
  if (session instanceof Response) return session

  const taskId = context.params.taskId as string
  const access = await getTaskAccess(context.env, session.userId, taskId)
  if (!access) return json({ error: 'Not found' }, 404)

  const { results } = await context.env.DB.prepare(
    `SELECT id, task_id AS taskId, filename, content_type AS contentType,
            size_bytes AS sizeBytes, created_at AS createdAt
       FROM task_attachments WHERE task_id = ? ORDER BY created_at ASC`,
  )
    .bind(taskId)
    .all()

  const attachments = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      ...r,
      url: `/api/attachments/${r.id}`,
    }
  })

  return json({ attachments })
}
