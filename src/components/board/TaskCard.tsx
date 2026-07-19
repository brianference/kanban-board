import { useRef, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { Task } from '../../types/models'
import { formatDue, isOverdue } from '../../lib/format'

/**
 * Task card — div-based so HTML5 drag works reliably (buttons break DnD in several browsers).
 */
export function TaskCard({
  task,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
  isDragging,
  isSettling,
}: {
  task: Task
  onOpen: (task: Task) => void
  draggable?: boolean
  onDragStart?: (task: Task, e: DragEvent) => void
  onDragEnd?: () => void
  isDragging?: boolean
  isSettling?: boolean
}) {
  const due = formatDue(task.dueAt)
  const overdue = isOverdue(task.dueAt)
  const didDrag = useRef(false)

  const classes = [
    'task-card',
    isDragging ? 'task-card--dragging' : '',
    isSettling ? 'task-card--settle' : '',
    draggable ? 'task-card--draggable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleClick(e: MouseEvent) {
    // Ignore click that follows a drag
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
      <span className="task-card-grip" aria-hidden title="Drag">
        ⋮⋮
      </span>
      <div className="task-card-body">
        <h4>{task.title}</h4>
        {task.description ? (
          <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.88rem' }}>
            {task.description.slice(0, 100)}
            {task.description.length > 100 ? '…' : ''}
          </p>
        ) : null}
        <div className="task-meta">
          <span className={`chip chip-${task.priority}`}>{task.priority}</span>
          {due ? <span className={`chip ${overdue ? 'chip-overdue' : ''}`}>📅 {due}</span> : null}
          {task.assigneeName || task.assigneeEmail ? (
            <span className="chip">👤 {task.assigneeName || task.assigneeEmail}</span>
          ) : null}
          {(task.attachments?.length ?? 0) > 0 ? (
            <span className="chip" title="Has images">
              📎 {task.attachments!.length}
            </span>
          ) : null}
          {(task.checklistTotal ?? 0) > 0 ? (
            <span className="chip" title="Checklist">
              ☑ {task.checklistDone}/{task.checklistTotal}
            </span>
          ) : null}
          {(task.commentCount ?? 0) > 0 ? (
            <span className="chip" title="Comments">
              💬 {task.commentCount}
            </span>
          ) : null}
          {task.recurringRule && task.recurringRule !== 'none' ? (
            <span className="chip" title="Recurring">
              🔁 {task.recurringRule}
            </span>
          ) : null}
          {task.tags.map((tag) => (
            <span key={tag} className="chip">
              #{tag}
            </span>
          ))}
        </div>
        {(task.attachments?.length ?? 0) > 0 ? (
          <div className="card-thumbs" aria-hidden>
            {task.attachments!.slice(0, 3).map((a) => (
              <img key={a.id} src={a.url} alt="" className="card-thumb" loading="lazy" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
