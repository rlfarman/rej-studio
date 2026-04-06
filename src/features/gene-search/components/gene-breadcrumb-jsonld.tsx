/**
 * BreadcrumbList JSON-LD for richer search snippets on gene pages.
 * See: https://schema.org/BreadcrumbList
 */
export function GeneBreadcrumbJsonLd({
  gene,
}: {
  gene: { symbol: string; name: string }
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Genes',
        item: `${baseUrl}/genes`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${gene.symbol} — ${gene.name}`,
        item: `${baseUrl}/genes/${gene.symbol}`,
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
