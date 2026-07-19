import { Link } from 'react-router-dom'

/**
 * FlowBoard mark + wordmark — Inter, matches product chrome.
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
    <Link
      to={to}
      className="group flex items-center gap-2 no-underline"
      style={{ color: light ? '#fff' : 'var(--text)' }}
    >
      <span
        className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg"
        style={{ background: 'var(--accent)' }}
      >
        <svg viewBox="0 0 32 32" className="h-[1.1rem] w-[1.1rem]" aria-hidden>
          <rect x="5" y="6" width="6" height="20" rx="1.5" fill="#e0f2fe" />
          <rect x="13" y="6" width="6" height="14" rx="1.5" fill="#bae6fd" />
          <rect x="21" y="6" width="5" height="10" rx="1.5" fill="#7dd3fc" />
        </svg>
      </span>
      {!compact ? (
        <span
          className="text-[1.05rem] font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-body)', color: 'inherit' }}
        >
          FlowBoard
        </span>
      ) : null}
      <span className="sr-only">FlowBoard home</span>
    </Link>
  )
}
