/**
 * Simulate UX navigation fixes on production.
 */
import { chromium } from 'playwright'

const BASE = process.env.API_BASE || 'https://kanban-board-public.pages.dev'
const email = `uxnav-${Date.now()}@example.com`
const password = 'UxTestPass123!'

const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: BASE },
  body: JSON.stringify({ email, password, name: 'UX Nav' }),
})
const sc = reg.headers.getSetCookie?.() || []
const line = sc.find((c) => c.startsWith('fb_token='))
const token = decodeURIComponent(line.split(';')[0].replace('fb_token=', ''))
const j = await reg.json()
if (!reg.ok) {
  console.error('register failed', reg.status, j)
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addCookies([
  {
    name: 'fb_token',
    value: token,
    domain: 'kanban-board-public.pages.dev',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
])
const page = await ctx.newPage()

// wait for CDN
await page.waitForTimeout(2500)
await page.goto(`${BASE}/app/projects/${j.projectId}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const results = []

// 1 quick add
const quick = page.locator('#quick-task')
if ((await quick.count()) > 0) {
  await quick.fill('UX sim task from board')
  await page.getByRole('button', { name: /Add task/i }).click()
  await page.waitForTimeout(1500)
  const text = await page.content()
  results.push({
    case: 'quick-add stays on board',
    ok: page.url().includes('/app/projects/') && text.includes('UX sim task'),
    url: page.url(),
  })
} else {
  results.push({ case: 'quick-add stays on board', ok: false, detail: 'no #quick-task' })
}

// 2 open task, save → board
const card = page.locator('.task-card').filter({ hasText: 'UX sim task' }).first()
if ((await card.count()) === 0) {
  await page.locator('.task-card').first().click()
} else {
  await card.click()
}
await page.waitForTimeout(1000)
results.push({
  case: 'back-to-board button visible',
  ok: (await page.getByRole('button', { name: /Back to board/i }).count()) > 0,
})

await page.locator('#t-pri').selectOption('critical')
await page.getByRole('button', { name: /Save/i }).first().click()
await page.waitForTimeout(1500)
results.push({
  case: 'save returns to board',
  ok: page.url().includes(`/app/projects/${j.projectId}`),
  url: page.url(),
})

// 3 cancel from another task
const card2 = page.locator('.task-card').first()
if ((await card2.count()) > 0) {
  await card2.click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /Cancel|Back to board/i }).first().click()
  await page.waitForTimeout(800)
  results.push({
    case: 'cancel returns to board',
    ok: page.url().includes('/app/projects/'),
    url: page.url(),
  })
}

// 4 login return path
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const p2 = await ctx2.newPage()
await p2.goto(`${BASE}/app/projects/${j.projectId}`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(800)
// should redirect to login with state
const onLogin = p2.url().includes('/login')
await p2.fill('#login-email', email)
await p2.fill('#login-pass', password)
await p2.getByRole('button', { name: /Sign in|Welcome/i }).or(p2.locator('button[type=submit]')).first().click()
await p2.waitForTimeout(1500)
results.push({
  case: 'login returns to protected board',
  ok: onLogin && p2.url().includes(`/app/projects/${j.projectId}`),
  url: p2.url(),
  redirectedToLogin: onLogin,
})

await browser.close()

let failed = 0
for (const r of results) {
  const mark = r.ok ? '✓' : '✗'
  console.log(`${mark} ${r.case}`, r.ok ? '' : JSON.stringify(r))
  if (!r.ok) failed++
}
console.log(failed ? `FAILED ${failed}` : 'ALL UX SIMS PASSED')
process.exit(failed ? 1 : 0)
