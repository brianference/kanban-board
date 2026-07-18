import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { applyTheme, getInitialTheme, type Theme } from '../../lib/theme'
import { useEffect, useState } from 'react'

/**
 * Sticky app chrome with theme + account actions.
 */
export function TopBar({ title = 'Kanban Board' }: { title?: string }) {
  const { user, logout } = useAuth()
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const t = getInitialTheme()
    setTheme(t)
    applyTheme(t)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <header className="topbar">
      <h1>
        <Link to={user ? '/app' : '/'} style={{ color: 'inherit', textDecoration: 'none' }}>
          {title}
        </Link>
      </h1>
      <div className="topbar-actions">
        <button type="button" className="btn btn-icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {user ? (
          <>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {user.name || user.email}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn-ghost" to="/login">
              Sign in
            </Link>
            <Link className="btn btn-primary" to="/register">
              Start free
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
