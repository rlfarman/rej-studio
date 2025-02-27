import GeneSearch from '@/search/components/gene-search'
import genes from '@/public/data/genes.json'

interface GeneSymbolPageLayout {
  children: React.ReactNode
  params: Promise<{
    symbol: string
  }>
}

export default async function GeneSymbolPageLayout(props: GeneSymbolPageLayout) {
  const params = await props.params;

  const {
    symbol
  } = params;

  const {
    children
  } = props;

  const defaultGene = (genes as Gene[]).find((gene) => gene.symbol === symbol)
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
