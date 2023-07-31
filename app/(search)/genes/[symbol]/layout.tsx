import GeneSearch from '@/search/components/gene-search'
import genes from '@/public/data/genes.json'

interface GeneSymbolPageLayout {
  children: React.ReactNode
  params: {
    symbol: string
  }
}

export default function GeneSymbolPageLayout({
  children,
  params: { symbol },
}: GeneSymbolPageLayout) {
  const defaultGene = (genes as Gene[]).find((gene) => gene.symbol === symbol)
  return (
    <div>
      <div className="mt-4">
        <GeneSearch defaultGene={defaultGene} />
      </div>
      <hr className="my-8 h-px border-0 bg-neutral-300 dark:bg-neutral-700" />
      {children}
      <p className="mt-8 text-gray-500 dark:text-gray-400">
        Predesigned sequences for isoforms include all relevant codon
        optimizations, as well as stimulatory introns and fragment suppression
        for both 3&apos; and 5&apos; sequences.
      </p>
    </div>
  )
}
