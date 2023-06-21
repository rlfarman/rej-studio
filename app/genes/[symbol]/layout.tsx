import GeneSearch from '@/components/gene-search'
import genes from '@/public/data/genes.json'

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
      <GeneSearch defaultGene={defaultGene} />
      {children}
    </section>
  )
}
