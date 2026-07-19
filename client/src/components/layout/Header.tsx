import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { Logo } from './Logo'
import { useAuth } from '../../hooks/useAuth'

const publicLinks = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/search', label: 'Search' },
]

/**
 * Sticky premium header.
 */
export function Header() {
  const { user, logout, loading } = useAuth()
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-white/80 hover:text-brand-700'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
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
          {!loading && user ? (
            <>
              <span className="max-w-[10rem] truncate text-sm text-ink-500">{user.name || user.email}</span>
              <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
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
        <button
          type="button"
          className="btn md:hidden"
          aria-expanded={open}
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
        >
          ☰
        </button>
      </div>
      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
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
