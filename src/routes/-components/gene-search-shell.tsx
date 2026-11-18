import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { useJobSearchItems } from './job-search-items'

interface GeneSearchShellProps {
  defaultQuery?: string
}

/** The home page's inline search. */
export function GeneSearchShell(props: GeneSearchShellProps) {
  const { jobs, onSelectJob } = useJobSearchItems()
  return <GeneSearch {...props} jobs={jobs} onSelectJob={onSelectJob} />
}
