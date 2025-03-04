import { searchGenes } from '@/actions'
import GeneSearch from '@/search/components/gene-search'

export default function GeneSearchPage() {
  return <GeneSearch searchGenes={searchGenes} />
}
