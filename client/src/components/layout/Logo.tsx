import { Link } from 'react-router-dom'

/**
 * FlowBoard wordmark + mark (inline SVG for speed).
 */
export function Logo({
  to = '/',
  compact = false,
  light = false,
}: {
  to?: string
  compact?: boolean
  light?: boolean
}) {
  return (
    <Link to={to} className="group flex items-center gap-2.5 no-underline">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-brand-600 shadow-soft ring-1 ring-brand-500/30">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <rect x="5" y="6" width="6" height="20" rx="1.5" fill="#e0f2fe" />
          <rect x="13" y="6" width="6" height="14" rx="1.5" fill="#7dd3fc" />
          <rect x="21" y="6" width="5" height="10" rx="1.5" fill="#bae6fd" />
        </svg>
      </span>
      {!compact ? (
        <span
          className={`font-display text-lg font-bold tracking-tight ${
            light ? 'text-white group-hover:text-brand-200' : 'text-ink-900 group-hover:text-brand-700'
          }`}
        >
          FlowBoard
        </span>
      ) : null}
      <span className="sr-only">FlowBoard home</span>
    </Link>
  )
}
