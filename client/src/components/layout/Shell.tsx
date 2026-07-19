import type { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Public page shell: sticky header + main + footer.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
