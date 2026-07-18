import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Column, Priority, ProjectMember, Task } from '../../types/models'

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
 * Accessible task create/edit modal with focus trap basics.
 */
export function TaskModal({
  open,
  title,
  columns,
  members,
  initial,
  onClose,
  onSave,
  onDelete,
  showMoveSheet,
  onMoveToColumn,
}: {
  open: boolean
  title: string
  columns: Column[]
  members: ProjectMember[]
  initial: TaskFormState
  onClose: () => void
  onSave: (form: TaskFormState) => Promise<void>
  onDelete?: () => Promise<void>
  showMoveSheet?: boolean
  onMoveToColumn?: (columnId: string) => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(initial)
      setError(null)
      window.setTimeout(() => firstRef.current?.focus(), 0)
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
