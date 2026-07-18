import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { ProjectSummary } from '../types/models'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/layout/BottomNav'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { EmptyState } from '../components/ui/EmptyState'
/**
 * Authenticated project list home.
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

  return (
    <div className="app-shell">
      <TopBar title="Your projects" />
      <main className="page">
        <div className="board-toolbar" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Projects</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Cloud-saved on Cloudflare D1
            </p>
          </div>
          <Link className="btn btn-primary" to="/app/new">
            ＋ New project
          </Link>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {!projects ? <LoadingBlock /> : null}
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
          <div className="project-grid">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="project-card"
                onClick={() => nav(`/app/projects/${p.id}`)}
              >
                <h3>{p.name}</h3>
                <span className="chip">{p.role}</span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Updated {new Date(p.updatedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
