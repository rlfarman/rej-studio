import { connection } from 'next/server'
import { fetchAllGeneSymbols } from '@/features/gene-search/api/gene-queries'
import { isAuthGateActive } from '@/lib/auth/gate'
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

  const staticEntries: MetadataRoute.Sitemap = [
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
    // design-tool is disallowed in robots.txt (functional tool, not content).
    // Docs are hidden for now (src/app/docs/layout.tsx returns 404), so
    // they aren't listed either.
  ]

  // While the site is password-gated, crawlers only ever reach the login
  // page, so listing ~40k gene URLs just invites requests that redirect.
  // This branch touches no database, so the sitemap prerenders as static.
  if (isAuthGateActive()) return staticEntries

  // Render at request time rather than at build: builds (CI included) then
  // need no database, and the gene list comes from the shared remote cache
  // instead of a full table scan per request.
  await connection()
  const allGenes = await fetchAllGeneSymbols()

  const geneEntries: MetadataRoute.Sitemap = allGenes.map((gene) => ({
    url: `${baseUrl}/genes/${gene.symbol}?species=${gene.species}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticEntries, ...geneEntries]
}
