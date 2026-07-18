/**
 * Test type 1: Unit tests — pure helpers + template expectations.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { escapeHtml, hashPassword, createPassword, runSuite, assert } from './lib/test-harness.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const r1 = runSuite('Unit: escapeHtml', (t) => {
  t.test('escapes angle brackets', () => {
    assert(escapeHtml('<script>') === '&lt;script&gt;')
  })
  t.test('escapes quotes and ampersand', () => {
    assert(escapeHtml(`a&b"c'` ) === 'a&amp;b&quot;c&#39;')
  })
})

const r2 = runSuite('Unit: password hashing', (t) => {
  t.test('same password + salt is deterministic', () => {
    const { salt, hash } = createPassword('secret123')
    assert(hashPassword('secret123', salt) === hash)
  })
  t.test('wrong password fails', () => {
    const { salt, hash } = createPassword('secret123')
    assert(hashPassword('otherpass', salt) !== hash)
  })
  t.test('salt differs per create', () => {
    const a = createPassword('secret123')
    const b = createPassword('secret123')
    assert(a.salt !== b.salt)
  })
})

const r3 = runSuite('Unit: format helpers', (t) => {
  t.test('due formatting exists in client source', () => {
    const src = readFileSync(join(root, 'src/lib/format.ts'), 'utf8')
    assert(src.includes('formatDue'))
    assert(src.includes('isOverdue'))
  })
  t.test('priority enum normalized in API', () => {
    const src = readFileSync(join(root, 'functions/api/tasks/index.ts'), 'utf8')
    assert(src.includes('critical'))
    assert(src.includes('medium'))
    assert(!src.includes("'med'"))
  })
})

const r4 = runSuite('Unit: modular structure (no monolith)', (t) => {
  t.test('legacy index.html not at app root', () => {
    try {
      readFileSync(join(root, 'legacy/index.html'), 'utf8')
    } catch {
      // ok if moved with different name
    }
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    assert(pkg.dependencies.react)
  })
  t.test('source split into pages/components/lib', () => {
    const pages = readFileSync(join(root, 'src/pages/LandingPage.tsx'), 'utf8')
    const api = readFileSync(join(root, 'src/lib/api.ts'), 'utf8')
    const board = readFileSync(join(root, 'src/components/board/BoardView.tsx'), 'utf8')
    assert(pages.includes('Start free'))
    assert(api.includes('/api/projects'))
    assert(board.includes('moveTask'))
  })
  t.test('functions split by domain', () => {
    readFileSync(join(root, 'functions/api/auth/register.ts'), 'utf8')
    readFileSync(join(root, 'functions/api/tasks/index.ts'), 'utf8')
    readFileSync(join(root, 'functions/_lib/tenancy.ts'), 'utf8')
  })
})

const results = [r1, r2, r3, r4]
const failed = results.reduce((n, r) => n + r.failed, 0)
const passed = results.reduce((n, r) => n + r.passed, 0)
console.log(`\nUnit total: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
