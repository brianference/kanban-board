/**
 * Simulate N users exercising auth + project + task + comment + search.
 * Default N=100. Reports success rate, latency percentiles, errors.
 */
import { createReporter } from './lib/test-report.mjs'

const BASE = (process.env.API_BASE || 'https://kanban-board-public.pages.dev').replace(/\/$/, '')
const N = Number(process.env.USER_COUNT || 100)
/** Keep low — register rate limit is 15/min/IP; concurrent stampede hits 429. */
const CONCURRENCY = Number(process.env.CONCURRENCY || 3)
const R = createReporter('100-user-sim')

function pickCookie(lines) {
  for (const line of lines || []) {
    const p = line.split(';')[0]
    if (p.startsWith('fb_token=')) return p
  }
  return ''
}

async function api(path, { method = 'GET', body, cookie, formData } = {}) {
  const t0 = Date.now()
  const headers = { Accept: 'application/json', Origin: BASE }
  if (cookie) headers.Cookie = cookie
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
  })
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data, setCookie, ms: Date.now() - t0 }
}

async function oneUser(i) {
  const email = `load-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = 'LoadTestPass123!'
  const steps = []
  try {
    let reg
    for (let attempt = 0; attempt < 4; attempt++) {
      reg = await api('/api/auth/register', {
        method: 'POST',
        body: { email, password, name: `User ${i}` },
      })
      if (reg.status !== 429) break
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
    steps.push({ step: 'register', status: reg.status, ms: reg.ms })
    if (reg.status !== 201) throw new Error(`register ${reg.status}`)
    const cookie = pickCookie(reg.setCookie)
    if (!cookie) throw new Error('no cookie')

    const sess = await api('/api/auth/session', { cookie })
    steps.push({ step: 'session', status: sess.status, ms: sess.ms })
    if (sess.status !== 200) throw new Error('session')

    const projects = await api('/api/projects', { cookie })
    steps.push({ step: 'projects', status: projects.status, ms: projects.ms })
    let projectId = projects.data?.projects?.[0]?.id || reg.data?.projectId
    const detail = await api(`/api/projects/${projectId}`, { cookie })
    steps.push({ step: 'project', status: detail.status, ms: detail.ms })
    const boardId = detail.data?.boards?.[0]?.id
    if (!boardId) throw new Error('no board')

    const board = await api(`/api/boards/${boardId}`, { cookie })
    steps.push({ step: 'board', status: board.status, ms: board.ms })
    const col = board.data?.columns?.[0]?.id
    if (!col) throw new Error('no column')

    const task = await api('/api/tasks', {
      method: 'POST',
      cookie,
      body: {
        boardId,
        columnId: col,
        title: `Load task ${i}`,
        description: 'load test',
        priority: 'medium',
      },
    })
    steps.push({ step: 'createTask', status: task.status, ms: task.ms })
    if (task.status !== 201) throw new Error(`task ${task.status}`)

    const taskId = task.data.taskId
    const cmt = await api(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      cookie,
      body: { body: `Load comment from user ${i} #load` },
    })
    steps.push({ step: 'comment', status: cmt.status, ms: cmt.ms })

    const search = await api(`/api/search?q=Load%20task`, { cookie })
    steps.push({ step: 'search', status: search.status, ms: search.ms })

    const moveCol = board.data.columns[1]?.id || col
    const move = await api(`/api/tasks/${taskId}/move`, {
      method: 'POST',
      cookie,
      body: { columnId: moveCol, position: 0 },
    })
    steps.push({ step: 'move', status: move.status, ms: move.ms })

    return { ok: true, i, steps, totalMs: steps.reduce((a, s) => a + s.ms, 0) }
  } catch (e) {
    return { ok: false, i, error: e instanceof Error ? e.message : String(e), steps }
  }
}

async function mapPool(items, limit, fn) {
  const out = []
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return out
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[i]
}

console.log(`\n▸ 100-user-sim → ${BASE} N=${N} concurrency=${CONCURRENCY}`)

// Warm health burst (scale)
{
  const health = await Promise.all(
    Array.from({ length: 50 }, () =>
      fetch(`${BASE}/api/health`).then(async (r) => ({ status: r.status, ms: 0 })),
    ),
  )
  const okH = health.filter((h) => h.status === 200).length
  R.assert(okH / health.length >= 0.95, 'UAT-097', `health 50 concurrent ${okH}/50`)
}

const t0 = Date.now()
const users = Array.from({ length: N }, (_, i) => i)
const results = await mapPool(users, CONCURRENCY, (i) => oneUser(i))
const duration = Date.now() - t0

const ok = results.filter((r) => r.ok)
const fail = results.filter((r) => !r.ok)
const latencies = ok.map((r) => r.totalMs).sort((a, b) => a - b)

R.assert(ok.length / N >= 0.9, 'UAT-098', `register+journey success ${ok.length}/${N}`)
R.assert(
  ok.filter((r) => r.steps.some((s) => s.step === 'createTask' && s.status === 201)).length / N >=
    0.9,
  'UAT-099',
  `create task success among users`,
)

const stepNames = ['register', 'session', 'board', 'createTask', 'comment', 'search', 'move']
for (const step of stepNames) {
  const samples = ok.flatMap((r) => r.steps.filter((s) => s.step === step).map((s) => s.ms))
  samples.sort((a, b) => a - b)
  if (samples.length) {
    R.learn(
      `${step}: n=${samples.length} p50=${percentile(samples, 50)}ms p95=${percentile(samples, 95)}ms max=${samples[samples.length - 1]}ms`,
    )
  }
}

R.learn(
  `Full journey: success=${ok.length}/${N} (${((ok.length / N) * 100).toFixed(1)}%) wall=${duration}ms p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms concurrency=${CONCURRENCY}`,
)

if (fail.length) {
  const sample = fail.slice(0, 8)
  for (const f of sample) {
    R.fail(`user-${f.i}`, `user journey failed`, f.error || 'unknown', true)
  }
  R.learn(`Failure sample errors: ${[...new Set(fail.map((f) => f.error))].slice(0, 5).join(' | ')}`)
}

// Parallel stress spike
{
  const spikeN = 30
  const spike = await Promise.all(
    Array.from({ length: spikeN }, (_, i) =>
      oneUser(1000 + i).then((r) => r.ok),
    ),
  )
  const spikeOk = spike.filter(Boolean).length
  R.assert(spikeOk / spikeN >= 0.8, 'STRESS-001', `spike ${spikeN} concurrent journeys ${spikeOk}/${spikeN}`)
  R.learn(`Stress spike: ${spikeOk}/${spikeN} concurrent full journeys succeeded`)
}

const summary = R.summary()
console.log(
  `\n100-user-sim: ${summary.passed} pass / ${summary.failed} fail (${summary.durationMs}ms)`,
)
export default summary
