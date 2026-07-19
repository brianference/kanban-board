import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type SearchResult } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

/**
 * Global header search — type to search immediately; Enter opens full results page.
 */
export function HeaderSearch() {
  const { user } = useAuth()
  const nav = useNavigate()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])

  useEffect(() => {
    if (!user) {
      setResults([])
      return
    }
    const query = q.trim()
    if (query.length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      setBusy(true)
      void api
        .search({ q: query })
        .then((data) => {
          if (!cancelled) {
            setResults(data.results.slice(0, 8))
            setOpen(true)
          }
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [q, user])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    setOpen(false)
    if (!user) {
      nav('/login')
      return
    }
    nav(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
  }

  return (
    <div className="header-search" ref={rootRef}>
      <form onSubmit={onSubmit} role="search" className="header-search-form">
        <label htmlFor="global-search" className="sr-only">
          Search tasks
        </label>
        <span className="header-search-icon" aria-hidden>
          ⌕
        </span>
        <input
          id="global-search"
          type="search"
          className="header-search-input"
          placeholder={user ? 'Search tasks…' : 'Sign in to search'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (q.trim() || results.length) setOpen(true)
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={Boolean(open && user && (results.length > 0 || busy || q.trim()))}
        />
      </form>
      {user && open && q.trim() ? (
        <div className="header-search-panel" id={listId} role="listbox">
          {busy && results.length === 0 ? (
            <p className="header-search-empty">Searching…</p>
          ) : null}
          {!busy && results.length === 0 ? (
            <p className="header-search-empty">No matches — press Enter for full search</p>
          ) : null}
          {results.map((r) => (
            <Link
              key={r.id}
              role="option"
              className="header-search-hit"
              to={`/app/tasks/${r.id}`}
              onClick={() => setOpen(false)}
            >
              <span className="header-search-hit-title">{r.title}</span>
              <span className="header-search-hit-meta">
                {r.projectName}
                {r.columnName ? ` · ${r.columnName}` : ''}
                {r.priority ? ` · ${r.priority}` : ''}
              </span>
            </Link>
          ))}
          <button
            type="button"
            className="header-search-more"
            onClick={() => {
              setOpen(false)
              nav(`/search?q=${encodeURIComponent(q.trim())}`)
            }}
          >
            View all results →
          </button>
        </div>
      ) : null}
    </div>
  )
}
