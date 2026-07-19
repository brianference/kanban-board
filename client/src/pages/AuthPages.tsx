import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

export function RegisterPage() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const { push } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <Shell>
      <Seo title="Create account" description="Create a free FlowBoard account." path="/register" noIndex />
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-ink-500">Email + password. Your first project is created automatically.</p>
        <form className="card mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="label" htmlFor="reg-name">
              Name
            </label>
            <input id="reg-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              required
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="reg-pass">
              Password (min 8)
            </label>
            <input
              id="reg-pass"
              type="password"
              required
              minLength={8}
              className="input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="text-sm text-ink-500">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </Shell>
  )
}

export function LoginPage() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const { push } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <Shell>
      <Seo title="Sign in" description="Sign in to FlowBoard." path="/login" noIndex />
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <form className="card mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="login-pass">
              Password
            </label>
            <input
              id="login-pass"
              type="password"
              required
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-sm text-ink-500">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </div>
    </Shell>
  )
}
