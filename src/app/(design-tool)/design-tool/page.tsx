import { getIsoformAndGeneByIsoformId } from '@/features/gene-search/api/isoforms'
import { GeneSplitterForm } from '@/features/design-tool/components/gene-splitter-form'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { isSpecies } from '@/lib/bio/species'
import { rankWggwByBalance } from '@/lib/bio/sequence-utils'
import { AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { Metadata } from 'next'

/**
 * Choose an initial splice-junction position for the form. Returns the
 * balance-ranked best WGGW cut when the sequence is long enough to require
 * splitting; otherwise returns undefined and the form falls back to its
 * usual length/2 default.
 */
function pickDefaultSplitPoint(sequence: string): number | undefined {
  if (sequence.length <= AAV_PACKAGING_LIMIT) return undefined
  const ranked = rankWggwByBalance(sequence)
  return ranked[0]?.position
}

export const metadata: Metadata = {
  title: 'Design Tool | REJ Studio',
  description: 'Design your own gene with the REJ Studio design tool.',
}

async function DesignToolPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
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
