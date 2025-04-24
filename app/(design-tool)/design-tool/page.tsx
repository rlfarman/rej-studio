import { getIsoformAndGeneByIsoformId } from '@/actions'
import { GeneSplitterForm } from '@/design-tool/components/gene-splitter-form'
import { SpeciesValues } from '../_types/species-options'
import { Metadata } from 'next'

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

  if (!isoformId) {
    return <GeneSplitterForm />
  }

  const result = isoformId
    ? await getIsoformAndGeneByIsoformId(isoformId)
    : undefined

  if (!result) {
    return <GeneSplitterForm />
  }

  const { isoform, gene } = result

  return (
    <GeneSplitterForm
      defaultName={`Custom ${gene.symbol}`}
      defaultSpecies={isoform.species as SpeciesValues}
      defaultCodingSequence={isoform.codingSequence}
    />
  )
}

export default DesignToolPage
