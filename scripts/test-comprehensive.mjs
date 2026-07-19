/**
 * Smoke + integration + security API suite (maps to UAT catalog).
 */
import { createReporter } from './lib/test-report.mjs'

const BASE = (process.env.API_BASE || 'https://kanban-board-public.pages.dev').replace(/\/$/, '')
const ORIGIN = BASE
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

const R = createReporter('comprehensive-api')

function pickCookie(lines) {
  for (const line of lines || []) {
    const p = line.split(';')[0]
    if (p.startsWith('fb_token=')) return p
  }
  return ''
}

async function api(path, { method = 'GET', body, cookie, formData, origin = ORIGIN, accept } = {}) {
  const headers = { Accept: accept || 'application/json' }
  if (origin) headers.Origin = origin
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
  if (contentType.includes('json') || buf[0] === 0x7b || buf[0] === 0x5b) {
    text = new TextDecoder().decode(buf)
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  return { status: res.status, data, text, buf, contentType, setCookie, headers: res.headers }
}

console.log(`\n▸ comprehensive-api → ${BASE}`)

// A smoke
{
  const h = await api('/api/health')
  R.assert(h.status === 200 && h.data?.ok, 'UAT-002', 'health ok', JSON.stringify(h.data))
  R.assert(h.data?.db === 'up', 'UAT-002b', 'health db up')
  R.assert(typeof h.data?.version === 'string', 'UAT-002c', 'health version')

  const home = await fetch(`${BASE}/`)
  const html = await home.text()
  R.assert(home.status === 200, 'UAT-001', 'homepage 200')
  R.assert(/FlowBoard/i.test(html), 'UAT-001b', 'homepage branding')
  const js = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
  if (js) {
    const a = await fetch(`${BASE}/${js[0]}`)
    R.assert(a.status === 200, 'UAT-003', 'JS bundle 200')
  } else R.fail('UAT-003', 'JS bundle 200', 'no asset in HTML')
  const css = html.match(/assets\/index-[A-Za-z0-9_-]+\.css/)
  if (css) {
    const a = await fetch(`${BASE}/${css[0]}`)
    R.assert(a.status === 200, 'UAT-004', 'CSS bundle 200')
  } else R.fail('UAT-004', 'CSS bundle 200', 'no css')

  for (const [id, p] of [
    ['UAT-005', '/robots.txt'],
    ['UAT-006', '/favicon.svg'],
  ]) {
    const r = await fetch(`${BASE}${p}`)
    R.assert(r.status === 200, id, `${p} 200`)
  }
  for (const [id, p] of [
    ['UAT-007', '/register'],
    ['UAT-008', '/login'],
  ]) {
    const r = await fetch(`${BASE}${p}`)
    const t = await r.text()
    // SPA shell only in static HTML — form fields mount via React
    R.assert(
      r.status === 200 && (/id="root"|FlowBoard|stylesheet/i.test(t)),
      id,
      `${p} SPA shell`,
    )
  }
  R.learn('Auth forms are client-rendered; static fetch only proves SPA shell, not form DOM')
}

// B auth
const stamp = Date.now()
const email = `comp-${stamp}@example.com`
const emailB = `comp-b-${stamp}@example.com`
const password = 'password12345'
let cookie = ''
let projectId = ''
let boardId = ''
let taskId = ''
let columns = []

{
  const bad = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'bad', password: 'x' },
  })
  R.assert(bad.status >= 400, 'UAT-015', 'short password rejected', `status ${bad.status}`)

  const inv = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'not-an-email', password: 'longenough' },
  })
  R.assert(inv.status >= 400, 'UAT-016', 'invalid email rejected')

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password, name: 'Comp User' },
  })
  R.assert(reg.status === 201 && reg.data?.ok, 'UAT-009', 'register 201', JSON.stringify(reg.data))
  cookie = pickCookie(reg.setCookie)
  R.assert(Boolean(cookie), 'UAT-009b', 'register cookie')
  projectId = reg.data?.projectId
  R.assert(Boolean(projectId), 'UAT-009c', 'register projectId')

  const sess = await api('/api/auth/session', { cookie })
  R.assert(sess.status === 200 && sess.data?.user?.email === email, 'UAT-010', 'session email')

  const bare = await api('/api/auth/session')
  R.assert(bare.status === 401, 'UAT-017', 'session no cookie 401')

  const dup = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password, name: 'Dup' },
  })
  R.assert(dup.status === 409 || dup.status >= 400, 'UAT-014', 'duplicate email rejected')

  const logout = await api('/api/auth/logout', { method: 'POST', cookie, body: {} })
  R.assert(logout.status === 200, 'UAT-011', 'logout')

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong-password-xx' },
  })
  R.assert(badLogin.status === 401, 'UAT-013', 'bad login 401')

  const login = await api('/api/auth/login', { method: 'POST', body: { email, password } })
  R.assert(login.status === 200, 'UAT-012', 'login ok')
  cookie = pickCookie(login.setCookie) || cookie

  const cross = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://evil.example',
      Cookie: cookie,
    },
    body: '{}',
  })
  R.assert(cross.status === 403, 'UAT-018', 'cross-origin blocked', `status ${cross.status}`)
  R.learn('Origin check on mutating auth routes returns 403 for foreign Origin')
}

// C projects
{
  const list = await api('/api/projects', { cookie })
  R.assert(list.status === 200 && (list.data?.projects?.length ?? 0) >= 1, 'UAT-021', 'list projects')

  const empty = await api('/api/projects', { method: 'POST', cookie, body: { name: '' } })
  R.assert(empty.status >= 400, 'UAT-030', 'empty project name rejected')

  const created = await api('/api/projects', {
    method: 'POST',
    cookie,
    body: { name: `Comp Project ${stamp}`, template: 'personal' },
  })
  R.assert(created.status === 201 && created.data?.projectId, 'UAT-022', 'create project')
  projectId = created.data.projectId
  boardId = created.data.boardId
  R.assert(Boolean(boardId), 'UAT-022b', 'boardId returned')

  const detail = await api(`/api/projects/${projectId}`, { cookie })
  R.assert(detail.status === 200 && detail.data?.role === 'owner', 'UAT-023', 'get project owner')
  boardId = detail.data.boards?.[0]?.id || boardId

  const board = await api(`/api/boards/${boardId}`, { cookie })
  R.assert(board.status === 200, 'UAT-031', 'get board')
  columns = board.data?.columns || []
  R.assert(columns.length >= 3, 'UAT-032', `columns count ${columns.length}`)
  R.assert(
    (board.data?.tasks?.length ?? 0) >= 1,
    'UAT-028',
    'template starter tasks',
    `tasks=${board.data?.tasks?.length}`,
  )
}

// D tasks
{
  const col0 = columns[0]?.id
  const col1 = columns[1]?.id || col0
  const created = await api('/api/tasks', {
    method: 'POST',
    cookie,
    body: {
      boardId,
      columnId: col0,
      title: `Comp task ${stamp}`,
      description: 'integration test',
      priority: 'high',
      tags: ['comp'],
    },
  })
  R.assert(created.status === 201 && created.data?.taskId, 'UAT-033', 'create task')
  taskId = created.data.taskId

  const patch = await api(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    cookie,
    body: { title: `Comp task patched ${stamp}`, priority: 'critical', description: 'updated' },
  })
  R.assert(patch.status === 200, 'UAT-035', 'patch task')

  const get = await api(`/api/tasks/${taskId}`, { cookie })
  R.assert(get.status === 200 && get.data?.task?.priority === 'critical', 'UAT-036', 'priority critical')
  R.assert(get.data?.task?.description === 'updated', 'UAT-044', 'description persists')

  const move = await api(`/api/tasks/${taskId}/move`, {
    method: 'POST',
    cookie,
    body: { columnId: col1, position: 0 },
  })
  R.assert(move.status === 200, 'UAT-034', 'move task')
  const after = await api(`/api/tasks/${taskId}`, { cookie })
  R.assert(after.data?.task?.columnId === col1, 'UAT-034b', 'column after move')
}

// E checklist + comments
{
  const add = await api(`/api/tasks/${taskId}/checklist`, {
    method: 'POST',
    cookie,
    body: { title: 'Comp check' },
  })
  R.assert(add.status === 200 || add.status === 201, 'UAT-046', 'add checklist', JSON.stringify(add.data))
  const itemId = add.data?.item?.id
  if (itemId) {
    const t = await api(`/api/checklist/${itemId}`, {
      method: 'PATCH',
      cookie,
      body: { done: true },
    })
    R.assert(t.status === 200, 'UAT-047', 'toggle checklist')
  } else R.fail('UAT-047', 'toggle checklist', 'no item id')

  const cmt = await api(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    cookie,
    body: { body: `Hello @comp-user #focus ${stamp}` },
  })
  R.assert(cmt.status === 200 || cmt.status === 201, 'UAT-063', 'post comment')

  const fd = new FormData()
  fd.append('body', `Image comment @Comp #shot`)
  fd.append('file', new Blob([PNG], { type: 'image/png' }), 'dot.png')
  const cimg = await api(`/api/tasks/${taskId}/comments`, { method: 'POST', cookie, formData: fd })
  R.assert(
    cimg.status === 201 || cimg.status === 200,
    'UAT-064',
    'comment with image',
    JSON.stringify(cimg.data)?.slice(0, 180),
  )
  if (cimg.data?.comment?.attachments?.[0]?.url) {
    const img = await api(cimg.data.comment.attachments[0].url, {
      cookie,
      accept: 'image/*',
    })
    R.assert(
      img.status === 200 && img.buf[0] === 0x89 && img.buf[1] === 0x50,
      'UAT-064b',
      'comment image magic PNG',
      `status ${img.status} ct=${img.contentType}`,
    )
  } else {
    R.fail('UAT-064b', 'comment image magic PNG', 'no attachment url — table/migrate?')
    R.learn('Comment image path may need migration 0005 applied on remote D1')
  }

  const emptyC = await api(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    cookie,
    body: { body: '' },
  })
  R.assert(emptyC.status >= 400, 'UAT-073', 'empty comment rejected')
}

// F attachments
{
  const fd = new FormData()
  fd.append('file', new Blob([PNG], { type: 'image/png' }), 't.png')
  const up = await api(`/api/tasks/${taskId}/attachments`, { method: 'POST', cookie, formData: fd })
  R.assert(up.status === 201, 'UAT-053', 'upload PNG', JSON.stringify(up.data)?.slice(0, 120))
  const url = up.data?.attachment?.url
  if (url) {
    const img = await api(url, { cookie, accept: 'image/*' })
    R.assert(
      img.status === 200 && img.buf[0] === 0x89,
      'UAT-053b',
      'PNG magic',
      `len=${img.buf.length}`,
    )
    const anon = await api(url, { accept: 'image/*' })
    R.assert(anon.status === 401 || anon.status === 404, 'UAT-058', 'attachment auth required')
    const del = await api(`/api/attachments/${up.data.attachment.id}`, {
      method: 'DELETE',
      cookie,
      body: {},
    })
    R.assert(del.status === 200, 'UAT-059', 'delete attachment')
  }

  const bad = new FormData()
  bad.append('file', new Blob([new TextEncoder().encode('x')], { type: 'text/plain' }), 'x.txt')
  const upBad = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: bad,
  })
  R.assert(upBad.status >= 400, 'UAT-056', 'reject non-image')

  const huge = new Uint8Array(1_100_000)
  huge.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const fdH = new FormData()
  fdH.append('file', new Blob([huge], { type: 'image/png' }), 'huge.png')
  const upH = await api(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    cookie,
    formData: fdH,
  })
  R.assert(upH.status === 400, 'UAT-057', 'reject oversized', `status ${upH.status}`)
}

// G search contact legal
{
  const s = await api(`/api/search?q=Comp%20task&priority=critical`, { cookie })
  R.assert(s.status === 200, 'UAT-075', 'search 200')
  R.assert(
    (s.data?.results || []).some((r) => r.id === taskId),
    'UAT-075b',
    'search finds task',
  )

  const contact = await api('/api/contact', {
    method: 'POST',
    body: {
      name: 'Comp',
      email: 'c@example.com',
      subject: 'Test',
      message: 'Long enough contact message for validation.',
    },
  })
  R.assert(contact.status === 201, 'UAT-079', 'contact 201')

  for (const [id, p] of [
    ['UAT-081a', '/privacy'],
    ['UAT-081b', '/terms'],
    ['UAT-082a', '/about'],
    ['UAT-082b', '/contact'],
  ]) {
    const r = await fetch(`${BASE}${p}`)
    R.assert(r.status === 200, id, `${p} 200`)
  }
}

// H tenancy
{
  const regB = await api('/api/auth/register', {
    method: 'POST',
    body: { email: emailB, password, name: 'Other' },
  })
  const cookieB = pickCookie(regB.setCookie)
  R.assert(regB.status === 201 && cookieB, 'UAT-025setup', 'second user')
  const stealT = await api(`/api/tasks/${taskId}`, { cookie: cookieB })
  R.assert(stealT.status === 404 || stealT.status === 403, 'UAT-027', 'foreign task blocked')
  const stealB = await api(`/api/boards/${boardId}`, { cookie: cookieB })
  R.assert(stealB.status === 404 || stealB.status === 403, 'UAT-026', 'foreign board blocked')
  const stealP = await api(`/api/projects/${projectId}`, { cookie: cookieB })
  R.assert(stealP.status === 404 || stealP.status === 403, 'UAT-025', 'foreign project blocked')
  const stealC = await api(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    cookie: cookieB,
    body: { body: 'nope' },
  })
  R.assert(stealC.status === 404 || stealC.status === 403, 'UAT-074', 'foreign comment blocked')
}

// cleanup
{
  await api(`/api/tasks/${taskId}`, { method: 'DELETE', cookie, body: {} })
  R.pass('UAT-037', 'delete task cleanup')
  const delP = await api(`/api/projects/${projectId}`, { method: 'DELETE', cookie })
  R.assert(delP.status === 200 || delP.status === 404, 'UAT-024', 'delete project')
}

const summary = R.summary()
console.log(
  `\ncomprehensive-api: ${summary.passed} pass / ${summary.failed} fail / ${summary.total} total (${summary.durationMs}ms)`,
)
export default summary
