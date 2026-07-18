/**
 * Test type 4: Integration — multi-step flows on in-memory store.
 */
import { createStore, runSuite, assert } from './lib/test-harness.mjs'

const r1 = runSuite('Integration: register → project → task → move', (t) => {
  const store = createStore()
  const reg = store.register('int@ex.com', 'password1', 'Int')
  t.test('session works', () => {
    const s = store.session(reg.sessionId)
    assert(s && s.email === 'int@ex.com')
  })
  t.test('first project exists with template tasks', () => {
    const projects = store.listProjects(reg.user.id)
    assert(projects.length >= 1)
    const boardData = (() => {
      const task = [...store._tasks.values()].find((x) => x.createdBy === reg.user.id)
      return store.getBoard(reg.user.id, task.boardId)
    })()
    assert(boardData.columns.length === 5)
    assert(boardData.tasks.length >= 1)
  })
  t.test('create and move task', () => {
    const task = [...store._tasks.values()].find((x) => x.createdBy === reg.user.id)
    const board = store.getBoard(reg.user.id, task.boardId)
    const done = board.columns.find((c) => c.key === 'done')
    const newId = store.createTask(reg.user.id, {
      boardId: board.board.id,
      columnId: board.columns[0].id,
      title: 'Integration task',
      priority: 'high',
    })
    store.moveTask(reg.user.id, newId, done.id, 1)
    const after = store.getBoard(reg.user.id, board.board.id)
    const moved = after.tasks.find((x) => x.id === newId)
    assert(moved.columnId === done.id)
  })
  t.test('logout clears session', () => {
    store.logout(reg.sessionId)
    assert(store.session(reg.sessionId) === null)
  })
})

const r2 = runSuite('Integration: multi-project switcher data', (t) => {
  const store = createStore()
  const u = store.register('multi@ex.com', 'password1', 'Multi')
  store.createProject(u.user.id, 'Website', 'blank')
  store.createProject(u.user.id, 'Mobile app', 'side-project')
  t.test('lists all owned projects', () => {
    const list = store.listProjects(u.user.id)
    assert(list.length >= 3)
    assert(list.some((p) => p.name === 'Website'))
  })
})

const r3 = runSuite('Integration: soft delete', (t) => {
  const store = createStore()
  const u = store.register('del@ex.com', 'password1', 'Del')
  const sample = [...store._tasks.values()].find((x) => x.createdBy === u.user.id)
  store.deleteTask(u.user.id, sample.id)
  t.test('deleted task hidden from board', () => {
    const board = store.getBoard(u.user.id, sample.boardId)
    assert(!board.tasks.some((x) => x.id === sample.id))
  })
})

const results = [r1, r2, r3]
const failed = results.reduce((n, r) => n + r.failed, 0)
const passed = results.reduce((n, r) => n + r.passed, 0)
console.log(`\nIntegration total: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
