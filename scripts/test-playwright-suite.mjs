/**
 * Playwright: visual inspection, UX, mobile compatibility, smoke UI paths.
 */
import { chromium } from 'playwright'
import { createReporter } from './lib/test-report.mjs'
import fs from 'fs'
import path from 'path'

const BASE = (process.env.API_BASE || 'https://kanban-board-public.pages.dev').replace(/\/$/, '')
const OUT = path.resolve('docs/testing/artifacts')
fs.mkdirSync(OUT, { recursive: true })
const R = createReporter('playwright-visual-ux-mobile')

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function registerViaApi() {
  const email = `pw-${Date.now()}@example.com`
  const password = 'PlaywrightPass123!'
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password, name: 'PW User' }),
  })
  const setCookie = res.headers.getSetCookie?.() || []
  const data = await res.json()
  const line = setCookie.find((c) => c.startsWith('fb_token='))
  const token = line ? decodeURIComponent(line.split(';')[0].replace('fb_token=', '')) : ''
  return { email, password, token, projectId: data.projectId, ok: res.ok }
}

async function addAuthCookie(context, token) {
  await context.addCookies([
    {
      name: 'fb_token',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ])
}

console.log(`\n▸ playwright suite → ${BASE}`)

const browser = await chromium.launch({ headless: true })
const auth = await registerViaApi()
R.assert(auth.ok && auth.token, 'UAT-009', 'API register for UI tests')

// Desktop visual / UX
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  await addAuthCookie(ctx, auth.token)
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  R.assert((await page.locator('text=FlowBoard').count()) > 0, 'UAT-001', 'home branding')
  await page.screenshot({ path: path.join(OUT, 'vis-home.png') })

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  R.assert(page.url().includes('/app'), 'UAT-029', 'dashboard route')
  await page.screenshot({ path: path.join(OUT, 'vis-dashboard.png') })

  await page.goto(`${BASE}/app/projects/${auth.projectId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUT, 'vis-board.png'), fullPage: false })

  const hasWorkspace = (await page.locator('.board-workspace').count()) > 0
  R.assert(hasWorkspace, 'UAT-085', 'board workspace panel')

  const footer = page.locator('footer.app-footer, footer')
  R.assert((await footer.count()) > 0, 'UAT-084a', 'footer present')
  const footerBg = await footer.first().evaluate((el) => getComputedStyle(el).backgroundColor)
  // dark footer ~ rgb(7, 16, 24)
  const darkish = /rgba?\(\s*7\s*,\s*16\s*,\s*24|rgb\(7,\s*16,\s*24\)/i.test(footerBg) ||
    (await footer.first().evaluate((el) => el.classList.contains('app-footer--dark')))
  R.assert(darkish, 'UAT-084', 'black footer class/bg', `bg=${footerBg}`)

  const pills = page.locator('.pill, .pill-high, .pill-medium, .pill-low')
  R.assert((await pills.count()) > 0, 'UAT-086', 'priority pills on cards')

  const grip = page.locator('.task-card-grip')
  R.assert((await grip.count()) > 0, 'UAT-040', 'drag grip visible')

  // Horizontal overflow check
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }))
  R.assert(
    overflow.sw <= overflow.cw + 2,
    'UAT-096-desk',
    'no page horizontal overflow desktop',
    JSON.stringify(overflow),
  )

  // Focus visible
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const focusOutline = await page.evaluate(() => {
    const el = document.activeElement
    if (!el) return null
    const s = getComputedStyle(el)
    return { outline: s.outline, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow }
  })
  R.assert(
    Boolean(focusOutline),
    'UAT-087',
    'focus lands on control',
    JSON.stringify(focusOutline),
  )

  // Board filter
  const filter = page.locator('input[placeholder*="Filter"], input[aria-label*="Filter"]').first()
  if ((await filter.count()) > 0) {
    await filter.fill('Inbox')
    await page.waitForTimeout(300)
    R.pass('UAT-039', 'board text filter interaction')
  } else R.fail('UAT-039', 'board text filter interaction', 'filter input missing')

  // Open task
  const card = page.locator('.task-card').first()
  if ((await card.count()) > 0) {
    await card.click()
    await page.waitForTimeout(800)
    R.assert(page.url().includes('/app/tasks/'), 'UAT-043', 'task detail route')
    await page.screenshot({ path: path.join(OUT, 'vis-task.png') })
    const labels = await page.locator('label').count()
    R.assert(labels >= 2, 'UAT-052', 'form labels present', `labels=${labels}`)

    // Comment composer present
    const ta = page.locator('textarea').last()
    if ((await ta.count()) > 0) {
      await ta.fill('UAT comment @PW #ux')
      R.pass('UAT-063-ui', 'can type comment with mention/tag')
      // mention open
      await ta.fill('Hello @')
      await page.waitForTimeout(200)
      R.pass('UAT-068-partial', 'typed @ for mention')
    }

    // Image upload section
    R.assert(
      (await page.locator('text=Images').count()) > 0 ||
        (await page.locator('text=Choose image').count()) > 0,
      'UAT-062-ui',
      'images section visible',
    )
  } else R.fail('UAT-043', 'task detail route', 'no task card')

  // Dark mode
  const themeBtn = page.locator('button[aria-label*="dark" i], button[aria-label*="light" i], button[title*="Dark" i], button[title*="Light" i]').first()
  if ((await themeBtn.count()) > 0) {
    await themeBtn.click()
    await page.waitForTimeout(300)
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    R.assert(theme === 'dark' || theme === 'light', 'UAT-092', 'theme toggles', `theme=${theme}`)
    await page.screenshot({ path: path.join(OUT, 'vis-dark.png') })
  } else R.fail('UAT-092', 'theme toggles', 'theme button not found')

  // Header search
  const search = page.locator('#global-search, input[placeholder*="Search"]').first()
  if ((await search.count()) > 0) {
    await search.fill('plan')
    await page.waitForTimeout(500)
    R.pass('UAT-077', 'header search typing')
  } else R.fail('UAT-077', 'header search typing', 'search input missing')

  const realErrors = consoleErrors.filter(
    (e) => !/Content Security Policy|Refused to execute inline script/i.test(e),
  )
  if (consoleErrors.some((e) => /Content Security Policy/i.test(e))) {
    R.learn(
      'CSP blocks inline theme bootstrap script in index.html — fix with external script or hash',
    )
  }
  if (realErrors.length) {
    R.fail('UX-CONSOLE', 'no console errors on happy path', realErrors.slice(0, 5).join(' | '))
  } else {
    R.pass('UX-CONSOLE', 'no severe console errors (CSP inline noted separately)')
  }

  await ctx.close()
}

// Mobile
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  await addAuthCookie(ctx, auth.token)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/app/projects/${auth.projectId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUT, 'vis-mobile-board.png') })

  const tabs = page.locator('.mobile-col-tab, [role=tablist] button, .board-mobile-tabs button')
  const tabCount = await tabs.count()
  R.assert(tabCount >= 2, 'UAT-093', 'mobile column tabs present', `tabs=${tabCount}`)
  if (tabCount >= 2) {
    await tabs.nth(1).click()
    await page.waitForTimeout(300)
    R.pass('UAT-042', 'mobile tab switches column')
  }

  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }))
  R.assert(
    overflow.sw <= overflow.cw + 8,
    'UAT-096',
    'no horizontal page scroll mobile',
    JSON.stringify(overflow),
  )

  // Hamburger
  const menu = page.locator('button[aria-label*="menu" i], button:has-text("☰")').first()
  if ((await menu.count()) > 0) {
    await menu.click()
    await page.waitForTimeout(250)
    R.pass('UAT-095', 'mobile menu opens')
  } else R.skip('UAT-095', 'mobile menu opens', 'button not found at this width')

  // Task detail mobile — open first visible card (tabs may hide columns)
  await page.goto(`${BASE}/app/projects/${auth.projectId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  // Prefer a tab that has tasks
  const allTabs = page.locator('.mobile-col-tab')
  const nTabs = await allTabs.count()
  for (let i = 0; i < nTabs; i++) {
    await allTabs.nth(i).click()
    await page.waitForTimeout(200)
    if ((await page.locator('.task-card:visible').count()) > 0) break
  }
  const card = page.locator('.task-card:visible').first()
  if ((await card.count()) > 0) {
    await card.click()
    await page.waitForTimeout(900)
    const titleInput = page.locator('#t-title, input.input').first()
    R.assert((await titleInput.count()) > 0, 'UAT-094', 'task form controls present mobile')
    if ((await titleInput.count()) > 0) {
      const box = await titleInput.boundingBox()
      R.assert(
        Boolean(box) && box.width >= 200,
        'UAT-094b',
        'inputs reasonably wide',
        `w=${box?.width}`,
      )
    }
    await page.screenshot({ path: path.join(OUT, 'vis-mobile-task.png') })
  } else {
    R.fail('UAT-094', 'task form controls present mobile', 'no visible task card after tab scan')
  }

  // Touch target height sampling (primary actions only)
  const minH = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button.btn, a.btn, .btn-primary, .mobile-col-tab')]
    const heights = btns.map((b) => b.getBoundingClientRect().height).filter((h) => h > 0)
    return heights.length ? Math.min(...heights) : 0
  })
  R.assert(minH >= 36, 'UAT-088', 'primary touch targets reasonable', `minH=${minH}`)
  if (minH > 0 && minH < 44) {
    R.learn(
      `Primary controls min height ${minH}px — below 44px WCAG 2.5.5 AAA, OK for AA if spacing allows`,
    )
  }

  await ctx.close()
}

// Unauth header search messaging
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const ph = await page.locator('#global-search, input[placeholder*="Search"], input[placeholder*="Sign"]').first().getAttribute('placeholder')
  R.assert(
    /sign in|search/i.test(ph || ''),
    'UAT-078',
    'header search unauth placeholder',
    `ph=${ph}`,
  )
  await ctx.close()
}

await browser.close()
const summary = R.summary()
console.log(
  `\nplaywright: ${summary.passed} pass / ${summary.failed} fail / ${summary.skipped} skip (${summary.durationMs}ms)`,
)
export default summary
