import { Link } from 'react-router-dom'
import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'

export function AboutPage() {
  return (
    <Shell>
      <Seo
        title="About us"
        description="Learn about FlowBoard — a modern project kanban built for clarity, privacy, and mobile-friendly work tracking."
        path="/about"
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'About us' }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          About FlowBoard
        </h1>
        <div className="prose-legal mt-6">
          <p>
            FlowBoard helps individuals and small teams organize work on visual boards. We focus on
            a calm interface, secure accounts, and features that matter day to day — search, due
            dates, comments, and clear ownership.
          </p>
          <h2>Our principles</h2>
          <ul>
            <li>Clarity over clutter</li>
            <li>Your data stays in your account</li>
            <li>Mobile should feel first-class</li>
            <li>Simple legal pages in plain language</li>
          </ul>
          <h2>Who we are</h2>
          <p>
            FlowBoard is operated by the FlowBoard product team. For questions, reach out on our{' '}
            <Link className="font-semibold text-brand-700" to="/contact">
              Contact
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
    </Shell>
  )
}
