import { Link } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'

/**
 * Marketing shell — Design A Command Center aesthetic.
 */
export function LandingPage() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="landing">
        <section className="hero">
          <h1>Track projects without the noise</h1>
          <p>
            Create an account, own your boards, and save every task in the cloud. Built for people —
            not someone else&apos;s agent backlog.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/register">
              Start free — no card
            </Link>
            <Link className="btn" to="/login">
              Sign in
            </Link>
          </div>
          <div className="hero-metrics" aria-hidden="true">
            <div className="metric-tile">
              <b>∞</b>
              <span>Projects</span>
            </div>
            <div className="metric-tile">
              <b>D1</b>
              <span>Cloud save</span>
            </div>
            <div className="metric-tile">
              <b>5</b>
              <span>Board columns</span>
            </div>
            <div className="metric-tile">
              <b>0</b>
              <span>Setup fee</span>
            </div>
          </div>
        </section>
        <div className="feature-grid">
          <article className="feature">
            <h3>Command center home</h3>
            <p className="muted">Metric tiles plus compact project rows — scan status in one glance.</p>
          </article>
          <article className="feature">
            <h3>Cloud save on D1</h3>
            <p className="muted">Tasks persist on Cloudflare D1 — not trapped in one browser.</p>
          </article>
          <article className="feature">
            <h3>Mobile-first board</h3>
            <p className="muted">Column tabs, thumb nav, and move-to-column without drag fights.</p>
          </article>
          <article className="feature">
            <h3>Share invites</h3>
            <p className="muted">Invite teammates by email with member or viewer roles.</p>
          </article>
        </div>
      </main>
    </div>
  )
}
