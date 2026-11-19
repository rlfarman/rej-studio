import { createFileRoute, useLocation } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
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
  /**
   * A design: one from this browser's history, or a cloud design's id, which
   * resolves for anyone signed in.
   */
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

/**
 * Says the transcript in the URL isn't in this corpus, above the blank form
 * it fell back to. Dismissible, and `role="status"` rather than an alert:
 * the form is usable, so this is an explanation, not a failure.
 */
function IsoformNotFoundNotice() {
  const [shown, setShown] = useState(true)
  if (!shown) return null
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
    >
      <span>{designToolCopy.isoformNotFound.message}</span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label={designToolCopy.isoformNotFound.dismissAria}
        onClick={() => setShown(false)}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}

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

  // A cloud design's id resolves anywhere, so it goes in the URL: a reload
  // reopens the run, and the link can be sent to a colleague. The form
  // remounts on the new key and reads the run from history.
  const showCloudJob = (cloudJobId: string) =>
    void navigate({
      search: (prev) => ({ ...prev, job: cloudJobId }),
      replace: true,
      resetScroll: false,
    })

  if (!isoformId || !prefill) {
    return (
      <DesignToolLayout>
        {/* A `?isoform=` the corpus doesn't have resolves to null and used to
            open the blank form silently, so a stale bookmark or a link into a
            different corpus version looked like a failed load. */}
        {isoformId ? <IsoformNotFoundNotice /> : null}
        <GeneSplitterForm
          key={jobId ?? keptKey ?? 'new'}
          defaultJobId={jobId}
          draftKey="new"
          onLeaveJob={leaveJob}
          onCloudJob={showCloudJob}
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
        // The transcript, not just the gene: customizing three isoforms of
        // one gene otherwise gives three runs with the same name, and
        // telling those apart is what the isoform table is for.
        defaultName={`${gene.symbol} ${isoform.id}`}
        defaultSpecies={species}
        defaultCodingSequence={isoform.codingSequence}
        defaultSpliceJunctionPosition={pickDefaultSplitPoint(
          isoform.codingSequence,
        )}
        defaultJobId={jobId}
        draftKey={`iso-${isoformId}`}
        onLeaveJob={leaveJob}
        onCloudJob={showCloudJob}
      />
    </DesignToolLayout>
  )
}

function DesignToolSkeleton() {
  return (
    <DesignToolLayout>
      <Skeleton
        aria-hidden
        className="h-[28rem] rounded-[min(var(--radius-4xl),24px)]"
      />
    </DesignToolLayout>
  )
}
