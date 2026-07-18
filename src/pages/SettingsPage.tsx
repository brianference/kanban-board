import { useAuth } from '../hooks/useAuth'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/layout/BottomNav'
import { applyTheme, getInitialTheme, type Theme } from '../lib/theme'
import { useState } from 'react'

/**
 * Account + theme settings.
 */
export function SettingsPage() {
  const { user, logout } = useAuth()
  const [theme, setTheme] = useState<Theme>(getInitialTheme())

  function setT(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="app-shell">
      <TopBar title="Settings" />
      <main className="page page-narrow">
        <div className="card-panel stack">
          <h2 style={{ margin: 0 }}>Account</h2>
          <p style={{ margin: 0 }}>
            <strong>{user?.name}</strong>
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {user?.email}
          </p>
          <h3 style={{ marginBottom: 0 }}>Theme</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn ${theme === 'light' ? 'btn-primary' : ''}`}
              onClick={() => setT('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={`btn ${theme === 'dark' ? 'btn-primary' : ''}`}
              onClick={() => setT('dark')}
            >
              Dark
            </button>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
