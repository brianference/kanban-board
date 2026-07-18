import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { TemplateId } from '../types/models'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/layout/BottomNav'
import { useToast } from '../hooks/useToast'

const TEMPLATES: { id: TemplateId; label: string; blurb: string }[] = [
  { id: 'blank', label: 'Blank', blurb: 'One welcome card only' },
  { id: 'personal', label: 'Personal weekly', blurb: 'Plan / focus / admin' },
  { id: 'side-project', label: 'Side project', blurb: 'MVP / ship loop' },
  { id: 'bugs', label: 'Bug triage', blurb: 'Fixing / testing columns' },
]

/**
 * Create project with template picker (empty-friendly starters).
 */
export function NewProjectPage() {
  const nav = useNavigate()
  const { push } = useToast()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<TemplateId>('personal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.createProject({ name, template })
      push('Project created', 'success')
      nav(`/app/projects/${res.projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar title="New project" />
      <main className="page page-narrow">
        <form className="card-panel stack" onSubmit={(e) => void onSubmit(e)}>
          <h2 style={{ margin: 0 }}>Create project</h2>
          <div className="field">
            <label htmlFor="proj-name">What is this for?</label>
            <input
              id="proj-name"
              required
              maxLength={120}
              placeholder="Website redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              Starter template
            </p>
            <div className="template-grid">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`template-option ${template === t.id ? 'selected' : ''}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <strong>{t.label}</strong>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {t.blurb}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create board'}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  )
}
