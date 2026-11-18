import { GeneSearchTrigger } from '@/features/gene-search/components/gene-search-trigger'

import { useJobSearchItems } from './job-search-items'

/**
 * The header's search: a button that loads the palette on demand. Kept apart
 * from GeneSearchShell (the home page's inline search), which imports the
 * whole palette, so the header does not pull it into every page.
 */
export function HeaderSearch() {
  const { jobs, onSelectJob } = useJobSearchItems()
  return <GeneSearchTrigger jobs={jobs} onSelectJob={onSelectJob} />
}
