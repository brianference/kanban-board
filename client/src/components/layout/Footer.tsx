import { Link } from 'react-router-dom'
import { Logo } from './Logo'

/**
 * Organized professional footer.
 */
export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-slate-200 bg-ink-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1 space-y-4">
          <Logo to="/" light />
          <p className="text-sm leading-relaxed text-slate-400">
            Modern project boards for people who want clarity — tasks, search, and secure accounts
            without the clutter.
          </p>
        </div>
        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-white">
            Product
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link className="hover:text-white" to="/register">
                Get started
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/search">
                Search
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/app">
                Dashboard
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-white">
            Company
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link className="hover:text-white" to="/about">
                About us
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/contact">
                Contact
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-white">
            Legal
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link className="hover:text-white" to="/privacy">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/terms">
                Terms &amp; Conditions
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} FlowBoard. All rights reserved.</p>
          <p>Built for makers and teams.</p>
        </div>
      </div>
    </footer>
  )
}
