import { searchGenes } from '@/actions'
import { GeneSearch } from '@/components/gene-search'

export default function GeneSearchPage() {
  return <GeneSearch searchGenes={searchGenes} />
}
