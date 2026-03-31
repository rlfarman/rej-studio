import { getIsoformAndGeneByIsoformId } from '@/actions/isoforms'
import { GeneSplitterForm } from '@/design-tool/components/gene-splitter-form'
import type { DesignToolSpecies } from './_types/species-options'
import { isSpecies } from '@/lib/species'
import { PRESETS } from './_lib/presets'
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

  const presetKey = Array.isArray(params.preset)
    ? params.preset[0]
    : params.preset

  const presetValues =
    presetKey && presetKey in PRESETS ? PRESETS[presetKey].values : undefined

  if (!isoformId) {
    return <GeneSplitterForm defaultPreset={presetValues} />
  }

  const result = isoformId
    ? await getIsoformAndGeneByIsoformId(isoformId)
    : undefined

  if (!result) {
    return <GeneSplitterForm defaultPreset={presetValues} />
  }

  const { isoform, gene } = result
  const validSpecies: DesignToolSpecies = isSpecies(isoform.species)
    ? isoform.species
    : 'none'

  return (
    <GeneSplitterForm
      defaultName={`Custom ${gene.symbol}`}
      defaultSpecies={validSpecies}
      defaultCodingSequence={isoform.codingSequence}
      defaultPreset={presetValues}
    />
  )
}

export default DesignToolPage
