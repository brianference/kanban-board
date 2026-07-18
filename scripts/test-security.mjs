/**
 * Test type 2: Security — tenancy isolation, password storage, invite checks.
 */
import { createStore, runSuite, assert, hashPassword } from './lib/test-harness.mjs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const r1 = runSuite('Security: password never plaintext', (t) => {
  t.test('store keeps hash not password', () => {
    const store = createStore()
    store.register('a@ex.com', 'password1', 'A')
    const user = [...store._users.values()][0]
    assert(user.passwordHash !== 'password1')
    assert(user.passwordSalt.length >= 16)
  })
  t.test('register source uses PBKDF2 helper', () => {
    const crypto = readFileSync(join(root, 'functions/_lib/crypto.ts'), 'utf8')
    assert(crypto.includes('PBKDF2'))
    assert(crypto.includes('PBKDF2_ITERATIONS') || crypto.includes('100_000') || crypto.includes('100000'))
  })
})

const r2 = runSuite('Security: session cookie flags in code', (t) => {
  t.test('HttpOnly Secure SameSite', () => {
    const http = readFileSync(join(root, 'functions/_lib/http.ts'), 'utf8')
    assert(http.includes('HttpOnly'))
    assert(http.includes('Secure'))
    assert(http.includes('SameSite=Lax'))
  })
  t.test('CSRF origin check present', () => {
    const http = readFileSync(join(root, 'functions/_lib/http.ts'), 'utf8')
    assert(http.includes('assertSameOrigin'))
  })
})

const r3 = runSuite('Security: IDOR / tenancy', (t) => {
  const store = createStore()
  const alice = store.register('alice@ex.com', 'password1', 'Alice')
  const bob = store.register('bob@ex.com', 'password1', 'Bob')
  const aliceProjects = store.listProjects(alice.user.id)
  const bobProjects = store.listProjects(bob.user.id)
  const aliceBoardId = store.getBoard(
    alice.user.id,
    [...store._tasks.values()].find((t) => {
      // find board via first project of alice
      return true
    })?.boardId || '',
  )

  t.test('users only list own projects', () => {
    assert(aliceProjects.every((p) => p.ownerId === alice.user.id || p.role))
    assert(!aliceProjects.some((p) => p.ownerId === bob.user.id && p.role === 'owner' && p.id === bobProjects[0]?.id) || aliceProjects[0].id !== bobProjects[0].id)
    assert(aliceProjects[0].id !== bobProjects[0].id)
  })

  t.test('bob cannot read alice board', () => {
    // locate alice board
    const aTask = [...store._tasks.values()].find((task) => task.createdBy === alice.user.id)
    const denied = store.getBoard(bob.user.id, aTask.boardId)
    assert(denied === null)
  })

  t.test('bob cannot move alice task (404 not leak)', () => {
    const aTask = [...store._tasks.values()].find((task) => task.createdBy === alice.user.id)
    let status = 200
    try {
      store.moveTask(bob.user.id, aTask.id, aTask.columnId, 9)
    } catch (e) {
      status = e.status
    }
    assert(status === 404)
  })

  t.test('secure getTask hides foreign tasks', () => {
    const aTask = [...store._tasks.values()].find((task) => task.createdBy === alice.user.id)
    assert(store.getTaskByIdOnly(aTask.id)) // exists globally
    assert(store.getTaskSecure(bob.user.id, aTask.id) === null)
    assert(store.getTaskSecure(alice.user.id, aTask.id))
  })
})

const r4 = runSuite('Security: invites', (t) => {
  const store = createStore()
  const owner = store.register('own@ex.com', 'password1', 'Own')
  const guest = store.register('guest@ex.com', 'password1', 'Guest')
  const projectId = owner.projectId
  t.test('wrong email cannot accept', () => {
    const token = store.invite(owner.user.id, projectId, 'guest@ex.com')
    let status = 200
    try {
      // logged in as owner trying to use guest invite
      store.acceptInvite(owner.user.id, owner.user.email, token)
    } catch (e) {
      status = e.status
    }
    assert(status === 403)
  })
  t.test('matching email can accept and see project', () => {
    const token = store.invite(owner.user.id, projectId, 'guest@ex.com')
    const pid = store.acceptInvite(guest.user.id, guest.user.email, token)
    assert(pid === projectId)
    const list = store.listProjects(guest.user.id)
    assert(list.some((p) => p.id === projectId))
  })
})

const r5 = runSuite('Security: CSP headers file', (t) => {
  t.test('public/_headers has CSP', () => {
    const h = readFileSync(join(root, 'public/_headers'), 'utf8')
    assert(h.includes('Content-Security-Policy'))
    assert(h.includes("default-src 'self'"))
  })
})

const results = [r1, r2, r3, r4, r5]
const failed = results.reduce((n, r) => n + r.failed, 0)
const passed = results.reduce((n, r) => n + r.passed, 0)
console.log(`\nSecurity total: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
