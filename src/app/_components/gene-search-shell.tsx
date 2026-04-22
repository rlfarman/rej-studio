'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import type { SearchGenesResult } from '@/features/gene-search/api/genes'
import type { JobSearchItem } from '@/features/gene-search/types/domain-types'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'

// App-level wrapper that merges the design-tool job store into the gene-search
// command palette. Kept outside both features so neither has to cross the
// other's boundary (ESLint `import/no-restricted-paths`).
interface GeneSearchShellProps {
  searchGenes: (
    content: string,
    species?: SpeciesFilter,
  ) => Promise<SearchGenesResult>
  defaultQuery?: string
  isDialog?: boolean
}

export function GeneSearchShell(props: GeneSearchShellProps) {
  const router = useRouter()
  const entries = useJobHistory((s) => s.entries)

  const jobs = useMemo<JobSearchItem[]>(
    () =>
      entries.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        sequenceLength: e.sequenceLength,
      })),
    [entries],
  )

  return (
    <GeneSearch
      {...props}
      jobs={jobs}
      onSelectJob={(id) => router.push(`/design-tool?job=${id}`)}
    />
  )
}
