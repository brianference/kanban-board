import { Link, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { HeaderSearch } from './HeaderSearch'
import { useAuth } from '../../hooks/useAuth'
import { applyTheme, getInitialTheme, type Theme } from '../../lib/theme'

const publicLinks = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

/**
 * Sticky app chrome — logo, global search, theme toggle, account.
 */
export function Header() {
  const { user, logout, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(getInitialTheme())
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `app-nav-link ${isActive ? 'app-nav-link--active' : ''}`

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Logo />
        <div className="app-header-search-wrap hidden md:block">
          <HeaderSearch />
        </div>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {publicLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <NavLink to="/app" className={linkClass}>
              Dashboard
            </NavLink>
          ) : null}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {!loading && user ? (
            <>
              <span className="hidden max-w-[9rem] truncate text-sm text-[var(--text-muted)] lg:inline">
                {user.name || user.email}
              </span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void logout()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Start free
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={open}
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>
      {open ? (
        <div className="app-header-mobile">
          <div className="mb-3">
            <HeaderSearch />
          </div>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {publicLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <NavLink to="/app" className={linkClass} onClick={() => setOpen(false)}>
                Dashboard
              </NavLink>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              {user ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void logout()
                    setOpen(false)
                  }}
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link to="/login" className="btn" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link to="/register" className="btn btn-primary" onClick={() => setOpen(false)}>
                    Start free
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
