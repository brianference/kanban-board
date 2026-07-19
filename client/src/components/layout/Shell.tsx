import type { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * App shell — one background from header through main to footer.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">{children}</main>
      <Footer />
    </div>
  )
}
