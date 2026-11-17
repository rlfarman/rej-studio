import { useNavigate } from '@tanstack/react-router'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import type { JobSearchItem } from '@/features/gene-search/types/domain-types'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'

// App-level wrapper that merges the design-tool job store into the gene-search
// command palette. Kept outside both features so neither has to cross the
// other's boundary (`import-js/no-restricted-paths` in lint/config.ts).
interface GeneSearchShellProps {
  defaultQuery?: string
  isDialog?: boolean
}

export function GeneSearchShell(props: GeneSearchShellProps) {
  const navigate = useNavigate()
  const entries = useJobHistory((s) => s.entries)

  // React Compiler memoizes this on `entries`.
  const jobs: JobSearchItem[] = entries.map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    sequenceLength: e.sequenceLength,
  }))

  return (
    <GeneSearch
      {...props}
      jobs={jobs}
      onSelectJob={(id) =>
        void navigate({ to: '/design-tool', search: { job: id } })
      }
    />
  )
}
