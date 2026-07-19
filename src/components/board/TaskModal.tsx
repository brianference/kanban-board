import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type {
  ActivityItem,
  ChecklistItem,
  Column,
  CommentItem,
  Priority,
  ProjectMember,
  RecurringRule,
  Task,
  TaskAttachment,
} from '../../types/models'
import { api } from '../../lib/api'

export interface TaskFormState {
  title: string
  description: string
  priority: Priority
  columnId: string
  dueAt: string
  assigneeId: string
  tags: string
  recurringRule: RecurringRule
}

type TabId = 'details' | 'checklist' | 'comments' | 'activity'

/**
 * Task modal: details, images, checklist, comments (@mentions), activity, recurring.
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
  const [tab, setTab] = useState<TabId>('details')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [checkTitle, setCheckTitle] = useState('')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const titleId = useId()
  const firstRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setForm(initial)
    setAttachments(initialAttachments)
    setError(null)
    setPreviewUrl(null)
    setTab('details')
    setCheckTitle('')
    setCommentBody('')
    window.setTimeout(() => firstRef.current?.focus(), 0)
  }, [open, initial, initialAttachments])

  useEffect(() => {
    if (!open || !taskId) return
    void (async () => {
      try {
        const [c, cl, a] = await Promise.all([
          api.listComments(taskId),
          api.listChecklist(taskId),
          api.listActivity(taskId),
        ])
        setComments(c.comments)
        setChecklist(cl.items)
        setActivity(a.activity)
      } catch {
        /* tables may not exist yet */
      }
    })()
  }, [open, taskId])

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

  async function addCheck() {
    if (!taskId || !checkTitle.trim()) return
    const res = await api.addChecklistItem(taskId, checkTitle.trim())
    setChecklist((list) => [...list, res.item])
    setCheckTitle('')
    onAttachmentsChange?.()
  }

  async function toggleCheck(item: ChecklistItem) {
    await api.patchChecklistItem(item.id, { done: !item.done })
    setChecklist((list) =>
      list.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)),
    )
    onAttachmentsChange?.()
  }

  async function removeCheck(id: string) {
    await api.deleteChecklistItem(id)
    setChecklist((list) => list.filter((x) => x.id !== id))
    onAttachmentsChange?.()
  }

  async function postComment() {
    if (!taskId || !commentBody.trim()) return
    const res = await api.addComment(taskId, commentBody.trim())
    setComments((list) => [...list, res.comment])
    setCommentBody('')
    onAttachmentsChange?.()
  }

  const mentionHelp = members
    .slice(0, 5)
    .map((m) => `@${m.email}`)
    .join(' ')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>

        {taskId ? (
          <div className="modal-tabs" role="tablist">
            {(
              [
                ['details', 'Details'],
                ['checklist', `Checklist (${checklist.filter((c) => c.done).length}/${checklist.length})`],
                ['comments', `Comments (${comments.length})`],
                ['activity', 'Activity'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`modal-tab ${tab === id ? 'active' : ''}`}
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {tab === 'details' || !taskId ? (
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
            <div className="field-grid">
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
              <label htmlFor="task-recur">Recurring template</label>
              <select
                id="task-recur"
                value={form.recurringRule}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    recurringRule: e.target.value as RecurringRule,
                  }))
                }
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily (new copy after Done)</option>
                <option value="weekly">Weekly (new copy after Done)</option>
                <option value="monthly">Monthly (new copy after Done)</option>
              </select>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>
                When a recurring card sits in Done long enough, a fresh copy appears in Backlog.
              </p>
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
                        JPEG/PNG/GIF/WebP · max 1.5&nbsp;MB · up to 8
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
                  Move to column
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
        ) : null}

        {tab === 'checklist' && taskId ? (
          <div className="stack">
            <ul className="checklist">
              {checklist.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!canWrite}
                      onChange={() => void toggleCheck(item)}
                    />
                    <span className={item.done ? 'checklist-done' : ''}>{item.title}</span>
                  </label>
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => void removeCheck(item.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <div className="inline-add">
                <input
                  value={checkTitle}
                  onChange={(e) => setCheckTitle(e.target.value)}
                  placeholder="New subtask"
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void addCheck()
                    }
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={() => void addCheck()}>
                  Add
                </button>
              </div>
            ) : null}
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : null}

        {tab === 'comments' && taskId ? (
          <div className="stack">
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <strong>{c.userName || c.userEmail}</strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </li>
              ))}
            </ul>
            {canWrite ? (
              <>
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder={`Write a comment… Mentions: ${mentionHelp || '@email'}`}
                  maxLength={4000}
                  rows={3}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void postComment()}
                  disabled={!commentBody.trim()}
                >
                  Post comment
                </button>
              </>
            ) : null}
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : null}

        {tab === 'activity' && taskId ? (
          <div className="stack">
            <ul className="activity-list">
              {activity.length === 0 ? (
                <li className="muted">No activity yet</li>
              ) : (
                activity.map((a) => (
                  <li key={a.id}>
                    <span className="chip">{a.kind}</span> {a.message}
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {a.userName || a.userEmail || 'System'} ·{' '}
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))
              )}
            </ul>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : null}
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

export function taskToForm(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    columnId: task.columnId,
    dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '',
    assigneeId: task.assigneeId || '',
    tags: task.tags.join(', '),
    recurringRule: (task.recurringRule as RecurringRule) || 'none',
  }
}

export function emptyTaskForm(columnId: string): TaskFormState {
  return {
    title: '',
    description: '',
    priority: 'medium',
    columnId,
    dueAt: '',
    assigneeId: '',
    tags: '',
    recurringRule: 'none',
  }
}
