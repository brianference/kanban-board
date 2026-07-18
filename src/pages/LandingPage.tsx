import { Link } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'

/**
 * Marketing shell for strangers before signup.
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
            <a className="btn btn-ghost" href="/mockups/mobile-variations.html" target="_blank" rel="noreferrer">
              View mobile mockups
            </a>
          </div>
        </section>
        <div className="feature-grid">
          <article className="feature">
            <h3>Your projects</h3>
            <p className="muted">Many boards under one account. Switch in one tap.</p>
          </article>
          <article className="feature">
            <h3>Cloud save on D1</h3>
            <p className="muted">Tasks persist on Cloudflare D1 — not trapped in one browser.</p>
          </article>
          <article className="feature">
            <h3>Mobile-first</h3>
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
