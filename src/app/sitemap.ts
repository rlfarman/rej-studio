import { db } from '@/drizzle/db'
import { genes } from '@/drizzle/schema'
import type { MetadataRoute } from 'next'

/**
 * Auto-generated sitemap from the genes table. Since gene data is read-only
 * and only changes on re-seed, we generate the full list on each build/request
 * and let Next.js cache it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allGenes = await db
    .select({ symbol: genes.symbol, species: genes.species })
    .from(genes)

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    'https://rejstudio.com'

  const geneEntries: MetadataRoute.Sitemap = allGenes.map((gene) => ({
    url: `${baseUrl}/genes/${gene.symbol}?species=${gene.species}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/genes`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // design-tool is disallowed in robots.txt (functional tool, not content)
    ...geneEntries,
  ]
}
