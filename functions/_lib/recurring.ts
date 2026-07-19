/** Spawn next instance of recurring tasks that are Done and due for a new cycle. */
import type { Env } from './types'
import { randomToken } from './crypto'
import { logActivity } from './activity'

const MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
} as const

/**
 * For each Done recurring task past its interval, clone into backlog.
 */
export async function processRecurringForBoard(env: Env, boardId: string): Promise<number> {
  const doneCol = await env.DB.prepare(
    `SELECT id FROM columns WHERE board_id = ? AND key_name = 'done' LIMIT 1`,
  )
    .bind(boardId)
    .first<{ id: string }>()
  const backlogCol = await env.DB.prepare(
    `SELECT id FROM columns WHERE board_id = ? AND key_name = 'backlog' LIMIT 1`,
  )
    .bind(boardId)
    .first<{ id: string }>()
  if (!doneCol || !backlogCol) return 0

  const { results } = await env.DB.prepare(
    `SELECT id, title, description, priority, due_at AS dueAt, assignee_id AS assigneeId,
            created_by AS createdBy, recurring_rule AS recurringRule,
            last_recurred_at AS lastRecurredAt, updated_at AS updatedAt
       FROM tasks
      WHERE board_id = ? AND deleted_at IS NULL AND column_id = ?
        AND recurring_rule IS NOT NULL AND recurring_rule != 'none'`,
  )
    .bind(boardId, doneCol.id)
    .all<{
      id: string
      title: string
      description: string
      priority: string
      dueAt: number | null
      assigneeId: string | null
      createdBy: string | null
      recurringRule: string
      lastRecurredAt: number | null
      updatedAt: number
    }>()

  const now = Date.now()
  let created = 0

  for (const task of results ?? []) {
    const rule = task.recurringRule as keyof typeof MS
    const interval = MS[rule]
    if (!interval) continue
    const anchor = task.lastRecurredAt || task.updatedAt
    if (now - anchor < interval) continue

    const newId = randomToken(16)
    let nextDue: number | null = null
    if (task.dueAt) nextDue = task.dueAt + interval

    await env.DB.prepare(
      `INSERT INTO tasks (
        id, board_id, column_id, title, description, priority, position,
        due_at, assignee_id, created_by, created_at, updated_at, deleted_at,
        recurring_rule, last_recurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
    )
      .bind(
        newId,
        boardId,
        backlogCol.id,
        task.title,
        task.description,
        task.priority,
        nextDue,
        task.assigneeId,
        task.createdBy,
        now,
        now,
        task.recurringRule,
      )
      .run()

    // copy tags
    const { results: tags } = await env.DB.prepare(
      `SELECT tag FROM task_tags WHERE task_id = ?`,
    )
      .bind(task.id)
      .all<{ tag: string }>()
    for (const t of tags ?? []) {
      await env.DB.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).bind(
        newId,
        t.tag,
      ).run()
    }

    await env.DB.prepare(`UPDATE tasks SET last_recurred_at = ? WHERE id = ?`)
      .bind(now, task.id)
      .run()

    await logActivity(env, newId, task.createdBy, 'recur', `Recurring instance of ${task.title}`)
    created += 1
  }

  return created
}
