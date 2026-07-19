import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AuthImage } from '../components/board/AuthImage'
import { api, type Task } from '../lib/api'
import { useToast } from '../hooks/useToast'

export function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const nav = useNavigate()
  const { push } = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [checklist, setChecklist] = useState<Array<{ id: string; title: string; done: boolean }>>([])
  const [comments, setComments] = useState<
    Array<{ id: string; body: string; createdAt: number; userName?: string; userEmail?: string }>
  >([])
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueAt, setDueAt] = useState('')
  const [comment, setComment] = useState('')
  const [checkTitle, setCheckTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setError(null)
    try {
      const data = await api.getTask(taskId)
      setTask(data.task)
      setChecklist(data.checklist)
      setComments(data.comments)
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
      await load()
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
      await api.uploadAttachment(taskId, file)
      push('Image attached', 'success')
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

  if (loading) {
    return (
      <Shell>
        <div className="py-20 text-center text-ink-500">Loading task…</div>
      </Shell>
    )
  }

  if (error || !task) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="font-medium text-red-600">{error || 'Task not found'}</p>
          <Link to="/app" className="btn mt-6">
            Back to dashboard
          </Link>
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
              to: task.projectId ? `/app/projects/${task.projectId}` : '/app',
            },
            { label: task.title },
          ]}
        />
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
          <span className="chip">{task.boardName}</span>
          <span className="chip">{task.columnName}</span>
          <span className="chip">{task.priority}</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">{task.title}</h1>

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
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDel(true)}>
                Delete task
              </button>
            </div>
          ) : null}
        </form>

        <section className="card mt-6">
          <h2 className="font-display text-lg font-bold">Images</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            PNG, JPEG, GIF, or WebP — max ~900KB each (large screenshots may need resizing).
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
                {uploading ? 'Uploading…' : 'Choose image'}
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
                onClick={() =>
                  void api.addChecklist(taskId, checkTitle).then(() => {
                    setCheckTitle('')
                    return load()
                  })
                }
              >
                Add
              </button>
            </div>
          ) : null}
        </section>

        <section className="card mt-6">
          <h2 className="font-display text-lg font-bold">Comments</h2>
          <ul className="mt-4 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold">
                  {c.userName || c.userEmail}{' '}
                  <span className="font-normal text-ink-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{c.body}</p>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-4 space-y-2">
              <textarea
                className="input min-h-[100px]"
                placeholder="Write a comment… use @email to mention"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void api.addComment(taskId, comment).then(() => {
                    setComment('')
                    return load()
                  })
                }
              >
                Post comment
              </button>
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
