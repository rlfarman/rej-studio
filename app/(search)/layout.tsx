import GeneSearch from './_components/gene-search'
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
        Search for a sequence by gene or Ensemble Transcript ID (ENST), or{' '}
        <Link
          href="/design-tool"
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          provide your own
        </Link>
      </p>
      <GeneSearch defaultGene={defaultGene} />
      {children}
    </section>
  )
}
