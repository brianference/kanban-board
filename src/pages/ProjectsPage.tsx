import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { ProjectSummary } from '../types/models'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/layout/BottomNav'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { EmptyState } from '../components/ui/EmptyState'

/**
 * Command Center home — metric tiles + compact project list rows.
 */
export function ProjectsPage() {
  const nav = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.listProjects()
        setProjects(data.projects)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      }
    })()
  }, [])

  const metrics = useMemo(() => {
    const list = projects || []
    const owned = list.filter((p) => p.role === 'owner').length
    const shared = list.filter((p) => p.role !== 'owner').length
    const recent = list.filter((p) => Date.now() - p.updatedAt < 7 * 864e5).length
    return [
      { value: String(list.length), label: 'Projects' },
      { value: String(owned), label: 'Owned' },
      { value: String(shared), label: 'Shared' },
      { value: String(recent), label: 'Active 7d' },
    ]
  }, [projects])

  return (
    <div className="app-shell">
      <TopBar title="Projects" />
      <main className="page">
        <div className="board-toolbar" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Command center</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Your projects at a glance
            </p>
          </div>
          <Link className="btn btn-primary" to="/app/new">
            ＋ New project
          </Link>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {!projects ? <LoadingBlock /> : null}

        {projects ? (
          <div className="metrics-grid" aria-label="Project metrics">
            {metrics.map((m) => (
              <div key={m.label} className="metric-tile">
                <b>{m.value}</b>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {projects && projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="Create a project to get a board with optional starter tasks."
            action={
              <Link className="btn btn-primary" to="/app/new">
                Create first project
              </Link>
            }
          />
        ) : null}

        {projects && projects.length > 0 ? (
          <div className="project-list" role="list">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="project-row"
                role="listitem"
                onClick={() => nav(`/app/projects/${p.id}`)}
              >
                <div className="project-row-main">
                  <strong>{p.name}</strong>
                  <span className="project-row-meta">
                    Updated {new Date(p.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="project-row-side">
                  <span className="chip">{p.role}</span>
                  <span className="muted" aria-hidden>
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
