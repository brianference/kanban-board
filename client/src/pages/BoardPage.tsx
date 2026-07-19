import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { TaskCard } from '../components/board/TaskCard'
import { api, type BoardPayload, type Task } from '../lib/api'
import { useToast } from '../hooks/useToast'

/**
 * Project board — unified workspace chrome with legacy-style cards.
 */
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
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [mobileColId, setMobileColId] = useState<string | null>(null)

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
      setMobileColId((prev) => prev || board.columns[0]?.id || null)
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
    setOverColumnId(null)
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

  const canWrite = payload ? payload.role !== 'viewer' : false
  const colCount = payload?.columns.length || 5

  return (
    <Shell>
      <Seo
        title={projectName}
        description={`Board for ${projectName}`}
        path={`/app/projects/${projectId}`}
        noIndex
      />
      <div className="board-page">
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/app' },
            { label: projectName },
          ]}
        />

        <div className="board-workspace">
          <div className="board-toolbar">
            <div>
              <h1>{projectName}</h1>
              <p className="meta">
                {payload
                  ? `${filtered.length} / ${payload.tasks.length} tasks · ${
                      canWrite ? 'drag to move · auto-saves' : 'view only'
                    }`
                  : 'Loading board…'}
              </p>
            </div>
            <div className="board-toolbar-actions">
              <Link to="/app" className="btn btn-sm">
                All projects
              </Link>
            </div>
          </div>

          <div className="board-filters">
            <input
              className="input"
              placeholder="Filter this board…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Filter board"
            />
            <select
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label="Priority"
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {error ? (
            <p className="px-5 py-4 font-medium text-red-600">{error}</p>
          ) : null}
          {loading ? (
            <p className="px-5 py-12 text-center text-[var(--text-muted)]">Loading board…</p>
          ) : null}

          {payload ? (
            <>
              <div className="board-mobile-tabs lg:hidden" role="tablist" aria-label="Jump to column">
                {payload.columns.map((col) => {
                  const count = (byCol.get(col.id) || []).length
                  const active = mobileColId === col.id
                  return (
                    <button
                      key={col.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`mobile-col-tab ${active ? 'mobile-col-tab--active' : ''}`}
                      onClick={() => setMobileColId(col.id)}
                    >
                      {col.name} <span className="opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>

              <div className="board-columns-wrap">
                <div
                  className="board-columns"
                  style={{ ['--board-cols' as string]: String(colCount) }}
                  data-dragging={dragId ? 'true' : 'false'}
                >
                  {payload.columns.map((col) => {
                    const tasks = byCol.get(col.id) || []
                    const isTarget = overColumnId === col.id && Boolean(dragId)
                    const hideOnMobile = mobileColId !== null && mobileColId !== col.id
                    return (
                      <section
                        key={col.id}
                        className={[
                          'board-column',
                          isTarget ? 'board-column--drop' : '',
                          hideOnMobile ? 'board-column--mobile-hide' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onDragEnter={(e) => {
                          e.preventDefault()
                          if (dragId) setOverColumnId(col.id)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (dragId) setOverColumnId(col.id)
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setOverColumnId((id) => (id === col.id ? null : id))
                          }
                        }}
                        onDrop={(e) => void onDrop(col.id, e)}
                        aria-label={col.name}
                      >
                        <header className="board-column-header">
                          <h2 className="board-column-title">
                            <span
                              className={`board-column-dot board-column-dot--${col.key || 'default'}`}
                              aria-hidden
                            />
                            {col.name}
                          </h2>
                          <span className="board-column-count">{tasks.length}</span>
                        </header>
                        <div className="board-column-body">
                          {tasks.length === 0 ? (
                            <div
                              className={`board-column-empty ${isTarget ? 'board-column-empty--active' : ''}`}
                            >
                              {canWrite
                                ? isTarget
                                  ? 'Release to drop'
                                  : 'Drop cards here'
                                : 'No tasks'}
                            </div>
                          ) : (
                            tasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                columnKey={col.key}
                                onOpen={(t) => nav(`/app/tasks/${t.id}`)}
                                draggable={canWrite}
                                isDragging={dragId === task.id}
                                onDragStart={(t, e) => {
                                  setDragId(t.id)
                                  e.dataTransfer.setData('text/plain', t.id)
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragEnd={() => {
                                  setDragId(null)
                                  setOverColumnId(null)
                                }}
                              />
                            ))
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Shell>
  )
}
