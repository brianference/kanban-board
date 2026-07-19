import { Link } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'

export function HomePage() {
  return (
    <Shell>
      <Seo
        title="FlowBoard — Project kanban for makers and teams"
        description="Register, track projects on modern boards, search tasks, and keep work organized with secure accounts."
        path="/"
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700">
              v3 · Full-stack release
            </p>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
              Track projects without the noise
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-500">
              FlowBoard is a clean kanban workspace with accounts, search, task detail pages, and
              cloud save on SQLite — built to feel fast on mobile and clear on desktop.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-primary">
                Start free
              </Link>
              <Link to="/about" className="btn">
                About us
              </Link>
            </div>
            <ul className="grid gap-3 pt-2 text-sm text-ink-700 sm:grid-cols-2">
              <li className="card !p-4">✓ Secure register &amp; login (JWT)</li>
              <li className="card !p-4">✓ Multi-project boards</li>
              <li className="card !p-4">✓ Global task search</li>
              <li className="card !p-4">✓ Mobile-first layout</li>
            </ul>
          </div>
          <div className="relative">
            <img
              src="/og-cover.svg"
              alt="FlowBoard board preview illustration"
              width={1200}
              height={630}
              className="h-auto w-full rounded-3xl border border-slate-200 shadow-lift"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </section>
    </Shell>
  )
}
