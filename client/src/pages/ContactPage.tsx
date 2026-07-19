import { FormEvent, useState } from 'react'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'
import { api } from '../lib/api'
import { useToast } from '../hooks/useToast'

export function ContactPage() {
  const { push } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.contact({ name, email, subject, message })
      push(res.message, 'success')
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <Seo
        title="Contact us"
        description="Contact FlowBoard support or send product feedback."
        path="/contact"
      />
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight">Contact us</h1>
        <p className="mt-2 text-ink-500">We read every message. Typical reply within a few days.</p>
        <form className="card mt-8 space-y-5" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="label" htmlFor="c-name">
              Name
            </label>
            <input id="c-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="c-email">
              Email
            </label>
            <input
              id="c-email"
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="c-subject">
              Subject
            </label>
            <input
              id="c-subject"
              className="input"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="c-msg">
              Message
            </label>
            <textarea
              id="c-msg"
              className="input min-h-[140px]"
              required
              minLength={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy}>
            {busy ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </Shell>
  )
}
