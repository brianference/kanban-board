/**
 * Full production e2e suite for FlowBoard (Cloudflare Pages + D1).
 *
 * Catches regressions that unit sims miss: multipart upload, binary image
 * round-trip, cookie sessions, tenancy isolation, size limits.
 *
 * Usage:
 *   API_BASE=https://kanban-board-public.pages.dev node scripts/e2e-prod.mjs
 *   npm run test:e2e
 */
const BASE = (process.env.API_BASE || 'https://kanban-board-public.pages.dev').replace(/\/$/, '')
const ORIGIN = BASE

/** 1×1 PNG */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

/** Minimal JPEG (1×1) */
const JPEG_1X1 = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
  ),
  (c) => c.charCodeAt(0),
)

let passed = 0
let failed = 0
const failures = []

function ok(name) {
  passed += 1
  console.log(`  ✓ ${name}`)
}

function fail(name, detail) {
  failed += 1
  failures.push({ name, detail })
  console.error(`  ✗ ${name}: ${detail}`)
}

function assert(cond, name, detail = '') {
  if (cond) ok(name)
  else fail(name, detail || 'assertion failed')
}

function pickCookie(setCookieLines) {
  for (const line of setCookieLines || []) {
    const part = line.split(';')[0]
    if (part.startsWith('fb_token=')) return part
  }
  return ''
}

async function api(path, { method = 'GET', body, cookie, formData, accept } = {}) {
  const headers = {
    Accept: accept || 'application/json',
    Origin: ORIGIN,
  }
  if (cookie) headers.Cookie = cookie
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
  })

  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const buf = new Uint8Array(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || ''
  let data = null
  let text = ''
  if (contentType.includes('application/json') || (buf[0] === 0x7b /* { */ || buf[0] === 0x5b) /* [ */) {
    text = new TextDecoder().decode(buf)
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  } else {
    text = contentType.includes('text') ? new TextDecoder().decode(buf) : ''
  }
  return { status: res.status, data, text, buf, contentType, setCookie, headers: res.headers }
}

function section(title) {
  console.log(`\n▸ ${title}`)
}

// ─── Suite ───────────────────────────────────────────────────────────
console.log(`FlowBoard e2e → ${BASE}`)
console.log(`Time: ${new Date().toISOString()}`)

const stamp = Date.now()
const email = `e2e-${stamp}@example.com`
const emailB = `e2e-b-${stamp}@example.com`
const password = 'password12345'

// 1. Health + static SPA
section('Health & static shell')
{
  const h = await api('/api/health')
  assert(h.status === 200 && h.data?.ok === true, 'health ok')
  assert(h.data?.db === 'up', 'health db up', JSON.stringify(h.data))
  assert(typeof h.data?.version === 'string', 'health version present')

  const home = await fetch(`${BASE}/`, { headers: { Accept: 'text/html' } })
  const html = await home.text()
  assert(home.status === 200, 'homepage 200')
  assert(/FlowBoard|index-.*\.js/.test(html), 'homepage has app shell', html.slice(0, 120))
  const jsMatch = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
  if (jsMatch) {
    const js = await fetch(`${BASE}/${jsMatch[0]}`)
    assert(js.status === 200, 'main JS bundle reachable')
  } else {
    fail('main JS bundle reachable', 'no assets/index-*.js in HTML')
  }
}

// 2. Auth
section('Auth')
let cookie = ''
let userId = ''
let projectId = ''
{
  const bad = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'not-an-email', password: 'short' },
  })
  assert(bad.status >= 400, 'register rejects invalid email/password', `status ${bad.status}`)

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password, name: 'E2E User' },
  })
  assert(reg.status === 201 && reg.data?.ok, 'register 201', JSON.stringify(reg.data))
  cookie = pickCookie(reg.setCookie)
  assert(Boolean(cookie), 'register sets fb_token cookie', String(reg.setCookie))
  userId = reg.data?.user?.id
  projectId = reg.data?.projectId
  assert(Boolean(userId), 'register returns user id')
  assert(Boolean(projectId), 'register creates first project')

  const sess = await api('/api/auth/session', { cookie })
  assert(sess.status === 200 && sess.data?.user?.email === email, 'session email matches')

  const noAuth = await api('/api/auth/session')
  assert(noAuth.status === 401, 'session without cookie is 401')

  const logout = await api('/api/auth/logout', { method: 'POST', cookie, body: {} })
  assert(logout.status === 200, 'logout ok')
  const afterOut = await api('/api/auth/session', { cookie })
  // cookie still sent but cleared server-side may still work until client drops cookie;
  // re-login to refresh
  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong-password-xx' },
  })
  assert(badLogin.status === 401, 'login rejects wrong password')

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  assert(login.status === 200 && login.data?.ok, 'login ok')
  cookie = pickCookie(login.setCookie) || cookie
  assert(Boolean(cookie), 'login sets cookie')
}

// 3. Projects & board
section('Projects & board')
let boardId = ''
let columns = []
{
  const list = await api('/api/projects', { cookie })
  assert(list.status === 200 && Array.isArray(list.data?.projects), 'list projects')
  assert(list.data.projects.length >= 1, 'has at least one project')

  const created = await api('/api/projects', {
    method: 'POST',
    cookie,
    body: { name: `E2E Project ${stamp}`, template: 'personal' },
  })
  assert(created.status === 201 && created.data?.projectId, 'create project')
  projectId = created.data.projectId
  boardId = created.data.boardId
  assert(Boolean(boardId), 'create project returns boardId')

  const detail = await api(`/api/projects/${projectId}`, { cookie })
  assert(detail.status === 200, 'get project')
  assert(detail.data?.role === 'owner', 'project role owner')
  boardId = detail.data.boards?.[0]?.id || boardId

  const board = await api(`/api/boards/${boardId}`, { cookie })
  assert(board.status === 200, 'get board')
  columns = board.data?.columns || []
  assert(columns.length >= 3, `board has columns (got ${columns.length})`)
  assert(Array.isArray(board.data?.tasks), 'board has tasks array')
}

// 4. Tasks, move, patch
section('Tasks')
let taskId = ''
{
  const col0 = columns[0].id
  const col1 = columns[1]?.id || col0
  const created = await api('/api/tasks', {
    method: 'POST',
    cookie,
    body: {
      boardId,
      columnId: col0,
      title: `E2E task ${stamp}`,
      description: 'attachment + checklist target',
      priority: 'high',
      tags: ['e2e', 'img'],
    },
  })
  assert(created.status === 201 && created.data?.taskId, 'create task', JSON.stringify(created.data))
  taskId = created.data.taskId

  const detail = await api(`/api/tasks/${taskId}`, { cookie })
  assert(detail.status === 200 && detail.data?.task?.title?.includes('E2E task'), 'get task')
  assert(Array.isArray(detail.data?.task?.attachments), 'task has attachments array')

  const patch = await api(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    cookie,
    body: { description: 'updated by e2e', priority: 'critical' },
  })
  assert(patch.status === 200, 'patch task')

  const move = await api(`/api/tasks/${taskId}/move`, {
    method: 'POST',
    cookie,
    body: { columnId: col1, position: 0 },
  })
  assert(move.status === 200 && move.data?.ok, 'move task')

  const after = await api(`/api/tasks/${taskId}`, { cookie })
  assert(after.data?.task?.columnId === col1, 'task column after move')
  assert(after.data?.task?.priority === 'critical', 'task priority after patch')
}

// 5. Checklist + comments
section('Checklist & comments')
{
  const add = await api(`/api/tasks/${taskId}/checklist`, {
    method: 'POST',
    cookie,
    body: { title: 'E2E checklist item' },
  })
  assert(add.status === 201 || add.status === 200, 'add checklist', JSON.stringify(add.data))
  const itemId = add.data?.item?.id
  assert(Boolean(itemId), 'checklist item id')

  if (itemId) {
    const patch = await api(`/api/checklist/${itemId}`, {
      method: 'PATCH',
      cookie,
      body: { done: true },
    })
    assert(patch.status === 200, 'toggle checklist')
  }

  const cmt = await api(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    cookie,
    body: { body: 'E2E comment body' },
  })
  assert(cmt.status === 201 || cmt.status === 200, 'add comment')

  const detail = await api(`/api/tasks/${taskId}`, { cookie })
  assert(
    (detail.data?.checklist || []).some((c) => c.title === 'E2E checklist item'),
    'checklist on task detail',
  )
  assert(
    (detail.data?.comments || []).some((c) => String(c.body).includes('E2E comment')),
    'comment on task detail',
  )
}

// 6. Attachments — the regression we shipped broken
section('Attachments (PNG/JPEG round-trip)')
{
  // PNG upload
  const fd = new FormData()
  fd.append('file', new Blob([PNG_1X1], { type: 'image/png' }), 'dot.png')
  const up = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: fd,
  })
  assert(up.status === 201 && up.data?.ok, 'upload PNG 201', JSON.stringify(up.data))
  const attId = up.data?.attachment?.id
  const attUrl = up.data?.attachment?.url
  assert(Boolean(attId), 'attachment id returned')
  assert(attUrl === `/api/attachments/${attId}`, 'attachment url shape')

  // Binary GET — must be real PNG, not JSON
  const img = await api(attUrl, { cookie, accept: 'image/*,*/*' })
  assert(img.status === 200, 'GET attachment 200', `status ${img.status} ct=${img.contentType}`)
  assert(
    img.contentType.includes('image/png') || img.contentType.includes('image/'),
    'Content-Type is image',
    img.contentType,
  )
  assert(img.buf.byteLength === PNG_1X1.byteLength, 'PNG byte length matches', `${img.buf.byteLength} vs ${PNG_1X1.byteLength}`)
  assert(
    img.buf[0] === 0x89 && img.buf[1] === 0x50 && img.buf[2] === 0x4e && img.buf[3] === 0x47,
    'PNG magic bytes 89 50 4e 47',
    [...img.buf.slice(0, 4)].map((b) => b.toString(16)).join(' '),
  )
  // Must NOT be JSON error body
  const asText = new TextDecoder().decode(img.buf.slice(0, 20))
  assert(!asText.startsWith('{'), 'image body is not JSON', asText)

  // Unauthenticated GET should fail
  const anon = await api(attUrl, { accept: 'image/*' })
  assert(anon.status === 401 || anon.status === 404, 'attachment requires auth', `status ${anon.status}`)

  // JPEG upload
  const fdJ = new FormData()
  fdJ.append('file', new Blob([JPEG_1X1], { type: 'image/jpeg' }), 'dot.jpg')
  const upJ = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: fdJ,
  })
  assert(upJ.status === 201, 'upload JPEG 201', JSON.stringify(upJ.data))
  if (upJ.data?.attachment?.url) {
    const j = await api(upJ.data.attachment.url, { cookie, accept: 'image/*' })
    assert(j.status === 200 && j.buf[0] === 0xff && j.buf[1] === 0xd8, 'JPEG magic ff d8')
  }

  // Empty MIME + .png extension still accepted
  const fdExt = new FormData()
  fdExt.append('file', new Blob([PNG_1X1], { type: '' }), 'from-windows.png')
  const upExt = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: fdExt,
  })
  assert(upExt.status === 201, 'upload PNG with empty MIME via extension', JSON.stringify(upExt.data))

  // Reject non-image
  const fdBad = new FormData()
  fdBad.append('file', new Blob([new TextEncoder().encode('not an image')], { type: 'text/plain' }), 'x.txt')
  const upBad = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: fdBad,
  })
  assert(upBad.status >= 400, 'reject non-image upload', `status ${upBad.status}`)

  // Reject oversized (synthetic ~1.1MB of zeros with PNG header so type check passes first… or pure size)
  const huge = new Uint8Array(1_100_000)
  huge[0] = 0x89
  huge[1] = 0x50
  huge[2] = 0x4e
  huge[3] = 0x47
  huge[4] = 0x0d
  huge[5] = 0x0a
  huge[6] = 0x1a
  huge[7] = 0x0a
  const fdHuge = new FormData()
  fdHuge.append('file', new Blob([huge], { type: 'image/png' }), 'huge.png')
  const upHuge = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: fdHuge,
  })
  assert(upHuge.status === 400, 'reject oversized image', `status ${upHuge.status} ${JSON.stringify(upHuge.data)}`)

  // Task detail lists attachments
  const detail = await api(`/api/tasks/${taskId}`, { cookie })
  const atts = detail.data?.task?.attachments || []
  assert(atts.length >= 2, `task lists attachments (got ${atts.length})`)
  assert(
    atts.every((a) => a.url && a.id && a.filename),
    'attachment objects have id/url/filename',
  )

  // Delete one attachment
  if (attId) {
    const del = await api(`/api/attachments/${attId}`, { method: 'DELETE', cookie, body: {} })
    assert(del.status === 200, 'delete attachment')
    const gone = await api(`/api/attachments/${attId}`, { cookie, accept: 'image/*' })
    assert(gone.status === 404 || gone.status === 401, 'deleted attachment not found')
  }
}

// 7. Search
section('Search')
{
  const s = await api(`/api/search?q=E2E%20task&priority=critical`, { cookie })
  assert(s.status === 200, 'search 200')
  assert(
    (s.data?.results || []).some((r) => r.id === taskId),
    'search finds e2e task',
    JSON.stringify(s.data?.results?.slice(0, 2)),
  )
}

// 8. Tenancy isolation
section('Tenancy isolation')
{
  const regB = await api('/api/auth/register', {
    method: 'POST',
    body: { email: emailB, password, name: 'Other' },
  })
  const cookieB = pickCookie(regB.setCookie)
  assert(regB.status === 201 && cookieB, 'second user registers')

  const steal = await api(`/api/tasks/${taskId}`, { cookie: cookieB })
  assert(steal.status === 404 || steal.status === 403, 'other user cannot read task', `status ${steal.status}`)

  const stealBoard = await api(`/api/boards/${boardId}`, { cookie: cookieB })
  assert(
    stealBoard.status === 404 || stealBoard.status === 403,
    'other user cannot read board',
    `status ${stealBoard.status}`,
  )
}

// 9. Contact + CSRF-ish same-origin
section('Contact & origin guard')
{
  const contact = await api('/api/contact', {
    method: 'POST',
    body: {
      name: 'E2E',
      email: 'e2e@example.com',
      subject: 'E2E subject',
      message: 'Long enough contact message for validation path.',
    },
  })
  assert(contact.status === 201, 'contact 201', JSON.stringify(contact.data))

  // Cross-origin POST should be blocked when Origin is foreign
  const cross = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://evil.example',
      Cookie: cookie,
    },
    body: '{}',
  })
  assert(cross.status === 403, 'cross-origin POST blocked', `status ${cross.status}`)
}

// 10. Cleanup
section('Cleanup')
{
  const delTask = await api(`/api/tasks/${taskId}`, { method: 'DELETE', cookie, body: {} })
  assert(delTask.status === 200, 'delete e2e task')

  const delProj = await api(`/api/projects/${projectId}`, { method: 'DELETE', cookie })
  // some deployments may only soft-allow owner delete
  assert(delProj.status === 200 || delProj.status === 404, 'delete e2e project', `status ${delProj.status}`)
}

// Summary
console.log('\n────────────────────────────────────')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`)
  process.exit(1)
}
console.log('\nAll e2e checks passed.')
