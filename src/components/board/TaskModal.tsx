import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Column, Priority, ProjectMember, Task, TaskAttachment } from '../../types/models'
import { api } from '../../lib/api'

export interface TaskFormState {
  title: string
  description: string
  priority: Priority
  columnId: string
  dueAt: string
  assigneeId: string
  tags: string
}

/**
 * Accessible task create/edit modal with image attachments.
 */
export function TaskModal({
  open,
  title,
  columns,
  members,
  initial,
  taskId,
  canWrite,
  initialAttachments = [],
  onClose,
  onSave,
  onDelete,
  showMoveSheet,
  onMoveToColumn,
  onAttachmentsChange,
}: {
  open: boolean
  title: string
  columns: Column[]
  members: ProjectMember[]
  initial: TaskFormState
  /** Existing task id — required before images can be uploaded. */
  taskId?: string | null
  canWrite?: boolean
  initialAttachments?: TaskAttachment[]
  onClose: () => void
  onSave: (form: TaskFormState) => Promise<void>
  onDelete?: () => Promise<void>
  showMoveSheet?: boolean
  onMoveToColumn?: (columnId: string) => Promise<void>
  onAttachmentsChange?: () => void
}) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<TaskAttachment[]>(initialAttachments)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const titleId = useId()
  const firstRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(initial)
      setAttachments(initialAttachments)
      setError(null)
      setPreviewUrl(null)
      window.setTimeout(() => firstRef.current?.focus(), 0)
    }
  }, [open, initial, initialAttachments])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (previewUrl) setPreviewUrl(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, previewUrl])

  if (!open) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function onFileChange(fileList: FileList | null) {
    if (!fileList?.length || !taskId || !canWrite) return
    const file = fileList[0]!
    setUploading(true)
    setError(null)
    try {
      const res = await api.uploadAttachment(taskId, file)
      setAttachments((list) => [...list, res.attachment])
      onAttachmentsChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAttachment(id: string) {
    if (!canWrite) return
    setUploading(true)
    setError(null)
    try {
      await api.deleteAttachment(id)
      setAttachments((list) => list.filter((a) => a.id !== id))
      onAttachmentsChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <form className="stack" onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              ref={firstRef}
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="task-desc">Description</label>
            <textarea
              id="task-desc"
              maxLength={5000}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="task-col">Column</label>
            <select
              id="task-col"
              value={form.columnId}
              onChange={(e) => setForm((f) => ({ ...f, columnId: e.target.value }))}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-pri">Priority</label>
            <select
              id="task-pri"
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value as Priority }))
              }
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-due">Due date</label>
            <input
              id="task-due"
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="task-assignee">Assignee</label>
            <select
              id="task-assignee"
              value={form.assigneeId}
              onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-tags">Tags (comma-separated)</label>
            <input
              id="task-tags"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="design, bug"
            />
          </div>

          <div className="field">
            <label htmlFor="task-images">Images</label>
            {!taskId ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Save the task first, then reopen it to attach images.
              </p>
            ) : (
              <>
                <div className="attachment-grid">
                  {attachments.map((a) => (
                    <div key={a.id} className="attachment-thumb">
                      <button
                        type="button"
                        className="attachment-thumb-btn"
                        onClick={() => setPreviewUrl(a.url)}
                        aria-label={`View ${a.filename}`}
                      >
                        <img src={a.url} alt={a.filename} loading="lazy" />
                      </button>
                      {canWrite ? (
                        <button
                          type="button"
                          className="attachment-remove"
                          aria-label={`Remove ${a.filename}`}
                          disabled={uploading}
                          onClick={() => void removeAttachment(a.id)}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {canWrite ? (
                  <div className="attachment-actions">
                    <input
                      ref={fileRef}
                      id="task-images"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      disabled={uploading || attachments.length >= 8}
                      onChange={(e) => void onFileChange(e.target.files)}
                    />
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>
                      JPEG/PNG/GIF/WebP · max 1.5&nbsp;MB each · up to 8 per task
                      {uploading ? ' · Uploading…' : ''}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {showMoveSheet && onMoveToColumn ? (
            <div>
              <p className="muted" style={{ marginBottom: 8 }}>
                Move to column (mobile-friendly)
              </p>
              <div className="move-sheet">
                {columns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn"
                    disabled={busy || c.id === form.columnId}
                    onClick={() => void onMoveToColumn(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          <div className="modal-actions">
            <div>
              {onDelete ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => void onDelete()}
                >
                  Delete
                </button>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {previewUrl ? (
        <div
          className="image-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setPreviewUrl(null)}
        >
          <img src={previewUrl} alt="Attachment preview" className="image-preview" />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Map a task into form state.
 */
export function taskToForm(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    columnId: task.columnId,
    dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '',
    assigneeId: task.assigneeId || '',
    tags: task.tags.join(', '),
  }
}

/**
 * Empty form for create.
 */
export function emptyTaskForm(columnId: string): TaskFormState {
  return {
    title: '',
    description: '',
    priority: 'medium',
    columnId,
    dueAt: '',
    assigneeId: '',
    tags: '',
  }
}
