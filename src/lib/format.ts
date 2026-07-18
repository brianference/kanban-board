/**
 * Format due date for chips.
 */
export function formatDue(ms: number | null | undefined): string | null {
  if (!ms) return null
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * True if due date is before end of today.
 */
export function isOverdue(ms: number | null | undefined): boolean {
  if (!ms) return false
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return ms < Date.now() && ms < end.getTime()
}
