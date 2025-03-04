import GeneSearch from '@/search/components/gene-search'
import genes from '@/public/data/genes.json'

interface GeneSymbolPageLayout {
  children: React.ReactNode
  params: Promise<{
    symbol: string
  }>
}

export default async function GeneSymbolPageLayout(
  props: GeneSymbolPageLayout
) {
  const params = await props.params

  const { symbol } = params

  const { children } = props

  return <div>{children}</div>
}
