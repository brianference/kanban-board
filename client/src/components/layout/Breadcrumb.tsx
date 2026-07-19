import { Link } from 'react-router-dom'

export type Crumb = { label: string; to?: string }

/**
 * Accessible breadcrumb for app pages (no overflow on mobile).
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 overflow-x-auto">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-ink-500">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <span className="px-1 text-ink-300">/</span> : null}
              {item.to && !last ? (
                <Link to={item.to} className="truncate font-medium text-brand-700 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-semibold text-ink-900" aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
