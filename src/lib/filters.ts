import type { BoardFilters, Task } from '../types/models'

/**
 * Start of local calendar day (ms).
 */
function startOfDay(d = new Date()): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/**
 * End of local calendar day (ms).
 */
function endOfDay(d = new Date()): number {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.getTime()
}

/**
 * Apply board filters to a task list.
 */
export function filterTasks(tasks: Task[], filters: BoardFilters, userId?: string): Task[] {
  const q = filters.search.trim().toLowerCase()
  const weekEnd = startOfDay() + 7 * 864e5
  const todayStart = startOfDay()
  const todayEnd = endOfDay()
  const now = Date.now()

  return tasks.filter((t) => {
    if (q) {
      const hay = `${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.assigneeId && t.assigneeId !== filters.assigneeId) return false
    if (filters.unassignedOnly && t.assigneeId) return false
    if (filters.priority && t.priority !== filters.priority) return false
    if (filters.tag && !t.tags.map((x) => x.toLowerCase()).includes(filters.tag.toLowerCase())) {
      return false
    }
    if (filters.hasAttachments && !(t.attachments && t.attachments.length > 0)) return false
    if (filters.hasOpenChecklist) {
      const total = t.checklistTotal ?? 0
      const done = t.checklistDone ?? 0
      if (total === 0 || done >= total) return false
    }
    if (filters.mentionedOnly && userId) {
      // Card-level: assignee is self or description mentions @email — lightweight
      const me = userId
      if (t.assigneeId !== me && !(t.description || '').includes('@')) {
        /* keep loose: only assignee-self when no @ in desc */
        if (t.assigneeId !== me) return false
      }
    }

    switch (filters.due) {
      case 'overdue':
        if (!t.dueAt || t.dueAt >= now) return false
        break
      case 'today':
        if (!t.dueAt || t.dueAt < todayStart || t.dueAt > todayEnd) return false
        break
      case 'week':
        if (!t.dueAt || t.dueAt < todayStart || t.dueAt > weekEnd) return false
        break
      case 'none':
        if (t.dueAt) return false
        break
      case 'has-due':
        if (!t.dueAt) return false
        break
      default:
        break
    }
    return true
  })
}

/**
 * Unique tags across tasks for filter dropdown.
 */
export function collectTags(tasks: Task[]): string[] {
  const set = new Set<string>()
  for (const t of tasks) for (const tag of t.tags) set.add(tag)
  return [...set].sort((a, b) => a.localeCompare(b))
}
