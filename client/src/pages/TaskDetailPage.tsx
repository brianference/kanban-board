import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AuthImage } from '../components/board/AuthImage'
import { CommentBody } from '../components/board/CommentBody'
import { api, type Comment, type Task } from '../lib/api'
import { useToast } from '../hooks/useToast'

type Member = { userId: string; email: string; name: string; role: string }

export function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const nav = useNavigate()
  const { push } = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [checklist, setChecklist] = useState<Array<{ id: string; title: string; done: boolean }>>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueAt, setDueAt] = useState('')
  const [comment, setComment] = useState('')
  const [commentImages, setCommentImages] = useState<File[]>([])
  const [commentBusy, setCommentBusy] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [checkTitle, setCheckTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentFileRef = useRef<HTMLInputElement>(null)
  const commentTextRef = useRef<HTMLTextAreaElement>(null)

  async function load() {
    setError(null)
    try {
      const data = await api.getTask(taskId)
      setTask(data.task)
      setChecklist(data.checklist)
      setComments(data.comments)
      setMembers(data.members || [])
      setRole(data.role)
      setTitle(data.task.title)
      setDescription(data.task.description)
      setPriority(data.task.priority)
      setDueAt(data.task.dueAt ? new Date(data.task.dueAt).toISOString().slice(0, 10) : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [taskId])

  const canWrite = role === 'owner' || role === 'member'

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateTask(taskId, {
        title,
        description,
        priority,
        dueAt: dueAt ? new Date(dueAt + 'T12:00:00').getTime() : null,
      })
      push('Task saved', 'success')
      // Return to board so priority/column changes are visible immediately
      if (task?.projectId) nav(`/app/projects/${task.projectId}`)
      else nav('/app')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deleteTask(taskId)
      push('Task deleted', 'success')
      if (task?.projectId) nav(`/app/projects/${task.projectId}`)
      else nav('/app')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Delete failed', 'error')
    } finally {
      setBusy(false)
      setConfirmDel(false)
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files?.[0]) return
    const file = files[0]
    setUploading(true)
    try {
      const result = await api.uploadAttachment(taskId, file)
      if (result.optimized) {
        const from = Math.round((result.originalBytes || file.size) / 1024)
        const to = Math.round((result.finalBytes || 0) / 1024)
        push(`Image attached (optimized ${from}KB → ${to}KB)`, 'success')
      } else {
        push('Image attached', 'success')
      }
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeAttachment(id: string) {
    try {
      await api.deleteAttachment(id)
      push('Image removed', 'success')
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not remove image', 'error')
    }
  }

  const mentionSuggestions = useMemo(() => {
    if (!mentionOpen) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter((m) => {
        if (!q) return true
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.email.split('@')[0]?.toLowerCase().includes(q)
        )
      })
      .slice(0, 6)
  }, [members, mentionOpen, mentionQuery])

  function onCommentChange(value: string) {
    setComment(value)
    const el = commentTextRef.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const m = before.match(/(^|[\s([{])@([A-Za-z0-9._%+-]*)$/)
    if (m) {
      setMentionOpen(true)
      setMentionQuery(m[2] || '')
    } else {
      setMentionOpen(false)
      setMentionQuery('')
    }
  }

  function insertMention(member: Member) {
    const el = commentTextRef.current
    const value = comment
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const after = value.slice(caret)
    const m = before.match(/(^|[\s([{])@([A-Za-z0-9._%+-]*)$/)
    if (!m) return
    const start = (m.index ?? 0) + m[1]!.length
    // Prefer short handle: name without spaces, else email local-part
    const handle = member.name.trim().includes(' ')
      ? member.email
      : member.name.trim() || member.email
    const next = `${value.slice(0, start)}@${handle} ${after}`
    setComment(next)
    setMentionOpen(false)
    setMentionQuery('')
    window.setTimeout(() => {
      const pos = start + handle.length + 2
      el?.focus()
      el?.setSelectionRange(pos, pos)
    }, 0)
  }

  function onCommentImages(files: FileList | null) {
    if (!files?.length) return
    const next = [...commentImages, ...Array.from(files)].slice(0, 4)
    setCommentImages(next)
    if (commentFileRef.current) commentFileRef.current.value = ''
  }

  async function postComment() {
    if (!comment.trim() && commentImages.length === 0) {
      push('Add text or an image', 'error')
      return
    }
    setCommentBusy(true)
    try {
      await api.addComment(taskId, comment.trim(), commentImages)
      setComment('')
      setCommentImages([])
      setMentionOpen(false)
      push('Comment posted', 'success')
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Comment failed', 'error')
    } finally {
      setCommentBusy(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="py-20 text-center text-ink-500">Loading task…</div>
      </Shell>
    )
  }

  const boardPath = task?.projectId ? `/app/projects/${task.projectId}` : '/app'

  function goToBoard() {
    nav(boardPath)
  }

  if (error || !task) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="font-medium text-red-600">{error || 'Task not found'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn" onClick={() => nav(-1)}>
              Go back
            </button>
            <Link to="/app" className="btn btn-primary">
              Dashboard
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Seo title={task.title} description={task.description.slice(0, 150)} path={`/app/tasks/${taskId}`} noIndex />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/app' },
            {
              label: task.projectName || 'Project',
              to: boardPath,
            },
            { label: task.title },
          ]}
        />
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
          <span className="chip">{task.boardName}</span>
          <span className="chip">{task.columnName}</span>
          <span className="chip">{task.priority}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">{task.title}</h1>
          <button type="button" className="btn btn-sm" onClick={goToBoard}>
            ← Back to board
          </button>
        </div>

        <form className="card mt-8 space-y-5" onSubmit={(e) => void save(e)}>
          <div>
            <label className="label" htmlFor="t-title">
              Title
            </label>
            <input
              id="t-title"
              className="input"
              value={title}
              disabled={!canWrite}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="t-desc">
              Description
            </label>
            <textarea
              id="t-desc"
              className="input min-h-[140px]"
              value={description}
              disabled={!canWrite}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="t-pri">
                Priority
              </label>
              <select
                id="t-pri"
                className="input"
                value={priority}
                disabled={!canWrite}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-due">
                Due date
              </label>
              <input
                id="t-due"
                type="date"
                className="input"
                value={dueAt}
                disabled={!canWrite}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save & return to board'}
                </button>
                <button type="button" className="btn" onClick={goToBoard} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setConfirmDel(true)}>
                  Delete task
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={goToBoard}>
                Back to board
              </button>
            )}
          </div>
        </form>

        <section className="card mt-6">
          <h2 className="font-display text-lg font-bold">Images</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            PNG, JPEG, GIF, or WebP. Large images are auto-resized and compressed before upload.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(task.attachments || []).map((a) => (
              <div key={a.id} className="group relative">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-[var(--border)]"
                  title={a.filename}
                >
                  <AuthImage
                    src={a.url}
                    alt={a.filename}
                    className="h-24 w-24 object-cover"
                    width={96}
                    height={96}
                  />
                </a>
                {canWrite ? (
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--danger)] shadow-soft"
                    aria-label={`Remove ${a.filename}`}
                    onClick={() => void removeAttachment(a.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {(task.attachments || []).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No images yet.</p>
            ) : null}
          </div>
          {canWrite ? (
            <label className="mt-4 block">
              <span className="btn inline-flex cursor-pointer">
                {uploading ? 'Optimizing & uploading…' : 'Choose image'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => void onUpload(e.target.files)}
              />
            </label>
          ) : null}
        </section>

        <section className="card mt-6">
          <h2 className="font-display text-lg font-bold">Checklist</h2>
          <ul className="mt-4 space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!canWrite}
                  onChange={() =>
                    void api.patchChecklist(item.id, { done: !item.done }).then(load)
                  }
                />
                <span className={item.done ? 'text-ink-500 line-through' : ''}>{item.title}</span>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-4 flex gap-2">
              <input
                className="input"
                placeholder="Add subtask"
                value={checkTitle}
                onChange={(e) => setCheckTitle(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const t = checkTitle.trim()
                  if (!t) {
                    push('Enter a checklist item', 'error')
                    return
                  }
                  void api
                    .addChecklist(taskId, t)
                    .then(() => {
                      setCheckTitle('')
                      push('Checklist item added', 'success')
                      return load()
                    })
                    .catch((err) =>
                      push(err instanceof Error ? err.message : 'Could not add item', 'error'),
                    )
                }}
              >
                Add
              </button>
            </div>
          ) : null}
        </section>

        <section className="card mt-6">
          <h2 className="font-display text-lg font-bold">Comments</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Type <strong>@name</strong> or <strong>@email</strong> to tag teammates. Attach images
            below (up to 4).
          </p>
          <ul className="mt-4 space-y-3">
            {comments.length === 0 ? (
              <li className="text-sm text-[var(--text-muted)]">No comments yet.</li>
            ) : null}
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
              >
                <p className="text-sm font-semibold text-[var(--text)]">
                  {c.userName || c.userEmail}{' '}
                  <span className="font-normal text-[var(--text-muted)]">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </p>
                {c.body && c.body !== '(image)' ? <CommentBody body={c.body} /> : null}
                {(c.attachments?.length ?? 0) > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.attachments!.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-[var(--border)]"
                        title={a.filename}
                      >
                        <AuthImage
                          src={a.url}
                          alt={a.filename}
                          className="h-20 w-20 object-cover"
                          width={80}
                          height={80}
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="relative mt-4 space-y-2">
              {members.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Tag:</span>
                  {members.slice(0, 8).map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      onClick={() => insertMention(m)}
                    >
                      @{m.name.trim().includes(' ') ? m.email.split('@')[0] : m.name || m.email.split('@')[0]}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="relative">
                <textarea
                  ref={commentTextRef}
                  className="input min-h-[100px]"
                  placeholder="Write a comment… @name or @email · #tag optional"
                  value={comment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setMentionOpen(false)
                  }}
                />
                {mentionOpen && mentionSuggestions.length > 0 ? (
                  <ul
                    className="absolute bottom-full left-0 z-20 mb-1 max-h-40 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
                    role="listbox"
                  >
                    {mentionSuggestions.map((m) => (
                      <li key={m.userId}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                          onClick={() => insertMention(m)}
                        >
                          <span className="font-semibold text-[var(--text)]">
                            {m.name || m.email}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{m.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {commentImages.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {commentImages.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                    >
                      <span className="max-w-[10rem] truncate">{f.name}</span>
                      <span className="text-[var(--text-muted)]">
                        {Math.round(f.size / 1024)}KB
                      </span>
                      <button
                        type="button"
                        className="font-bold text-[var(--danger)]"
                        aria-label={`Remove ${f.name}`}
                        onClick={() =>
                          setCommentImages((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn btn-sm cursor-pointer">
                  {commentImages.length >= 4 ? 'Max 4 images' : 'Add images'}
                  <input
                    ref={commentFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                    className="sr-only"
                    multiple
                    disabled={commentBusy || commentImages.length >= 4}
                    onChange={(e) => onCommentImages(e.target.files)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={commentBusy}
                  onClick={() => void postComment()}
                >
                  {commentBusy ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <ConfirmDialog
        open={confirmDel}
        title="Delete this task?"
        message="This permanently deletes the task and its comments/images."
        busy={busy}
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => void remove()}
      />
    </Shell>
  )
}
