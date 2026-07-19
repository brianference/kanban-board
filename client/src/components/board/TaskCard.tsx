import { useRef, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { Task } from '../../lib/api'
import { AuthImage } from './AuthImage'

function formatDue(dueAt: number | null | undefined): string | null {
  if (!dueAt) return null
  try {
    return new Date(dueAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

function isOverdue(dueAt: number | null | undefined): boolean {
  if (!dueAt) return false
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return dueAt < end.getTime()
}

/** Short display id like legacy US-### badges (last 6 hex of task id). */
function shortId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '')
  return clean.slice(-6).toUpperCase() || id.slice(0, 6).toUpperCase()
}

function daysInStage(updatedAt: number | undefined): number | null {
  if (!updatedAt) return null
  const days = Math.floor((Date.now() - updatedAt) / (24 * 60 * 60 * 1000))
  return days >= 3 ? days : null
}

/**
 * Task card — legacy Task Board look/fonts + current product features
 * (drag, checklist, comments, images, tags, due, assignee, recurring).
 */
export function TaskCard({
  task,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
  isDragging,
  columnKey,
}: {
  task: Task
  onOpen: (task: Task) => void
  draggable?: boolean
  onDragStart?: (task: Task, e: DragEvent) => void
  onDragEnd?: () => void
  isDragging?: boolean
  /** Column key for accent (e.g. blocked) */
  columnKey?: string
}) {
  const due = formatDue(task.dueAt)
  const overdue = isOverdue(task.dueAt)
  const didDrag = useRef(false)
  const stuckDays = daysInStage(task.updatedAt)
  const blocked = (columnKey || '').toLowerCase().includes('block')
  const critical = task.priority === 'critical'
  const accent = blocked || critical

  function handleClick(e: MouseEvent) {
    if (didDrag.current || isDragging) {
      e.preventDefault()
      return
    }
    onOpen(task)
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(task)
    }
  }

  const classes = [
    'task-card',
    'task-card--legacy',
    isDragging ? 'task-card--dragging' : '',
    draggable ? 'task-card--draggable' : '',
    accent ? 'task-card--accent' : '',
    blocked ? 'task-card--blocked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const priorityLabel = (task.priority || 'medium').toUpperCase()

  return (
    <div
      role="button"
      tabIndex={0}
      className={classes}
      draggable={Boolean(draggable)}
      onDragStart={(e) => {
        didDrag.current = true
        onDragStart?.(task, e)
      }}
      onDragEnd={() => {
        onDragEnd?.()
        window.setTimeout(() => {
          didDrag.current = false
        }, 80)
      }}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-grabbed={isDragging || undefined}
      data-task-id={task.id}
    >
      <span className="task-card-id" title={task.id}>
        {shortId(task.id)}
      </span>

      <div className="task-card-main">
        {draggable ? (
          <span className="task-card-grip" aria-hidden title="Drag">
            ⋮⋮
          </span>
        ) : null}
        <div className="task-card-body">
          <h4 className="task-card-title">{task.title}</h4>
          {task.description ? (
            <p className="task-card-desc">
              {task.description.slice(0, 110)}
              {task.description.length > 110 ? '…' : ''}
            </p>
          ) : null}

          <div className="task-meta">
            {stuckDays != null ? (
              <span className="task-age" title="Days since last update">
                ⚠ {stuckDays}d in stage
              </span>
            ) : null}

            <span
              className={`pill pill-${task.priority || 'medium'}`}
              title="Priority"
            >
              {priorityLabel}
            </span>

            {due ? (
              <span className={`chip-soft ${overdue ? 'chip-soft--overdue' : ''}`}>
                📅 {due}
              </span>
            ) : null}

            {task.assigneeName || task.assigneeEmail ? (
              <span className="chip-soft" title="Assignee">
                👤 {(task.assigneeName || task.assigneeEmail || '').split('@')[0]}
              </span>
            ) : null}

            {(task.checklistTotal ?? 0) > 0 ? (
              <span className="chip-soft" title="Checklist">
                ☑ {task.checklistDone}/{task.checklistTotal}
              </span>
            ) : null}

            {(task.commentCount ?? 0) > 0 ? (
              <span className="chip-soft" title="Comments">
                💬 {task.commentCount}
              </span>
            ) : null}

            {(task.attachments?.length ?? 0) > 0 ? (
              <span className="chip-soft" title="Images">
                📎 {task.attachments!.length}
              </span>
            ) : null}

            {task.recurringRule && task.recurringRule !== 'none' ? (
              <span className="chip-soft" title="Recurring">
                🔁 {task.recurringRule}
              </span>
            ) : null}

            {task.tags?.map((tag) => (
              <span key={tag} className="chip-tag">
                {tag}
              </span>
            ))}
          </div>

          {(task.attachments?.length ?? 0) > 0 ? (
            <div className="card-thumbs" aria-hidden>
              {task.attachments!.slice(0, 3).map((a) => (
                <AuthImage
                  key={a.id}
                  src={a.url}
                  alt=""
                  className="card-thumb"
                  width={40}
                  height={40}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
