import { Helmet } from 'react-helmet-async'

/**
 * Per-page SEO tags.
 */
export function Seo({
  title,
  description,
  path = '/',
  noIndex = false,
}: {
  title: string
  description: string
  path?: string
  noIndex?: boolean
}) {
  const full = title.includes('FlowBoard') ? title : `${title} | FlowBoard`
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}${path}`
  return (
    <Helmet>
      <title>{full}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex ? <meta name="robots" content="noindex,nofollow" /> : <meta name="robots" content="index,follow" />}
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${origin}/og-cover.svg`} />
      <meta name="twitter:title" content={full} />
      <meta name="twitter:description" content={description} />
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'FlowBoard',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description,
          url,
        })}
      </script>
    </Helmet>
  )
}
