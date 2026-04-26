import { readManifest } from '@/lib/content/server'
import { source } from '@/lib/source'
import type { MetadataRoute } from 'next'

/**
 * Sitemap from the static gene manifest emitted by scripts/emit-content.ts.
 * No DB round-trip — the file is on disk after `pnpm content:emit`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifest = await readManifest()

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

  const geneEntries: MetadataRoute.Sitemap = manifest.genes.map((gene) => ({
    url: `${baseUrl}/genes/${gene.symbol}?species=${gene.species}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const docEntries: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    changeFrequency: 'monthly',
    priority: 0.6,
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
    ...docEntries,
    ...geneEntries,
  ]
}
