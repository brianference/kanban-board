/**
 * In-memory multi-tenant store mirroring D1 schema + security rules.
 * Used for unit/integration/security/simulations without Workers runtime.
 */

import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto'

const ITERATIONS = 60_000

export function id(bytes = 16) {
  return randomBytes(bytes).toString('hex')
}

export function hashPassword(password, saltHex) {
  return pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), ITERATIONS, 32, 'sha256').toString('hex')
}

export function createPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: hashPassword(password, salt) }
}

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex')
}

export function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const TEMPLATES = {
  blank: {
    columns: [
      ['backlog', 'Backlog', 0],
      ['next-up', 'Next Up', 1],
      ['progress', 'In Progress', 2],
      ['blocked', 'Blocked', 3],
      ['done', 'Done', 4],
    ],
    tasks: [['Create your first task', 'backlog', 'medium']],
  },
  personal: {
    columns: [
      ['backlog', 'Backlog', 0],
      ['next-up', 'Next Up', 1],
      ['progress', 'In Progress', 2],
      ['blocked', 'Blocked', 3],
      ['done', 'Done', 4],
    ],
    tasks: [
      ['Plan this week', 'next-up', 'high'],
      ['Deep work block', 'progress', 'medium'],
      ['Inbox zero', 'backlog', 'low'],
    ],
  },
}

export function createStore() {
  const users = new Map()
  const sessions = new Map()
  const projects = new Map()
  const members = new Map() // key projectId:userId
  const boards = new Map()
  const columns = new Map()
  const tasks = new Map()
  const tags = new Map() // taskId -> string[]
  const invites = new Map()

  function memberKey(projectId, userId) {
    return `${projectId}:${userId}`
  }

  function getAccess(userId, projectId) {
    return members.get(memberKey(projectId, userId)) || null
  }

  function requireWrite(userId, projectId) {
    const m = getAccess(userId, projectId)
    if (!m || m.role === 'viewer') return null
    return m
  }

  function createProject(userId, name, templateId = 'personal') {
    const now = Date.now()
    const projectId = id()
    const boardId = id()
    const tpl = TEMPLATES[templateId] || TEMPLATES.blank
    projects.set(projectId, { id: projectId, name, ownerId: userId, createdAt: now, updatedAt: now })
    members.set(memberKey(projectId, userId), { projectId, userId, role: 'owner' })
    boards.set(boardId, { id: boardId, projectId, name: 'Main board', kind: 'kanban' })
    const colByKey = new Map()
    for (const [key, label, position] of tpl.columns) {
      const colId = id()
      columns.set(colId, { id: colId, boardId, key, name: label, position })
      colByKey.set(key, colId)
    }
    tpl.tasks.forEach(([title, colKey, priority], index) => {
      const taskId = id()
      tasks.set(taskId, {
        id: taskId,
        boardId,
        columnId: colByKey.get(colKey),
        title,
        description: '',
        priority,
        position: index,
        dueAt: null,
        assigneeId: null,
        createdBy: userId,
        deletedAt: null,
      })
      tags.set(taskId, [])
    })
    return { projectId, boardId }
  }

  return {
    register(email, password, name = 'User') {
      email = email.trim().toLowerCase()
      if ([...users.values()].some((u) => u.email === email)) {
        throw Object.assign(new Error('Email already registered'), { status: 409 })
      }
      if (password.length < 8) throw Object.assign(new Error('Password too short'), { status: 400 })
      const { salt, hash } = createPassword(password)
      const userId = id()
      users.set(userId, { id: userId, email, name, passwordHash: hash, passwordSalt: salt })
      const sessionId = id(32)
      sessions.set(sessionId, { id: sessionId, userId, expiresAt: Date.now() + 30 * 864e5 })
      const { projectId } = createProject(userId, 'My first project', 'personal')
      return { sessionId, user: { id: userId, email, name }, projectId }
    },

    login(email, password) {
      email = email.trim().toLowerCase()
      const user = [...users.values()].find((u) => u.email === email)
      if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401 })
      const got = hashPassword(password, user.passwordSalt)
      if (got !== user.passwordHash) {
        throw Object.assign(new Error('Invalid email or password'), { status: 401 })
      }
      const sessionId = id(32)
      sessions.set(sessionId, { id: sessionId, userId: user.id, expiresAt: Date.now() + 30 * 864e5 })
      return { sessionId, user: { id: user.id, email: user.email, name: user.name } }
    },

    session(sessionId) {
      const s = sessions.get(sessionId)
      if (!s || s.expiresAt < Date.now()) return null
      const u = users.get(s.userId)
      return u ? { userId: u.id, email: u.email, name: u.name } : null
    },

    logout(sessionId) {
      sessions.delete(sessionId)
    },

    listProjects(userId) {
      return [...projects.values()]
        .filter((p) => getAccess(userId, p.id))
        .map((p) => ({ ...p, role: getAccess(userId, p.id).role }))
    },

    createProject(userId, name, templateId) {
      return createProject(userId, name, templateId)
    },

    getBoard(userId, boardId) {
      const board = boards.get(boardId)
      if (!board) return null
      const access = getAccess(userId, board.projectId)
      if (!access) return null
      const cols = [...columns.values()]
        .filter((c) => c.boardId === boardId)
        .sort((a, b) => a.position - b.position)
      const taskList = [...tasks.values()]
        .filter((t) => t.boardId === boardId && !t.deletedAt)
        .map((t) => ({ ...t, tags: tags.get(t.id) || [] }))
      return { board, columns: cols, tasks: taskList, role: access.role, projectId: board.projectId }
    },

    createTask(userId, { boardId, columnId, title, priority = 'medium' }) {
      const board = boards.get(boardId)
      if (!board) throw Object.assign(new Error('Not found'), { status: 404 })
      if (!requireWrite(userId, board.projectId)) throw Object.assign(new Error('Not found'), { status: 404 })
      const col = columns.get(columnId)
      if (!col || col.boardId !== boardId) throw Object.assign(new Error('Invalid column'), { status: 400 })
      const taskId = id()
      tasks.set(taskId, {
        id: taskId,
        boardId,
        columnId,
        title: title.slice(0, 200),
        description: '',
        priority,
        position: 0,
        dueAt: null,
        assigneeId: null,
        createdBy: userId,
        deletedAt: null,
      })
      tags.set(taskId, [])
      return taskId
    },

    moveTask(userId, taskId, columnId, position) {
      const task = tasks.get(taskId)
      if (!task || task.deletedAt) throw Object.assign(new Error('Not found'), { status: 404 })
      const board = boards.get(task.boardId)
      if (!requireWrite(userId, board.projectId)) throw Object.assign(new Error('Not found'), { status: 404 })
      const col = columns.get(columnId)
      if (!col || col.boardId !== task.boardId) throw Object.assign(new Error('Invalid column'), { status: 400 })
      task.columnId = columnId
      task.position = position
      return true
    },

    deleteTask(userId, taskId) {
      const task = tasks.get(taskId)
      if (!task || task.deletedAt) throw Object.assign(new Error('Not found'), { status: 404 })
      const board = boards.get(task.boardId)
      if (!requireWrite(userId, board.projectId)) throw Object.assign(new Error('Not found'), { status: 404 })
      task.deletedAt = Date.now()
      return true
    },

    /** Intentionally insecure for negative tests — real API never uses this. */
    getTaskByIdOnly(taskId) {
      return tasks.get(taskId) || null
    },

    getTaskSecure(userId, taskId) {
      const task = tasks.get(taskId)
      if (!task || task.deletedAt) return null
      const board = boards.get(task.boardId)
      if (!getAccess(userId, board.projectId)) return null
      return task
    },

    invite(userId, projectId, email, role = 'member') {
      if (!requireWrite(userId, projectId)) throw Object.assign(new Error('Not found'), { status: 404 })
      const token = id(24)
      invites.set(sha256(token), {
        projectId,
        email: email.toLowerCase(),
        role,
        acceptedAt: null,
        expiresAt: Date.now() + 7 * 864e5,
      })
      return token
    },

    acceptInvite(userId, email, token) {
      const inv = invites.get(sha256(token))
      if (!inv || inv.acceptedAt || inv.expiresAt < Date.now()) {
        throw Object.assign(new Error('Invalid invite'), { status: 410 })
      }
      if (inv.email !== email.toLowerCase()) {
        throw Object.assign(new Error('Email mismatch'), { status: 403 })
      }
      members.set(memberKey(inv.projectId, userId), {
        projectId: inv.projectId,
        userId,
        role: inv.role,
      })
      inv.acceptedAt = Date.now()
      return inv.projectId
    },

    // helpers for tests
    _users: users,
    _tasks: tasks,
    _projects: projects,
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export function runSuite(name, fn) {
  const failures = []
  let passed = 0
  const t = {
    test(label, body) {
      try {
        body()
        passed += 1
        console.log(`  ✓ ${label}`)
      } catch (err) {
        failures.push({ label, err })
        console.log(`  ✗ ${label}: ${err.message}`)
      }
    },
  }
  console.log(`\n== ${name} ==`)
  fn(t)
  return { name, passed, failed: failures.length, failures }
}

