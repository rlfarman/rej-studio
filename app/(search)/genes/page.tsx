import { searchGenes } from '@/actions/genes'
import { GeneSearch } from '@/components/gene-search'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Search Genes | REJ Studio',
  description:
    'Search for genes to optimize with the REJ Studio design tool.',
}

export default function GeneSearchPage() {
  return <GeneSearch searchGenes={searchGenes} />
}
