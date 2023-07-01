import GeneSearch from '@/components/gene-search'
import genes from '@/public/data/genes.json'
import Link from 'next/link'

interface GeneSearchLayoutProperties {
  children: React.ReactNode
  params: {
    symbol: string
  }
}

export default function GeneSearchLayout({
  children,
  params: { symbol },
}: GeneSearchLayoutProperties) {
  const defaultGene = (genes as Gene[]).find((gene) => gene.symbol === symbol)
  return (
    <section className="w-full">
      <p>
        Search for a gene by name or symbol, or{' '}
        <Link
          href="/design-tool"
          className="font-medium underline decoration-gray-400"
        >
          design your own
        </Link>
      </p>
      <GeneSearch defaultGene={defaultGene} />
      {children}
    </section>
  )
}
