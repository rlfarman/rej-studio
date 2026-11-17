import { useNavigate } from '@tanstack/react-router'

import type { JobSearchItem } from '@/features/gene-search/types/domain-types'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'

// Merges the design-tool job store into the gene-search palette. Kept outside
// both features so neither has to cross the other's boundary
// (`import-js/no-restricted-paths` in lint/config.ts).

/** The design tool's jobs, as the palette lists them, and opening one. */
export function useJobSearchItems() {
  const navigate = useNavigate()
  const entries = useJobHistory((s) => s.entries)

  // React Compiler memoizes this on `entries`.
  const jobs: JobSearchItem[] = entries.map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    sequenceLength: e.sequenceLength,
  }))

  const onSelectJob = (id: string) =>
    void navigate({ to: '/design-tool', search: { job: id } })
  return { jobs, onSelectJob }
}
