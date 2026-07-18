import type { DragEvent } from 'react'
import type { Task } from '../../types/models'
import { formatDue, isOverdue } from '../../lib/format'

/**
 * Single task card in a column.
 */
export function TaskCard({
  task,
  onOpen,
  draggable,
  onDragStart,
}: {
  task: Task
  onOpen: (task: Task) => void
  draggable?: boolean
  onDragStart?: (task: Task, e: DragEvent) => void
}) {
  const due = formatDue(task.dueAt)
  const overdue = isOverdue(task.dueAt)

  return (
    <button
      type="button"
      className="task-card"
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(task, e)}
      onClick={() => onOpen(task)}
    >
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
    </button>
  )
}
