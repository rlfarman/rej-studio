import { createFileRoute, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { Skeleton } from '@/components/ui/skeleton'
import { appCopy } from '@/copy/app'
import { GeneSplitterForm } from '@/features/design-tool/components/gene-splitter-form'
import { designToolCopy } from '@/features/design-tool/copy'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { pickDefaultSplitPoint } from '@/features/design-tool/utils/default-split-point'
import { isoformWithGeneQuery } from '@/features/gene-search/corpus/queries'
import { isSpecies } from '@/lib/bio/species'
import { DesignToolError } from './-components/design-tool-error'
import { sectionPending } from './-components/layout/section-pending'
import { searchText } from './-components/search-params'

const searchSchema = z.object({
  /** A design from this browser's history. */
  job: searchText,
  /** An isoform whose coding sequence prefills a new design. */
  isoform: searchText,
})

export const Route = createFileRoute('/design-tool')({
  validateSearch: (search) => searchSchema.parse(search),
  // Only the isoform loads anything; a job is read from history by the form.
  loaderDeps: ({ search }) => ({ isoform: search.isoform }),
  // An isoform the corpus doesn't have opens the blank form, as before.
  loader: ({ context: { queryClient }, deps: { isoform } }) =>
    isoform ? queryClient.ensureQueryData(isoformWithGeneQuery(isoform)) : null,
  head: () => ({
    meta: [
      { title: appCopy.metadata.title(designToolCopy.metadata.title) },
      { name: 'description', content: designToolCopy.metadata.description },
    ],
  }),
  component: DesignToolPage,
  pendingComponent: sectionPending(DesignToolSkeleton),
  errorComponent: DesignToolError,
})

function DesignToolLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 md:pt-12">
      {children}
    </div>
  )
}

/**
 * History state the page writes when a new run replaces the design `?job=`
 * named: the form's key, so dropping the param doesn't remount the form
 * (and lose the run it just started). A navigation here starts a fresh
 * history entry without it, so opening another design or a blank form
 * still remounts.
 */
type DesignToolState = { designFormKey?: string }

function DesignToolPage() {
  const { job: jobId, isoform: isoformId } = Route.useSearch()
  const prefill = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const keptKey = useLocation({
    select: (location) => (location.state as DesignToolState).designFormKey,
  })

  const leaveJob = (shownJobId: string) =>
    void navigate({
      search: (prev) => ({ ...prev, job: undefined }),
      state: (prev) => ({ ...prev, designFormKey: shownJobId }),
      replace: true,
      resetScroll: false,
    })

  if (!isoformId || !prefill) {
    return (
      <DesignToolLayout>
        <GeneSplitterForm
          key={jobId ?? keptKey ?? 'new'}
          defaultJobId={jobId}
          draftKey="new"
          onLeaveJob={leaveJob}
        />
      </DesignToolLayout>
    )
  }

  const { isoform, gene } = prefill
  const species: DesignToolSpecies = isSpecies(isoform.species)
    ? isoform.species
    : 'none'

  return (
    <DesignToolLayout>
      <GeneSplitterForm
        key={jobId ?? keptKey ?? `iso-${isoformId}`}
        defaultName={`Custom ${gene.symbol}`}
        defaultSpecies={species}
        defaultCodingSequence={isoform.codingSequence}
        defaultSpliceJunctionPosition={pickDefaultSplitPoint(
          isoform.codingSequence,
        )}
        defaultJobId={jobId}
        draftKey={`iso-${isoformId}`}
        onLeaveJob={leaveJob}
      />
    </DesignToolLayout>
  )
}

function DesignToolSkeleton() {
  return (
    <DesignToolLayout>
      <div aria-hidden className="mx-auto w-full max-w-5xl px-4 py-8 md:py-10">
        <Skeleton className="h-[28rem] rounded-[min(var(--radius-4xl),24px)]" />
      </div>
    </DesignToolLayout>
  )
}
