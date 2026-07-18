import type { DragEvent } from 'react'
import type { Task } from '../../types/models'
import { formatDue, isOverdue } from '../../lib/format'

/**
 * Single task card with drag visual states.
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

  const classes = [
    'task-card',
    isDragging ? 'task-card--dragging' : '',
    isSettling ? 'task-card--settle' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(task, e)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => {
        if (!isDragging) onOpen(task)
      }}
      aria-grabbed={isDragging || undefined}
    >
      <span className="task-card-grip" aria-hidden>
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
          {task.tags.map((tag) => (
            <span key={tag} className="chip">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

/**
 * Drop placeholder shown while dragging over a column slot.
 */
export function DropPlaceholder({ active }: { active?: boolean }) {
  return (
    <div
      className={`drop-placeholder ${active ? 'drop-placeholder--active' : ''}`}
      aria-hidden
    />
  )
}
