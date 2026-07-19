import { Link } from 'react-router-dom'
import { Logo } from './Logo'

/**
 * Footer aligned with header/body surface language (no harsh dark slab).
 */
export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="space-y-3">
          <Logo to="/" />
          <p className="m-0 max-w-xs text-sm leading-relaxed text-[var(--text-muted)]">
            Modern project boards for people who want clarity — tasks, search, and secure accounts
            without the clutter.
          </p>
        </div>
        <div>
          <h3>Product</h3>
          <ul>
            <li>
              <Link to="/register">Get started</Link>
            </li>
            <li>
              <Link to="/search">Search</Link>
            </li>
            <li>
              <Link to="/app">Dashboard</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul>
            <li>
              <Link to="/about">About us</Link>
            </li>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Legal</h3>
          <ul>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms &amp; Conditions</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="app-footer-base">
        <div className="app-footer-base-inner">
          <p className="m-0">© {year} FlowBoard. All rights reserved.</p>
          <p className="m-0">Built for makers and teams.</p>
        </div>
      </div>
    </footer>
  )
}
