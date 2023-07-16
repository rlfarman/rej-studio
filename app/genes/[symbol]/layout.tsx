import GeneSearch from '@/components/gene-search'
import genes from '@/public/data/genes.json'
import Link from 'next/link'

interface GenePageLayoutProperties {
  children: React.ReactNode
  params: {
    symbol: string
  }
}

export default function DashboardLayout({
  children,
  params: { symbol },
}: GenePageLayoutProperties) {
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
      <hr className="my-8 h-px border-0 bg-gray-300 dark:bg-gray-700" />
      {children}
    </section>
  )
}
