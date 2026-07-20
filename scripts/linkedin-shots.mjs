/**
 * Capture FlowBoard screenshots for LinkedIn release post.
 * Registers via API, injects session cookie, then walks UI.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const OUT = path.resolve('C:/Users/brian/Downloads/flowboard-linkedin')
const BASE = process.env.API_BASE || 'https://kanban-board-public.pages.dev'
fs.mkdirSync(OUT, { recursive: true })

const email = `li-${Date.now()}@example.com`
const pass = 'LinkedInShot123!'

const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: BASE, Accept: 'application/json' },
  body: JSON.stringify({ email, password: pass, name: 'Release Demo' }),
})
const setCookie = typeof reg.headers.getSetCookie === 'function' ? reg.headers.getSetCookie() : []
const regJson = await reg.json()
if (!reg.ok) {
  console.error('register failed', reg.status, regJson)
  process.exit(1)
}
const cookieLine = setCookie.find((c) => c.startsWith('fb_token=')) || ''
const token = cookieLine.split(';')[0].replace(/^fb_token=/, '')
if (!token) {
  console.error('no fb_token cookie')
  process.exit(1)
}
const projectId = regJson.projectId
console.log('registered', email, 'project', projectId)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
await ctx.addCookies([
  {
    name: 'fb_token',
    value: decodeURIComponent(token),
    domain: 'kanban-board-public.pages.dev',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
])
const page = await ctx.newPage()

async function shot(name) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage: false })
  console.log('wrote', file)
}

// Home (logged-in header)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await shot('01-home.png')

// Dashboard
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('03-dashboard.png')

// Board
await page.goto(`${BASE}/app/projects/${projectId}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await shot('04-board.png')

// Task detail
const taskCard = page.locator('.task-card').first()
if ((await taskCard.count()) > 0) {
  await taskCard.click()
  await page.waitForTimeout(1400)
  await shot('05-task-detail.png')
  // scroll comments into view if present
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  await shot('05b-task-detail-scrolled.png')
}

// Search
await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const searchInput = page.locator('input[type=search], input[placeholder*="Search"], .input').first()
if ((await searchInput.count()) > 0) {
  await searchInput.fill('plan')
  await page.keyboard.press('Enter').catch(() => {})
  await page.waitForTimeout(900)
}
await shot('07-search.png')

// Mobile board
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
await mobile.addCookies([
  {
    name: 'fb_token',
    value: decodeURIComponent(token),
    domain: 'kanban-board-public.pages.dev',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
])
const mp = await mobile.newPage()
await mp.goto(`${BASE}/app/projects/${projectId}`, { waitUntil: 'networkidle' })
await mp.waitForTimeout(1400)
await mp.screenshot({ path: path.join(OUT, '06-board-mobile.png'), fullPage: false })
console.log('wrote mobile')

// Register form (pretty empty form for CTA)
const clean = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const rp = await clean.newPage()
await rp.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
await rp.waitForTimeout(500)
await rp.screenshot({ path: path.join(OUT, '02-register.png'), fullPage: false })
console.log('wrote register')

await browser.close()
console.log('DONE', fs.readdirSync(OUT).join(', '))
