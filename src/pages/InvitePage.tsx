import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { TopBar } from '../components/layout/TopBar'
import { useToast } from '../hooks/useToast'

/**
 * Accept a share invite while signed in.
 */
export function InvitePage() {
  const { token = '' } = useParams()
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const { push } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.acceptInvite(token)
      push('Joined project', 'success')
      nav(`/app/projects/${res.projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accept failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar title="Project invite" />
      <main className="page page-narrow">
        <div className="card-panel stack">
          <h2 style={{ margin: 0 }}>You&apos;re invited</h2>
          {loading ? <p className="muted">Checking session…</p> : null}
          {!loading && !user ? (
            <>
              <p className="muted">Sign in with the invited email to join this project.</p>
              <Link className="btn btn-primary" to={`/login?next=/invite/${token}`}>
                Sign in to accept
              </Link>
              <Link className="btn" to={`/register?next=/invite/${token}`}>
                Create account
              </Link>
            </>
          ) : null}
          {!loading && user ? (
            <>
              <p className="muted">
                Signed in as {user.email}. Accept to join the shared project.
              </p>
              {error ? <p className="error-text">{error}</p> : null}
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void accept()}>
                {busy ? 'Joining…' : 'Accept invite'}
              </button>
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
