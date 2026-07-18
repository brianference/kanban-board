/** Project membership checks — every data access goes through these. */
import type { Env, MemberRole, SessionUser } from './types'

export interface ProjectAccess {
  projectId: string
  role: MemberRole
}

/**
 * Load membership for a project. Owners always have access.
 */
export async function getProjectAccess(
  env: Env,
  userId: string,
  projectId: string,
): Promise<ProjectAccess | null> {
  const row = await env.DB.prepare(
    `SELECT role FROM project_members
      WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first<{ role: MemberRole }>()
  if (!row) return null
  return { projectId, role: row.role }
}

/**
 * Ensure user can read project.
 */
export async function requireProjectRead(
  env: Env,
  user: SessionUser,
  projectId: string,
): Promise<ProjectAccess | null> {
  return getProjectAccess(env, user.userId, projectId)
}

/**
 * Ensure user can write (owner or member, not viewer).
 */
export async function requireProjectWrite(
  env: Env,
  user: SessionUser,
  projectId: string,
): Promise<ProjectAccess | null> {
  const access = await getProjectAccess(env, user.userId, projectId)
  if (!access) return null
  if (access.role === 'viewer') return null
  return access
}

/**
 * Resolve board → project and check membership.
 */
export async function getBoardAccess(
  env: Env,
  userId: string,
  boardId: string,
): Promise<(ProjectAccess & { boardId: string; projectId: string }) | null> {
  const row = await env.DB.prepare(
    `SELECT b.id AS boardId, b.project_id AS projectId, m.role AS role
       FROM boards b
       JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
      WHERE b.id = ?`,
  )
    .bind(userId, boardId)
    .first<{ boardId: string; projectId: string; role: MemberRole }>()
  if (!row) return null
  return { boardId: row.boardId, projectId: row.projectId, role: row.role }
}

/**
 * Resolve task → board → project membership.
 */
export async function getTaskAccess(
  env: Env,
  userId: string,
  taskId: string,
): Promise<(ProjectAccess & { taskId: string; boardId: string; projectId: string }) | null> {
  const row = await env.DB.prepare(
    `SELECT t.id AS taskId, t.board_id AS boardId, b.project_id AS projectId, m.role AS role
       FROM tasks t
       JOIN boards b ON b.id = t.board_id
       JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
      WHERE t.id = ? AND t.deleted_at IS NULL`,
  )
    .bind(userId, taskId)
    .first<{ taskId: string; boardId: string; projectId: string; role: MemberRole }>()
  if (!row) return null
  return {
    taskId: row.taskId,
    boardId: row.boardId,
    projectId: row.projectId,
    role: row.role,
  }
}
