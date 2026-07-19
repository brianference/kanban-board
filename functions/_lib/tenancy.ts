import type { Env, MemberRole, SessionUser } from './types'

export async function getProjectAccess(
  env: Env,
  userId: string,
  projectId: string,
): Promise<{ projectId: string; role: MemberRole } | null> {
  const row = await env.DB.prepare(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first<{ role: MemberRole }>()
  return row ? { projectId, role: row.role } : null
}

export async function getBoardAccess(env: Env, userId: string, boardId: string) {
  return env.DB.prepare(
    `SELECT b.id AS boardId, b.project_id AS projectId, m.role AS role
       FROM boards b
       JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
      WHERE b.id = ?`,
  )
    .bind(userId, boardId)
    .first<{ boardId: string; projectId: string; role: MemberRole }>()
}

export async function getTaskAccess(env: Env, userId: string, taskId: string) {
  return env.DB.prepare(
    `SELECT t.id AS taskId, t.board_id AS boardId, b.project_id AS projectId, m.role AS role
       FROM tasks t
       JOIN boards b ON b.id = t.board_id
       JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
      WHERE t.id = ? AND t.deleted_at IS NULL`,
  )
    .bind(userId, taskId)
    .first<{ taskId: string; boardId: string; projectId: string; role: MemberRole }>()
}

export function canWrite(role: MemberRole): boolean {
  return role === 'owner' || role === 'member'
}

export async function requireProjectRead(
  env: Env,
  user: SessionUser,
  projectId: string,
) {
  return getProjectAccess(env, user.userId, projectId)
}

/**
 * Project membership with write role (owner or member). Returns null if missing or viewer.
 */
export async function requireProjectWrite(
  env: Env,
  user: SessionUser,
  projectId: string,
): Promise<{ projectId: string; role: MemberRole } | null> {
  const access = await getProjectAccess(env, user.userId, projectId)
  if (!access || !canWrite(access.role)) return null
  return access
}
