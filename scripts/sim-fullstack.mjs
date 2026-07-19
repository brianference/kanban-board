/**
 * Simulate users against a running FlowBoard API (default localhost:8787).
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:8787'

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.getSetCookie?.() || []
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data, setCookie }
}

function pickCookie(setCookie) {
  const line = setCookie.find((c) => c.startsWith('fb_token='))
  return line ? line.split(';')[0] : ''
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const email = `sim-${Date.now()}@example.com`
const password = 'password123'

console.log('Simulating against', BASE)

const health = await req('/api/health')
assert(health.status === 200 && health.data.ok, 'health failed')
console.log('✓ health')

const reg = await req('/api/auth/register', {
  method: 'POST',
  body: { email, password, name: 'Sim User' },
})
assert(reg.status === 201, `register ${reg.status} ${JSON.stringify(reg.data)}`)
const cookie = pickCookie(reg.setCookie)
assert(cookie, 'missing session cookie')
console.log('✓ register')

const sess = await req('/api/auth/session', { cookie })
assert(sess.status === 200 && sess.data.user?.email === email, 'session failed')
console.log('✓ session')

const projects = await req('/api/projects', { cookie })
assert(projects.status === 200 && projects.data.projects?.length >= 1, 'projects empty')
const projectId = projects.data.projects[0].id
console.log('✓ list projects')

const detail = await req(`/api/projects/${projectId}`, { cookie })
const boardId = detail.data.boards[0].id
const board = await req(`/api/boards/${boardId}`, { cookie })
assert(board.data.tasks?.length >= 1, 'no tasks')
const col = board.data.columns[0].id
console.log('✓ board')

const created = await req('/api/tasks', {
  method: 'POST',
  cookie,
  body: {
    boardId,
    columnId: col,
    title: 'Simulated task',
    description: 'Created by sim-fullstack',
    priority: 'high',
    tags: ['sim'],
  },
})
assert(created.status === 201, 'create task failed')
const taskId = created.data.taskId
console.log('✓ create task')

const task = await req(`/api/tasks/${taskId}`, { cookie })
assert(task.status === 200 && task.data.task.title === 'Simulated task', 'task detail failed')
console.log('✓ task detail')

const search = await req('/api/search?q=simulated&priority=high', { cookie })
assert(search.data.results?.some((r) => r.id === taskId), 'search miss')
console.log('✓ search')

const movedCol = board.data.columns[board.data.columns.length - 1].id
const move = await req(`/api/tasks/${taskId}/move`, {
  method: 'POST',
  cookie,
  body: { columnId: movedCol, position: 1 },
})
assert(move.status === 200, 'move failed')
console.log('✓ move')

const contact = await req('/api/contact', {
  method: 'POST',
  body: {
    name: 'Sim',
    email: 'sim@example.com',
    subject: 'Hello',
    message: 'This is a simulation contact message.',
  },
})
assert(contact.status === 201, 'contact failed')
console.log('✓ contact')

const del = await req(`/api/tasks/${taskId}`, { method: 'DELETE', cookie })
assert(del.status === 200, 'delete failed')
console.log('✓ delete task')

console.log('\nAll simulations passed.')
