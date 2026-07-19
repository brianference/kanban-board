import { Link } from 'react-router-dom'

export type Crumb = { label: string; to?: string }

/**
 * Compact breadcrumb — theme tokens, matches board workspace chrome.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="board-crumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <span className="px-0.5 opacity-50">/</span> : null}
              {item.to && !last ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
