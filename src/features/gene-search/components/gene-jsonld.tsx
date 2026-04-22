/**
 * BioSchemas Gene JSON-LD for richer search engine results.
 * See: https://bioschemas.org/profiles/Gene
 */
export function GeneJsonLd({
  gene,
  isoformCount,
  species,
}: {
  gene: { id: string; symbol: string; name: string }
  isoformCount: number
  species: string[]
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Gene',
    identifier: gene.id,
    name: gene.symbol,
    alternateName: gene.name,
    url: `${baseUrl}/genes/${gene.symbol}`,
    taxonomicRange: species.map((s) => ({
      '@type': 'Taxon',
      name: s === 'human' ? 'Homo sapiens' : 'Mus musculus',
    })),
    hasRepresentation: {
      '@type': 'PropertyValue',
      name: 'isoformCount',
      value: isoformCount,
    },
    sameAs: `https://www.ensembl.org/id/${gene.id}`,
    isPartOf: {
      '@type': 'Dataset',
      name: 'REJ Studio',
      url: baseUrl,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
