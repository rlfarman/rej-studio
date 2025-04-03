import { getIsoformAndGeneByIsoformId } from '@/actions'
import { GeneSplitterForm } from '@/design-tool/components/gene-splitter-form'
import { SpeciesValues } from '../_types/species-options'

async function DesignToolPage({
  searchParams,
}: {
  searchParams: { isoform?: string }
}) {
  const isoformId = searchParams.isoform

  if (!isoformId) {
    return (
      <GeneSplitterForm
        defaultName="ABCD"
        defaultCodingSequence="GATACAGATACA"
      />
    )
  }

  const result = await getIsoformAndGeneByIsoformId(isoformId)

  if (!result) {
    return <GeneSplitterForm />
  }

  const { isoform, gene } = result
  return (
    <GeneSplitterForm
      defaultName={`Custom ${gene.symbol}`}
      defaultSpecies={isoform.species as SpeciesValues}
    />
  )
}

export default DesignToolPage
