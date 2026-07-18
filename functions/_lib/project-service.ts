/** Create project + default board/columns/tasks from a template. */
import type { Env } from './types'
import { randomToken } from './crypto'
import { resolveTemplate, type TemplateId } from './templates'

/**
 * Create a project owned by userId with a templated board.
 */
export async function createProjectWithTemplate(
  env: Env,
  userId: string,
  name: string,
  templateId?: string,
): Promise<{ projectId: string; boardId: string }> {
  const now = Date.now()
  const projectId = randomToken(16)
  const boardId = randomToken(16)
  const template = resolveTemplate(templateId)

  // Sequential inserts are more reliable than large batches under D1 limits.
  await env.DB.prepare(
    `INSERT INTO projects (id, name, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(projectId, name.trim(), userId, now, now)
    .run()
  await env.DB.prepare(
    `INSERT INTO project_members (project_id, user_id, role, created_at)
     VALUES (?, ?, 'owner', ?)`,
  )
    .bind(projectId, userId, now)
    .run()
  await env.DB.prepare(
    `INSERT INTO boards (id, project_id, name, kind, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(boardId, projectId, template.boardName, template.kind, now)
    .run()

  const columnIds = new Map<string, string>()
  for (const col of template.columns) {
    const colId = randomToken(16)
    columnIds.set(col.key, colId)
    await env.DB.prepare(
      `INSERT INTO columns (id, board_id, key_name, name, position)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(colId, boardId, col.key, col.name, col.position)
      .run()
  }

  for (let index = 0; index < template.tasks.length; index++) {
    const task = template.tasks[index]!
    const columnId = columnIds.get(task.columnKey)
    if (!columnId) continue
    const taskId = randomToken(16)
    await env.DB.prepare(
      `INSERT INTO tasks (
        id, board_id, column_id, title, description, priority,
        position, due_at, assignee_id, created_by, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)`,
    )
      .bind(
        taskId,
        boardId,
        columnId,
        task.title,
        task.description,
        task.priority,
        index,
        userId,
        now,
        now,
      )
      .run()
    for (const tag of task.tags) {
      await env.DB.prepare(`INSERT INTO task_tags (task_id, tag) VALUES (?, ?)`).bind(
        taskId,
        tag.slice(0, 40),
      ).run()
    }
  }

  return { projectId, boardId }
}

export type { TemplateId }
