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
      <GeneSearch defaultGene={defaultGene} />
      <hr className="my-8 h-px border-0 bg-neutral-300 dark:bg-neutral-700" />
      {children}
    </div>
  )
}
