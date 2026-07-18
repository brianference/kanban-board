import { Link, useLocation } from 'react-router-dom'

/**
 * Mobile thumb-zone navigation.
 */
export function BottomNav({ projectId }: { projectId?: string }) {
  const loc = useLocation()
  const onApp = loc.pathname.startsWith('/app')

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <Link to="/app" className={loc.pathname === '/app' ? 'active' : undefined}>
        <span aria-hidden>📁</span>
        Projects
      </Link>
      {projectId ? (
        <Link
          to={`/app/projects/${projectId}`}
          className={loc.pathname.includes('/projects/') ? 'active' : undefined}
        >
          <span aria-hidden>📋</span>
          Board
        </Link>
      ) : (
        <span className={onApp ? undefined : undefined} style={{ opacity: 0.45 }}>
          <span aria-hidden>📋</span>
          Board
        </span>
      )}
      <Link to="/app/new" className={loc.pathname === '/app/new' ? 'active' : undefined}>
        <span aria-hidden>＋</span>
        New
      </Link>
      <Link to="/app/settings" className={loc.pathname === '/app/settings' ? 'active' : undefined}>
        <span aria-hidden>⚙️</span>
        Settings
      </Link>
    </nav>
  )
}
