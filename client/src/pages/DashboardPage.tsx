import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { api } from '../lib/api'
import { useToast } from '../hooks/useToast'

type Project = {
  id: string
  name: string
  role: string
  updatedAt: number
}

export function DashboardPage() {
  const nav = useNavigate()
  const { push } = useToast()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('personal')
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    try {
      const data = await api.listProjects()
      setProjects(data.projects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api.createProject({ name, template })
      push('Project created', 'success')
      nav(`/app/projects/${res.projectId}`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Create failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteId) return
    setBusy(true)
    try {
      await api.deleteProject(deleteId)
      push('Project deleted', 'success')
      setDeleteId(null)
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Delete failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <Seo title="Dashboard" description="Your FlowBoard projects." path="/app" noIndex />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Your projects</h1>
            <p className="mt-1 text-ink-500">Cloud-saved on SQLite · secure JWT session</p>
          </div>
          <Link to="/search" className="btn">
            Search tasks
          </Link>
        </div>

        <form className="card mt-8 grid gap-4 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => void create(e)}>
          <div>
            <label className="label" htmlFor="proj-name">
              New project name
            </label>
            <input
              id="proj-name"
              className="input"
              required
              maxLength={120}
              placeholder="Website redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="tpl">
              Template
            </label>
            <select id="tpl" className="input" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="blank">Blank</option>
              <option value="personal">Personal weekly</option>
              <option value="side-project">Side project</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>

        {error ? <p className="mt-6 text-red-600">{error}</p> : null}
        {!projects ? (
          <p className="mt-10 text-center text-ink-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="card mt-10 text-center">
            <h2 className="font-display text-xl font-bold">No projects yet</h2>
            <p className="mt-2 text-ink-500">Create your first board above.</p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3">
            {projects.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-4 !py-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => nav(`/app/projects/${p.id}`)}
                >
                  <p className="truncate font-display text-lg font-bold text-ink-900">{p.name}</p>
                  <p className="text-sm text-ink-500">
                    {p.role} · Updated {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={() => nav(`/app/projects/${p.id}`)}>
                    Open
                  </button>
                  {p.role === 'owner' ? (
                    <button type="button" className="btn btn-danger" onClick={() => setDeleteId(p.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this project?"
        message="This permanently removes the project, boards, and tasks. This cannot be undone."
        busy={busy}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Shell>
  )
}
