import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { api, type SearchResult } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export function SearchPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [priority, setPriority] = useState(params.get('priority') || '')
  const [due, setDue] = useState(params.get('due') || '')
  const [projectId] = useState(params.get('projectId') || '')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function runSearch(next?: Record<string, string>) {
    if (!user) {
      setResults([])
      return
    }
    setBusy(true)
    setError(null)
    const query = {
      q: next?.q ?? q,
      priority: next?.priority ?? priority,
      due: next?.due ?? due,
      projectId: next?.projectId ?? projectId,
    }
    Object.keys(query).forEach((k) => {
      if (!query[k as keyof typeof query]) delete query[k as keyof typeof query]
    })
    try {
      const data = await api.search(query)
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (user) void runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (priority) sp.set('priority', priority)
    if (due) sp.set('due', due)
    if (projectId) sp.set('projectId', projectId)
    setParams(sp)
    void runSearch()
  }

  return (
    <Shell>
      <Seo
        title="Search tasks"
        description="Search FlowBoard tasks by keyword, priority, due date, and project."
        path="/search"
        noIndex={!user}
      />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: user ? '/app' : undefined },
            { label: 'Search' },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Search tasks</h1>
            <p className="mt-2 text-ink-500">
              Search by title, description, tags, priority, and due date.
            </p>
          </div>
          {user ? (
            <div className="flex flex-wrap gap-2">
              {projectId ? (
                <Link to={`/app/projects/${projectId}`} className="btn btn-sm">
                  ← Back to board
                </Link>
              ) : null}
              <Link to="/app" className="btn btn-sm">
                Dashboard
              </Link>
            </div>
          ) : null}
        </div>

        {!user ? (
          <div className="card mt-8">
            <p className="text-ink-700">Sign in to search your projects.</p>
            <Link to="/login" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <form className="card mt-8 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="q">
                  Keywords
                </label>
                <input
                  id="q"
                  className="input"
                  placeholder="login bug, redesign…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="pri">
                  Priority
                </label>
                <select id="pri" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="">Any</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="due">
                  Due
                </label>
                <select id="due" className="input" value={due} onChange={(e) => setDue(e.target.value)}>
                  <option value="">Any</option>
                  <option value="overdue">Overdue</option>
                  <option value="week">This week</option>
                  <option value="none">No due date</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>

            {error ? <p className="mt-6 text-red-600">{error}</p> : null}
            {results ? (
              <div className="mt-8">
                <p className="mb-4 text-sm font-semibold text-ink-500">{results.length} results</p>
                <ul className="space-y-3">
                  {results.map((r) => (
                    <li key={r.id}>
                      <Link
                        to={`/app/tasks/${r.id}`}
                        className="card block !py-4 transition hover:border-brand-300 hover:shadow-lift"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="truncate font-display text-lg font-bold text-ink-900">
                              {r.title}
                            </h2>
                            <p className="mt-1 text-sm text-ink-500">
                              {r.projectName} · {r.boardName} · {r.columnName}
                            </p>
                            {r.description ? (
                              <p className="mt-2 line-clamp-2 text-sm text-ink-700">{r.description}</p>
                            ) : null}
                          </div>
                          <span className="chip">{r.priority}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Shell>
  )
}
