import type { ReactNode } from 'react'

/**
 * Guided empty state with primary action slot.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="muted">{body}</p>
      {action}
    </div>
  )
}
