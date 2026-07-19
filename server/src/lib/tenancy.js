import { db } from '../db/index.js'

/**
 * @param {string} userId
 * @param {string} projectId
 */
export function getProjectAccess(userId, projectId) {
  return db
    .prepare(
      `SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`,
    )
    .get(projectId, userId)
}

/**
 * @param {string} userId
 * @param {string} boardId
 */
export function getBoardAccess(userId, boardId) {
  return db
    .prepare(
      `SELECT b.id AS boardId, b.project_id AS projectId, m.role AS role
         FROM boards b
         JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
        WHERE b.id = ?`,
    )
    .get(userId, boardId)
}

/**
 * @param {string} userId
 * @param {string} taskId
 */
export function getTaskAccess(userId, taskId) {
  return db
    .prepare(
      `SELECT t.id AS taskId, t.board_id AS boardId, b.project_id AS projectId, m.role AS role
         FROM tasks t
         JOIN boards b ON b.id = t.board_id
         JOIN project_members m ON m.project_id = b.project_id AND m.user_id = ?
        WHERE t.id = ? AND t.deleted_at IS NULL`,
    )
    .get(userId, taskId)
}

export function canWrite(role) {
  return role === 'owner' || role === 'member'
}
