import type { MetadataRoute } from 'next'
import { getAllGenes } from '@/lib/genes'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const genes = getAllGenes()

  const genePages = genes.map((gene) => ({
    url: `${baseUrl}/genes/${gene.symbol}`,
    lastModified: new Date(),
  }))

  return [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/genes`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/design-tool`,
      lastModified: new Date(),
    },
    ...genePages,
  ]
}
