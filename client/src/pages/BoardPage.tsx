import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { api, type BoardPayload, type Task } from '../lib/api'
import { useToast } from '../hooks/useToast'

export function BoardPage() {
  const { projectId = '' } = useParams()
  const nav = useNavigate()
  const { push } = useToast()
  const [payload, setPayload] = useState<BoardPayload | null>(null)
  const [projectName, setProjectName] = useState('Project')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [priority, setPriority] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const detail = await api.getProject(projectId)
      setProjectName(detail.project.name)
      const boardId = detail.boards[0]?.id
      if (!boardId) {
        setError('No board found')
        return
      }
      const board = await api.getBoard(boardId)
      setPayload(board)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!payload) return []
    const query = q.trim().toLowerCase()
    return payload.tasks.filter((t) => {
      if (priority && t.priority !== priority) return false
      if (!query) return true
      return `${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase().includes(query)
    })
  }, [payload, q, priority])

  const byCol = useMemo(() => {
    const map = new Map<string, Task[]>()
    if (!payload) return map
    for (const c of payload.columns) map.set(c.id, [])
    for (const t of filtered) {
      const list = map.get(t.columnId) || []
      list.push(t)
      map.set(t.columnId, list)
    }
    return map
  }, [payload, filtered])

  async function onDrop(columnId: string, e: DragEvent) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain') || dragId
    if (!taskId || !payload) return
    const list = (byCol.get(columnId) || []).filter((t) => t.id !== taskId)
    const position = list.length ? list[list.length - 1]!.position + 1 : 0
    try {
      await api.moveTask(taskId, columnId, position)
      push('Board saved', 'success')
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Move failed', 'error')
    } finally {
      setDragId(null)
    }
  }

  return (
    <Shell>
      <Seo title={projectName} description={`Board for ${projectName}`} path={`/app/projects/${projectId}`} noIndex />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/app' },
            { label: projectName },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{projectName}</h1>
            <p className="mt-1 text-ink-500">
              {payload ? `${filtered.length} / ${payload.tasks.length} tasks shown` : 'Loading board…'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/search?projectId=${projectId}`} className="btn">
              Search
            </Link>
            <Link to="/app" className="btn">
              All projects
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <input
            className="input max-w-md flex-1"
            placeholder="Filter this board…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter board"
          />
          <select className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {error ? <p className="mt-6 font-medium text-red-600">{error}</p> : null}
        {loading ? <p className="mt-10 text-center text-ink-500">Loading board…</p> : null}

        {payload ? (
          <div className="mt-6 flex gap-4 overflow-x-auto pb-6">
            {payload.columns.map((col) => {
              const tasks = byCol.get(col.id) || []
              return (
                <section
                  key={col.id}
                  className="flex w-[min(300px,85vw)] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white/90 shadow-soft"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void onDrop(col.id, e)}
                >
                  <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h2 className="font-display text-sm font-bold">{col.name}</h2>
                    <span className="text-xs font-semibold text-ink-500">{tasks.length}</span>
                  </header>
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {tasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-10 text-center text-sm text-ink-500">
                        Drop cards here
                      </div>
                    ) : (
                      tasks.map((task) => (
                        <article
                          key={task.id}
                          draggable={payload.role !== 'viewer'}
                          onDragStart={(e) => {
                            setDragId(task.id)
                            e.dataTransfer.setData('text/plain', task.id)
                          }}
                          onDragEnd={() => setDragId(null)}
                          className={`cursor-grab rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-brand-300 hover:shadow-lift ${
                            dragId === task.id ? 'opacity-40' : ''
                          }`}
                          onClick={() => nav(`/app/tasks/${task.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') nav(`/app/tasks/${task.id}`)
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <h3 className="font-semibold text-ink-900">{task.title}</h3>
                          {task.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-ink-500">{task.description}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="chip">{task.priority}</span>
                            {task.dueAt ? (
                              <span className="chip">📅 {new Date(task.dueAt).toLocaleDateString()}</span>
                            ) : null}
                            {(task.attachments?.length || 0) > 0 ? (
                              <span className="chip">📎 {task.attachments!.length}</span>
                            ) : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : null}
      </div>
    </Shell>
  )
}
