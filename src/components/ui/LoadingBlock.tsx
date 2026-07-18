/**
 * Skeleton loading block.
 */
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ minHeight: i === 0 ? 48 : 80 }} />
      ))}
    </div>
  )
}
