/**
 * Test type 3: API contract tests — expected routes + handler exports.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSuite, assert } from './lib/test-harness.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fn = join(root, 'functions')

function mustContain(path, ...needles) {
  const src = readFileSync(path, 'utf8')
  for (const n of needles) assert(src.includes(n), `${path} missing ${n}`)
}

const expected = [
  'api/health.ts',
  'api/auth/register.ts',
  'api/auth/login.ts',
  'api/auth/logout.ts',
  'api/auth/session.ts',
  'api/projects/index.ts',
  'api/projects/[projectId].ts',
  'api/boards/[boardId].ts',
  'api/tasks/index.ts',
  'api/tasks/[taskId].ts',
  'api/tasks/[taskId]/move.ts',
  'api/invites/index.ts',
  'api/invites/accept.ts',
]

const r1 = runSuite('API contracts: files exist', (t) => {
  for (const rel of expected) {
    t.test(rel, () => {
      assert(existsSync(join(fn, rel)), `missing ${rel}`)
    })
  }
})

const r2 = runSuite('API contracts: handlers + auth gates', (t) => {
  t.test('register creates session cookie', () => {
    mustContain(join(fn, 'api/auth/register.ts'), 'sessionCookie', 'createPasswordHash', 'createProjectWithTemplate')
  })
  t.test('login rate limited', () => {
    mustContain(join(fn, 'api/auth/login.ts'), 'rateLimit', 'verifyPassword')
  })
  t.test('projects list requires session', () => {
    mustContain(join(fn, 'api/projects/index.ts'), 'requireSession')
  })
  t.test('task write uses board access', () => {
    mustContain(join(fn, 'api/tasks/index.ts'), 'getBoardAccess', 'onRequestPost')
  })
  t.test('task patch uses task access', () => {
    mustContain(join(fn, 'api/tasks/[taskId].ts'), 'getTaskAccess', 'deleted_at')
  })
  t.test('move endpoint atomic', () => {
    mustContain(join(fn, 'api/tasks/[taskId]/move.ts'), 'columnId', 'position')
  })
  t.test('health checks D1', () => {
    mustContain(join(fn, 'api/health.ts'), 'SELECT 1')
  })
  t.test('migration has users password columns', () => {
    mustContain(join(root, 'migrations/0001_init.sql'), 'password_hash', 'project_members', 'invites')
  })
})

const r3 = runSuite('API contracts: client api surface', (t) => {
  t.test('src/lib/api.ts covers auth projects boards tasks invites', () => {
    mustContain(
      join(root, 'src/lib/api.ts'),
      'register',
      'login',
      'listProjects',
      'getBoard',
      'createTask',
      'moveTask',
      'createInvite',
      'acceptInvite',
    )
  })
})

const results = [r1, r2, r3]
const failed = results.reduce((n, r) => n + r.failed, 0)
const passed = results.reduce((n, r) => n + r.passed, 0)
console.log(`\nAPI contract total: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
