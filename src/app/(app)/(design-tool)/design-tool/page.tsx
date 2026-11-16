import { Suspense } from 'react'
import { getIsoformAndGeneByIsoformId } from '@/features/gene-search/api/isoforms'
import { GeneSplitterForm } from '@/features/design-tool/components/gene-splitter-form'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { isSpecies } from '@/lib/bio/species'
import { pickDefaultSplitPoint } from '@/features/design-tool/utils/default-split-point'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Design Tool',
  description:
    'Optimize coding sequences for RNA End-Joining. Enter a custom CDS or start from a pre-loaded isoform.',
  alternates: { canonical: '/design-tool' },
  openGraph: {
    title: 'Design Tool',
    description:
      'Optimize coding sequences for RNA End-Joining. Enter a custom CDS or start from a pre-loaded isoform.',
    url: '/design-tool',
    images: [
      {
        url: '/api/og?title=Optimize+coding%0Asequences+for+REJ&section=Design+Tool&description=Custom+CDS+input+%C2%B7+DNAChisel+optimization+%C2%B7+Downloadable+results&url=rejstudio.com/design-tool',
        width: 1200,
        height: 630,
        alt: 'Design Tool — REJ Studio',
      },
    ],
  },
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

// ?isoform= and ?job= are request-time data, so they're read inside
// Suspense; the page shell prerenders and navigations stay instant.
function DesignToolPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<DesignToolSkeleton />}>
      <DesignToolFromUrl searchParams={searchParams} />
    </Suspense>
  )
}

function DesignToolSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-5xl px-4 py-8 md:py-10">
      <div className="bg-muted h-[28rem] animate-pulse rounded-xl" />
    </div>
  )
}

async function DesignToolFromUrl({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const isoformId = Array.isArray(params.isoform)
    ? params.isoform[0]
    : params.isoform

  const jobId = Array.isArray(params.job) ? params.job[0] : params.job

  if (!isoformId) {
    return <GeneSplitterForm key={jobId ?? 'new'} defaultJobId={jobId} />
  }

  const result = isoformId
    ? await getIsoformAndGeneByIsoformId(isoformId)
    : undefined

  if (!result) {
    return <GeneSplitterForm key={jobId ?? 'new'} defaultJobId={jobId} />
  }

  const { isoform, gene } = result
  const validSpecies: DesignToolSpecies = isSpecies(isoform.species)
    ? isoform.species
    : 'none'

  return (
    <GeneSplitterForm
      key={jobId ?? `iso-${isoformId}`}
      defaultName={`Custom ${gene.symbol}`}
      defaultSpecies={validSpecies}
      defaultCodingSequence={isoform.codingSequence}
      defaultSpliceJunctionPosition={pickDefaultSplitPoint(
        isoform.codingSequence,
      )}
      defaultJobId={jobId}
    />
  )
}

export default DesignToolPage
