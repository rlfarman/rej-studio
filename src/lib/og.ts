/**
 * Builds an OG image URL for the `/api/og` endpoint.
 *
 * Centralizes query-string encoding so page metadata doesn't contain
 * hand-encoded URL strings.
 */
export function ogImageUrl(params: {
  title: string
  description?: string
  section?: string
  url?: string
}): string {
  const qs = new URLSearchParams()
  qs.set('title', params.title)
  if (params.description) qs.set('description', params.description)
  if (params.section) qs.set('section', params.section)
  if (params.url) qs.set('url', params.url)
  return `/api/og?${qs.toString()}`
}
