import { useEffect, useState } from 'react'

/**
 * Load private /api/attachments/* images with credentials, then show as blob URL.
 * Plain <img src="/api/..."> can fail when the response is JSON error or cookie edge-cases.
 */
export function AuthImage({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)

    async function load() {
      try {
        const res = await fetch(src, {
          credentials: 'include',
          headers: { Accept: 'image/*,application/octet-stream' },
        })
        if (!res.ok) {
          if (!cancelled) setFailed(true)
          return
        }
        const ct = res.headers.get('Content-Type') || ''
        if (ct.includes('application/json') || ct.includes('text/html')) {
          if (!cancelled) setFailed(true)
          return
        }
        const blob = await res.blob()
        if (blob.size === 0) {
          if (!cancelled) setFailed(true)
          return
        }
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setUrl(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface-2)] text-center text-[10px] text-[var(--text-muted)] ${className || ''}`}
        style={{ width, height }}
        title={alt}
      >
        Missing
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={`animate-pulse bg-[var(--surface-2)] ${className || ''}`}
        style={{ width, height }}
        aria-hidden
      />
    )
  }

  return <img src={url} alt={alt} className={className} width={width} height={height} />
}
