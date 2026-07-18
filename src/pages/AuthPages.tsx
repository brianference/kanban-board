import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { TopBar } from '../components/layout/TopBar'
import { useToast } from '../hooks/useToast'

/**
 * Registration with email + password.
 */
export function RegisterPage() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const { push } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.register({ email, password, name })
      setUser(res.user)
      push('Account created', 'success')
      nav(`/app/projects/${res.projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar title="Create account" />
      <main className="page page-narrow">
        <form className="card-panel stack" onSubmit={(e) => void onSubmit(e)}>
          <h2 style={{ margin: 0 }}>Start free</h2>
          <p className="muted" style={{ margin: 0 }}>
            Email + password. No email provider required. Your first project is created automatically.
          </p>
          <div className="field">
            <label htmlFor="reg-name">Name</label>
            <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="reg-pass">Password (min 8)</label>
            <input
              id="reg-pass"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="muted">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  )
}

/**
 * Login page.
 */
export function LoginPage() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const { push } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.login({ email, password })
      setUser(res.user)
      push('Signed in', 'success')
      nav('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar title="Sign in" />
      <main className="page page-narrow">
        <form className="card-panel stack" onSubmit={(e) => void onSubmit(e)}>
          <h2 style={{ margin: 0 }}>Welcome back</h2>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
