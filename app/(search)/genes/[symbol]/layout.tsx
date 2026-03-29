import type { Metadata } from 'next'
import GeneSearch from '@/search/components/gene-search'
import { findGeneBySymbol } from '@/lib/genes'

interface GeneSymbolPageLayout {
  children: React.ReactNode
  params: Promise<{
    symbol: string
  }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>
}): Promise<Metadata> {
  const { symbol } = await params
  const gene = findGeneBySymbol(symbol)
  if (!gene) return { title: 'Gene Not Found' }
  return {
    title: `${gene.symbol} – ${gene.name}`,
    description: `Explore isoforms and design RNA end-joining sequences for ${gene.symbol} (${gene.name}) on chromosome ${gene.chromosome}.`,
  }
}

export default async function GeneSymbolPageLayout({
  children,
  params,
}: GeneSymbolPageLayout) {
  const { symbol } = await params
  const defaultGene = findGeneBySymbol(symbol)
  return (
    <div>
      <div className="mt-4">
        <GeneSearch defaultGene={defaultGene} />
      </div>
      <hr className="my-8 h-px border-0 bg-neutral-300 dark:bg-neutral-700" />
      {children}
      <p className="mt-8 text-neutral-500 dark:text-neutral-400">
        Predesigned sequences for isoforms include all relevant codon
        optimizations, as well as stimulatory introns and fragment suppression
        for both 3&apos; and 5&apos; sequences.
      </p>
    </div>
  )
}
